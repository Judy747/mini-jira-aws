# Build digestLambda.zip for upload to S3 (CloudFormation LambdaCodeS3Bucket).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$lambdaDir = Join-Path $root 'lambda\digestLambda'
$outZip = Join-Path $root 'lambda\digestLambda.zip'

Push-Location $lambdaDir
try {
  npm ci --omit=dev
  if (Test-Path $outZip) { Remove-Item $outZip -Force }
  Compress-Archive -Path 'index.js', 'node_modules', 'package.json' -DestinationPath $outZip -Force
  Write-Host "Created $outZip"
} finally {
  Pop-Location
}
