/**
 * Deploy the React frontend to S3 and invalidate CloudFront.
 *
 * Usage (from backend/ folder):
 *   node scripts/deploy-frontend.js
 * Or from anywhere via the npm script in backend/package.json:
 *   npm --prefix backend run deploy:frontend
 *
 * Loads AWS credentials from backend/.env (same file that backend/server.js uses).
 * Reads target bucket + distribution ID from env (or sensible defaults below).
 *
 * Does NOT run `npm run build` — that's the responsibility of the caller
 * (frontend/deploy.ps1) so it's clear when build vs upload fails.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');
const {
  CloudFrontClient,
  CreateInvalidationCommand,
} = require('@aws-sdk/client-cloudfront');

// Minimal MIME type map covering everything a Vite build produces.
// Avoids the `mime` npm package whose API changes between versions.
const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET =
  process.env.FRONTEND_S3_BUCKET ||
  'mini-jira-frontend-2026-744683930574-us-east-1-an';
const DISTRIBUTION_ID =
  process.env.CLOUDFRONT_DIST_ID || 'E2ILZMF472G8HM';
const DIST_DIR = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

const s3 = new S3Client({ region: REGION });
const cf = new CloudFrontClient({ region: REGION });

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, base));
    } else if (entry.isFile()) {
      out.push({
        absPath: full,
        // S3 keys use forward slashes regardless of OS
        key: path.relative(base, full).split(path.sep).join('/'),
      });
    }
  }
  return out;
}

function cacheControlFor(key) {
  // index.html must never be cached so users see fresh deploys immediately.
  // Hashed assets (e.g. index-abc123.js) are content-addressed and safe to cache forever.
  if (key === 'index.html') return 'no-cache, no-store, must-revalidate';
  return 'public, max-age=31536000, immutable';
}

async function uploadAll(files) {
  console.log(`[deploy] uploading ${files.length} files to s3://${BUCKET}/`);
  let i = 0;
  for (const f of files) {
    i += 1;
    const body = fs.readFileSync(f.absPath);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: f.key,
        Body: body,
        ContentType: contentTypeFor(f.absPath),
        CacheControl: cacheControlFor(f.key),
      })
    );
    process.stdout.write(`  [${i}/${files.length}] ${f.key}\n`);
  }
}

async function listRemoteKeys() {
  const keys = [];
  let token;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
    );
    for (const o of r.Contents || []) keys.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function deleteStale(localKeys, remoteKeys) {
  const localSet = new Set(localKeys);
  const stale = remoteKeys.filter((k) => !localSet.has(k));
  if (stale.length === 0) {
    console.log('[deploy] no stale objects to delete');
    return;
  }
  console.log(`[deploy] deleting ${stale.length} stale objects`);
  // DeleteObjects supports max 1000 keys per request
  for (let i = 0; i < stale.length; i += 1000) {
    const batch = stale.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );
    for (const k of batch) console.log(`  deleted ${k}`);
  }
}

async function invalidate() {
  console.log(`[deploy] creating CloudFront invalidation for ${DISTRIBUTION_ID}`);
  const r = await cf.send(
    new CreateInvalidationCommand({
      DistributionId: DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `deploy-${Date.now()}`,
        Paths: { Quantity: 1, Items: ['/*'] },
      },
    })
  );
  console.log(
    `[deploy] invalidation ${r.Invalidation.Id} created, status=${r.Invalidation.Status}`
  );
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(
      `Build directory not found: ${DIST_DIR}\nRun "npm run build" in frontend/ first.`
    );
  }
  console.log(`[deploy] region=${REGION} bucket=${BUCKET} dist=${DISTRIBUTION_ID}`);
  const files = walk(DIST_DIR);
  if (files.length === 0) {
    throw new Error(`No files found in ${DIST_DIR}`);
  }
  await uploadAll(files);
  const localKeys = files.map((f) => f.key);
  const remoteKeys = await listRemoteKeys();
  await deleteStale(localKeys, remoteKeys);
  await invalidate();
  console.log('[deploy] done');
}

main().catch((e) => {
  console.error('[deploy] FAILED:', e.message);
  if (e.$metadata) console.error(' metadata:', e.$metadata);
  process.exit(1);
});
