# GitHub와 동기화 (PowerShell)
# 저장소 루트에서: .\scripts\sync-github.ps1
# 다른 PC에서 작업을 가져온 뒤 푸시까지: .\scripts\sync-github.ps1 -Push
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
