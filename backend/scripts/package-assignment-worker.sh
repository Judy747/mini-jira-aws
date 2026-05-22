#!/bin/bash
# Build assignmentWorker.zip for S3 upload (infra/assignment-pipeline.yaml).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/lambda/assignmentWorker"
OUT="$ROOT/lambda/assignmentWorker.zip"

cd "$DIR"
npm ci --omit=dev
rm -f "$OUT"
cd "$ROOT/lambda"
zip -r assignmentWorker.zip assignmentWorker/index.js assignmentWorker/node_modules assignmentWorker/package.json
echo "Created $OUT"
