# Build the React frontend and deploy to S3 + invalidate CloudFront.
# Uses backend/scripts/deploy-frontend.js which talks to AWS via the SDK
# (no AWS CLI install required) and reads creds from backend/.env.

$ErrorActionPreference = "Stop"

Write-Host "==> npm run build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Host "==> Uploading dist/ to S3 + invalidating CloudFront" -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot "..\backend")
try {
    node scripts/deploy-frontend.js
    if ($LASTEXITCODE -ne 0) { throw "deploy-frontend.js failed" }
} finally {
    Pop-Location
}

Write-Host "==> Done. Hard-refresh the website (Ctrl+Shift+R) to see changes." -ForegroundColor Green
