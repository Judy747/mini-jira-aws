const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { S3Client } = require('@aws-sdk/client-s3');
const { loadEnv } = require('../config/env');

const cfg = loadEnv();
const s3 = new S3Client({ region: cfg.awsRegion });

/**
 * Returns a short-lived presigned URL for clients to PUT an object directly to S3.
 */
async function getPresignedPutUrl({ key, contentType }) {
  const cmd = new PutObjectCommand({
    Bucket: cfg.s3.bucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  return getSignedUrl(s3, cmd, { expiresIn: 300 });
}

/**
 * Public URL for an object after upload (adjust if you use CloudFront).
 */
function publicObjectUrl(key) {
  if (cfg.s3.publicBaseUrl) {
    return `${cfg.s3.publicBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  }
  return `https://${cfg.s3.bucket}.s3.${cfg.awsRegion}.amazonaws.com/${key}`;
}

module.exports = { getPresignedPutUrl, publicObjectUrl };
