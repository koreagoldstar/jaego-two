# GitHub와 동기화 (PowerShell)
# 원격 저장소(공통): https://github.com/koreagoldstar/jaego-two — 집/사무실 PC 모두 이 URL만 사용
# 저장소 루트에서: .\scripts\sync-github.ps1
# 작업 전 가져오기 + 작업 후 올리기: .\scripts\sync-github.ps1 -Push
param(
  [switch]$Push
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

Write-Host "Repository: $repoRoot"
git fetch origin
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git pull --rebase origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Push) {
  git push origin main
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
git status -sb
