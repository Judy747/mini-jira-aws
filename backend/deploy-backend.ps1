# Deploy the backend across all EC2 instances in the mini-jira ASG.
# Wraps backend/scripts/deploy-backend.js so you can run it from the repo root.
#
# Usage (from backend/ folder):
#   .\deploy-backend.ps1            # deploys origin/main (default)
#   .\deploy-backend.ps1 feature-x  # deploys origin/feature-x
#
# Requires the IAM permissions documented in scripts/deploy-backend.js.

$ErrorActionPreference = "Stop"

$branch = "main"
if ($args.Count -gt 0) { $branch = $args[0] }

Write-Host "==> Deploying backend (branch=$branch) to EC2 via SSM Run Command" -ForegroundColor Cyan
node scripts/deploy-backend.js $branch
if ($LASTEXITCODE -ne 0) { throw "deploy-backend.js failed" }

Write-Host "==> Done. Test with: curl https://d2qic2nqco9xo5.cloudfront.net/api/health" -ForegroundColor Green
