// seal-demo.mjs —— 把任意目录封成 XYPACK1 包（和正式备份同一套算法）
// 用法: node seal-demo.mjs pack <源目录> <输出.seal>
// 密码从环境变量 INNER_SEAL_PASS 取。
// 格式: XYPACK1\0 | salt(16) | iv(12) | tag(16) | ciphertext(tar.gz)
// 密钥: scrypt(pass, salt, 32, N=2^15, r=8, p=1) → AES-256-GCM
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MAGIC = Buffer.from('XYPACK1\0', 'binary')
const N = 32768, R = 8, P = 1

const [cmd, srcDir, outFile] = process.argv.slice(2)
if (cmd !== 'pack' || !srcDir || !outFile) {
  console.error('用法: node seal-demo.mjs pack <源目录> <输出.seal>')
  process.exit(2)
}
if (!fs.existsSync(srcDir)) { console.error('找不到源目录: ' + srcDir); process.exit(2) }
const pass = process.env.INNER_SEAL_PASS
if (!pass) { console.error('缺密码：请设置环境变量 INNER_SEAL_PASS'); process.exit(3) }

// 1) 打 tar.gz，并写清单（每个文件 sha256，解包时逐个核对）
const manifest = []
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { walk(p); continue }
    manifest.push({
      rel: path.relative(srcDir, p).split(path.sep).join('/'),
      bytes: fs.statSync(p).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
    })
  }
}
walk(srcDir)

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'seal-demo-'))
for (const m of manifest) {
  const dest = path.join(stage, m.rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(path.join(srcDir, m.rel), dest)
}
fs.writeFileSync(path.join(stage, '_MANIFEST.json'),
  JSON.stringify({ note: 'demo pack', createdAt: new Date().toISOString(), files: manifest }, null, 1))

const tar = path.join(stage, '..', `seal-demo-${Date.now()}.tar.gz`)
execFileSync('tar', ['-czf', tar, '-C', stage, '.'], { stdio: 'inherit' })
const plain = fs.readFileSync(tar)

// 2) 加密
const salt = crypto.randomBytes(16)
const iv = crypto.randomBytes(12)
const key = crypto.scryptSync(pass, salt, 32, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
const c = crypto.createCipheriv('aes-256-gcm', key, iv)
const enc = Buffer.concat([c.update(plain), c.final()])
fs.writeFileSync(outFile, Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), enc]))

console.log(JSON.stringify({
  ok: true, out: outFile, files: manifest.length,
  plainBytes: plain.length, packBytes: fs.statSync(outFile).size,
}, null, 1))
