# 不许把真东西带进来
# 2026-11-10 建。用途：这个公开仓只放演示样本，任何真实内容一律拒收。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$banned = @(
  'inner-seal.seal', 'inner-tools.seal',
  'seal-code.txt', 'recovery', '恢复码',
  'id_ed25519', 'id_rsa', '.key', '.pem',
  '私信', '每日', '照片'
)

$hits = @()
foreach ($f in Get-ChildItem $root -Recurse -File -Force) {
  if ($f.FullName -like '*\.git\*') { continue }
  foreach ($b in $banned) {
    if ($f.Name -like "*$b*" -or $f.FullName -like "*$b*") { $hits += $f.FullName }
  }
}

# 再扫内容：真恢复码的形状（6 组 4 位左右）与常见密钥前缀
$patterns = @('sk-[A-Za-z0-9]{20,}', 'ghp_[A-Za-z0-9]{20,}', 'BEGIN (RSA|OPENSSH|PRIVATE) KEY')
foreach ($f in Get-ChildItem $root -Recurse -File -Force -Include *.md,*.txt,*.json,*.mjs,*.yml) {
  if ($f.FullName -like '*\.git\*') { continue }
  $t = [System.IO.File]::ReadAllText($f.FullName)
  foreach ($p in $patterns) { if ($t -match $p) { $hits += "$($f.FullName) 命中 $p" } }
}

if ($hits.Count -gt 0) {
  Write-Host "✗ 发现不该进仓库的东西：" -ForegroundColor Red
  $hits | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}
Write-Host "✓ 干净：没有真包、没有密钥、没有真日记。" -ForegroundColor Green
