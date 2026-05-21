const {
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { S3Client } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { loadEnv } = require('../config/env');

const cfg = loadEnv();
const s3 = new S3Client({ region: cfg.awsRegion });

/** Stable object key per task — new PUTs create new S3 versions when versioning is on. */
function taskImageKey(taskId) {
  return `tasks/${taskId}/attachment`;
}

function encodeKeyForUrl(key) {
  return key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function publicUrlForBucket({ bucket, publicBaseUrl }, key) {
  if (!key) return null;
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, '')}/${encodeKeyForUrl(key)}`;
  }
  if (!bucket) return null;
  return `https://${bucket}.s3.${cfg.awsRegion}.amazonaws.com/${encodeKeyForUrl(key)}`;
}

function publicOriginalUrl(key) {
  return publicUrlForBucket(
    { bucket: cfg.s3.originalsBucket, publicBaseUrl: cfg.s3.originalsPublicBaseUrl },
    key
  );
}

function publicThumbnailUrl(key) {
  return publicUrlForBucket(
    { bucket: cfg.s3.resizedBucket, publicBaseUrl: cfg.s3.resizedPublicBaseUrl },
    key
  );
}

/**
 * Derive S3 object key from a stored public URL (originals or resized base).
 */
function keyFromPublicUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const bases = [
    cfg.s3.originalsPublicBaseUrl,
    cfg.s3.resizedPublicBaseUrl,
    cfg.s3.originalsBucket
      ? `https://${cfg.s3.originalsBucket}.s3.${cfg.awsRegion}.amazonaws.com`
      : '',
    cfg.s3.resizedBucket
      ? `https://${cfg.s3.resizedBucket}.s3.${cfg.awsRegion}.amazonaws.com`
      : '',
  ].filter(Boolean);

  for (const base of bases) {
    const normalized = base.replace(/\/$/, '');
    if (url.startsWith(normalized + '/')) {
      const path = url.slice(normalized.length + 1);
      return decodeURIComponent(path);
    }
  }
  return null;
}

/**
 * Returns a short-lived presigned URL for clients to PUT directly to the originals bucket.
 * Uses PutObjectCommand only (never GetObject) — clients must HTTP PUT to uploadUrl.
 */
async function getPresignedPutUrl({ key, contentType }) {
  if (!cfg.s3.originalsBucket) {
    throw new Error('S3_BUCKET_NAME (originals) is not configured');
  }
  const cmd = new PutObjectCommand({
    Bucket: cfg.s3.originalsBucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });
  return { uploadUrl, method: 'PUT' };
}

/**
 * Build upload target key: prefer stable per-task key when taskId is known.
 */
function buildUploadKey({ taskId, userId, filename }) {
  if (taskId) return taskImageKey(taskId);
  const safe = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `attachments/${userId}/${uuidv4()}-${safe}`;
}

/**
 * Resolve image fields for DynamoDB from client payload or URLs.
 * thumbnailUrl is the predictable resized-bucket URL for the same imageKey; Lambda writes
 * that path asynchronously after S3 PUT (UI falls back to imageUrl until thumbnail exists).
 */
function resolveImageFields({ imageUrl, imageKey, thumbnailUrl }) {
  const key = imageKey?.trim() || keyFromPublicUrl(imageUrl) || null;
  if (!key && !imageUrl) {
    return { imageKey: null, imageUrl: null, thumbnailUrl: null };
  }
  const resolvedThumb = key ? publicThumbnailUrl(key) : null;
  return {
    imageKey: key,
    imageUrl: imageUrl || publicOriginalUrl(key),
    thumbnailUrl: thumbnailUrl || resolvedThumb,
  };
}

/**
 * Delete the current object only (no VersionId).
 * - Versioned originals bucket: adds a delete marker; older versions remain for audit/history.
 * - Resized bucket (versioning off): removes the thumbnail object outright.
 * Never lists or deletes all version IDs — that would wipe version history.
 */
async function deleteObjectIfExists(bucket, key) {
  if (!bucket || !key) return;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return;
    throw err;
  }
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * On task delete: remove current object + thumbnail. Versioned originals retain prior versions.
 */
async function deleteTaskImages(imageKey) {
  if (!imageKey) return;
  await Promise.all([
    deleteObjectIfExists(cfg.s3.originalsBucket, imageKey),
    deleteObjectIfExists(cfg.s3.resizedBucket, imageKey),
  ]);
}

module.exports = {
  taskImageKey,
  buildUploadKey,
  getPresignedPutUrl,
  publicOriginalUrl,
  publicThumbnailUrl,
  publicObjectUrl: publicOriginalUrl,
  keyFromPublicUrl,
  resolveImageFields,
  deleteTaskImages,
};
