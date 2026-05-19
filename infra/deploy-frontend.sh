#!/usr/bin/env bash
# Build the React frontend and publish it to the S3 bucket that backs the
# CloudFront distribution, then invalidate the cache so users see the new build.
#
# Required environment variables:
#   S3_BUCKET            target bucket name (no s3:// prefix)
#   CLOUDFRONT_DIST_ID   CloudFront distribution ID
# Optional:
#   AWS_REGION           defaults to us-east-1
#   VITE_API_URL         baked into the build; defaults to /api (same-origin via CloudFront)

set -euo pipefail

: "${S3_BUCKET:?S3_BUCKET is required}"
: "${CLOUDFRONT_DIST_ID:?CLOUDFRONT_DIST_ID is required}"
AWS_REGION="${AWS_REGION:-us-east-1}"
export VITE_API_URL="${VITE_API_URL:-/api}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[deploy-frontend] building (VITE_API_URL=$VITE_API_URL)"
npm --prefix "$ROOT_DIR/frontend" ci
npm --prefix "$ROOT_DIR/frontend" run build

echo "[deploy-frontend] syncing dist/ -> s3://$S3_BUCKET"
# Long-cache every hashed asset...
aws s3 sync "$ROOT_DIR/frontend/dist/" "s3://$S3_BUCKET/" \
  --region "$AWS_REGION" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

# ...but never cache the HTML entrypoint, so new deploys are picked up immediately.
aws s3 cp "$ROOT_DIR/frontend/dist/index.html" "s3://$S3_BUCKET/index.html" \
  --region "$AWS_REGION" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html; charset=utf-8"

echo "[deploy-frontend] invalidating CloudFront $CLOUDFRONT_DIST_ID"
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DIST_ID" \
  --paths "/index.html" "/" >/dev/null

echo "[deploy-frontend] done"
