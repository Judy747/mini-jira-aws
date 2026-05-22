# Build assignmentWorker.zip (index.js at zip root — Lambda Handler: index.handler)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$lambdaDir = Join-Path $root 'lambda\assignmentWorker'
$outZip = Join-Path $root 'lambda\assignmentWorker.zip'
$staging = Join-Path $env:TEMP "mini-jira-assignment-worker-staging"

Push-Location $lambdaDir
try {
  Write-Host '==> npm ci --omit=dev' -ForegroundColor Cyan
  npm ci --omit=dev
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

  if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
  New-Item -ItemType Directory -Path $staging | Out-Null
  Copy-Item -Path 'index.js', 'package.json', 'node_modules' -Destination $staging -Recurse

  if (Test-Path $outZip) { Remove-Item $outZip -Force }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $outZip -Force
  Write-Host "Created $outZip ($((Get-Item $outZip).Length) bytes)" -ForegroundColor Green
} finally {
  Pop-Location
  if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
}
