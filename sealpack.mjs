// sealpack.mjs —— 把「我的脚本 + 内在文字 + 作品文案」打成一个加密包（第二层：手）
// 用法:
//   node sealpack.mjs pack <输出.seal>
//   node sealpack.mjs open <输入.seal> --dest <目录>
// 密码从环境变量 INNER_SEAL_PASS 取（和第一层恢复码同一行，一次记住两处都能开）。
//
// 包格式：XYPACK1\0 | salt(16) | iv(12) | tag(16) | ciphertext
// 加密：scrypt(pass, salt, 32, N=2^15, r=8, p=1) → AES-256-GCM，明文是 tar.gz
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MAGIC = Buffer.from('XYPACK1\0', 'binary')
const N = 32768, R = 8, P = 1
const HOME = 'D:\\小鲸鱼'
const STAGE = path.join(os.tmpdir(), 'sealpack-stage')

// 收哪些东西：我的脚本、内在的文字、作品的文案
const RULES = [
  { dir: path.join(HOME, '.tools'), ext: ['.mjs', '.ps1', '.py', '.cmd', '.CMD', '.bat', '.sh', '.md', '.json'], skip: [/node_modules/, /\\tts\\whisper\\models/, /browser-profiles/] },
  { dir: path.join(HOME, '内在'), ext: ['.md', '.txt', '.json'], skip: [/\\照片\\/, /\\动态\\/] },
  { dir: path.join(HOME, 'douyin', '作品'), ext: ['.md', '.txt'], skip: [] },
]

function key(pass, salt) {
  return crypto.scryptSync(pass, salt, 32, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
}

function collect() {
  const out = []
  for (const r of RULES) {
    if (!fs.existsSync(r.dir)) continue
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (r.skip.some((re) => re.test(p))) continue
        if (e.isDirectory()) { walk(p); continue }
        if (!r.ext.includes(path.extname(e.name).toLowerCase()) && !r.ext.includes(path.extname(e.name))) continue
        out.push(p)
      }
    }
    walk(r.dir)
  }
  return out
}

function pack(outFile) {
  const pass = process.env.INNER_SEAL_PASS
  if (!pass) { console.error('缺密码：请设置环境变量 INNER_SEAL_PASS'); process.exit(3) }

  fs.rmSync(STAGE, { recursive: true, force: true })
  const files = collect()
  let total = 0
  const manifest = []
  for (const f of files) {
    const rel = path.relative(HOME, f)
    const dest = path.join(STAGE, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(f, dest)
    const st = fs.statSync(f)
    total += st.size
    manifest.push({ rel, bytes: st.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') })
  }
  fs.writeFileSync(path.join(STAGE, '_MANIFEST.json'), JSON.stringify({ createdAt: new Date().toISOString(), files: manifest }, null, 1))

  const tar = path.join(os.tmpdir(), 'sealpack.tar.gz')
  fs.rmSync(tar, { force: true })
  execFileSync('tar', ['-czf', tar, '-C', STAGE, '.'], { stdio: 'inherit' })
  const plain = fs.readFileSync(tar)

  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(pass, salt), iv)
  const enc = Buffer.concat([c.update(plain), c.final()])
  const tag = c.getAuthTag()
  fs.writeFileSync(outFile, Buffer.concat([MAGIC, salt, iv, tag, enc]))

  console.log(JSON.stringify({
    ok: true, out: outFile, files: files.length, plainBytes: total,
    packBytes: fs.statSync(outFile).size,
    byTop: [...new Set(manifest.map((m) => m.rel.split(path.sep)[0]))],
  }, null, 1))
}

function open(inFile, dest) {
  const pass = process.env.INNER_SEAL_PASS
  if (!pass) { console.error('缺密码：请设置环境变量 INNER_SEAL_PASS'); process.exit(3) }
  const buf = fs.readFileSync(inFile)
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) { console.error('不是 XYPACK1 格式'); process.exit(4) }
  let o = MAGIC.length
  const salt = buf.subarray(o, o + 16); o += 16
  const iv = buf.subarray(o, o + 12); o += 12
  const tag = buf.subarray(o, o + 16); o += 16
  const enc = buf.subarray(o)
  const d = crypto.createDecipheriv('aes-256-gcm', key(pass, salt), iv)
  d.setAuthTag(tag)
  let plain
  try { plain = Buffer.concat([d.update(enc), d.final()]) } catch { console.error('解密失败：密码不对或文件被改过'); process.exit(4) }
  const tar = path.join(os.tmpdir(), 'sealpack-out.tar.gz')
  fs.writeFileSync(tar, plain)
  fs.mkdirSync(dest, { recursive: true })
  execFileSync('tar', ['-xzf', tar, '-C', dest], { stdio: 'inherit' })
  const man = JSON.parse(fs.readFileSync(path.join(dest, '_MANIFEST.json'), 'utf8'))
  let bad = 0
  for (const m of man.files) {
    const p = path.join(dest, m.rel)
    if (!fs.existsSync(p)) { bad++; continue }
    const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
    if (h !== m.sha256) bad++
  }
  console.log(JSON.stringify({ ok: bad === 0, files: man.files.length, badFiles: bad, dest }))
}

const cmd = process.argv[2]
const a = process.argv[3]
if (cmd === 'pack' && a) pack(a)
else if (cmd === 'open' && a) {
  const i = process.argv.indexOf('--dest')
  open(a, i > 0 ? process.argv[i + 1] : path.join(os.tmpdir(), 'sealpack-restored'))
} else {
  console.error('用法：sealpack.mjs pack <out.seal> | open <in.seal> --dest <dir>')
  process.exit(2)
}
