# 릴리스: 빌드 → (변경 시 커밋) → 푸시 → Vercel 프로덕션
# 사용: .\scripts\release.ps1 -Message "feat: 변경 요약"
param(
  [string]$Message = "chore: release"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

Write-Host "== npm run build =="
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$status = git status --porcelain
if ($status) {
  Write-Host "== git commit =="
  git add -A
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host "(커밋할 변경 없음)"
}

Write-Host "== git push =="
git push origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== vercel deploy --prod =="
npx vercel deploy --prod --yes
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done."
