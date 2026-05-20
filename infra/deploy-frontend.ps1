# Build the React frontend and publish it to the S3 bucket that backs the
# CloudFront distribution, then invalidate the cache so users see the new build.
#
# Required environment variables:
#   S3_BUCKET            target bucket name (no s3:// prefix)
#   CLOUDFRONT_DIST_ID   CloudFront distribution ID
# Optional:
#   AWS_REGION           defaults to us-east-1
#   VITE_API_URL         baked into the build; defaults to /api (same-origin via CloudFront)

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Require-Env([string]$name) {
    $val = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($val)) {
        throw "$name is required"
    }
    return $val
}

$Bucket   = Require-Env "S3_BUCKET"
$DistId   = Require-Env "CLOUDFRONT_DIST_ID"
$Region   = $env:AWS_REGION; if ([string]::IsNullOrWhiteSpace($Region)) { $Region = "us-east-1" }
$ApiUrl   = $env:VITE_API_URL; if ([string]::IsNullOrWhiteSpace($ApiUrl)) { $ApiUrl = "/api" }
$env:VITE_API_URL = $ApiUrl

$RootDir  = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontEnd = Join-Path $RootDir "frontend"
$Dist     = Join-Path $FrontEnd "dist"

Write-Host "[deploy-frontend] building (VITE_API_URL=$ApiUrl)"
Push-Location $FrontEnd
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally {
    Pop-Location
}

Write-Host "[deploy-frontend] syncing dist/ -> s3://$Bucket"
aws s3 sync $Dist "s3://$Bucket/" `
    --region $Region `
    --delete `
    --exclude "index.html" `
    --cache-control "public,max-age=31536000,immutable"
if ($LASTEXITCODE -ne 0) { throw "aws s3 sync failed" }

aws s3 cp (Join-Path $Dist "index.html") "s3://$Bucket/index.html" `
    --region $Region `
    --cache-control "no-cache,no-store,must-revalidate" `
    --content-type "text/html; charset=utf-8"
if ($LASTEXITCODE -ne 0) { throw "aws s3 cp index.html failed" }

Write-Host "[deploy-frontend] invalidating CloudFront $DistId"
aws cloudfront create-invalidation `
    --distribution-id $DistId `
    --paths "/index.html" "/" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "cloudfront create-invalidation failed" }

Write-Host "[deploy-frontend] done"
