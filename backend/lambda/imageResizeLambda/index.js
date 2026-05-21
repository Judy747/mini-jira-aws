/**
 * Image resize Lambda (Marwan) — triggered by S3 ObjectCreated on the **originals** bucket only.
 *
 * Handles every PUT (new upload and replacement/version). There is no "new vs update" branch:
 * each ObjectCreated event reads the latest object version and overwrites the thumbnail in the
 * resized bucket (resized bucket should NOT have versioning enabled).
 *
 * AWS SETUP:
 *   - Originals bucket: versioning ON
 *   - Resized bucket: versioning OFF (thumbnails overwritten in place)
 *   - Trigger: s3:ObjectCreated:* on originals (Put, Post, Copy, CompleteMultipartUpload)
 *   - Env: RESIZED_BUCKET_NAME
 */
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const s3 = new S3Client({});
const RESIZED_BUCKET = process.env.RESIZED_BUCKET_NAME;
const MAX_WIDTH = Number(process.env.THUMBNAIL_MAX_WIDTH) || 400;

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i;
/** Stable per-task key from s3Service.taskImageKey — no file extension by design. */
const TASK_ATTACHMENT_KEY = /^tasks\/[^/]+\/attachment$/;

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function shouldProcessObject({ sourceBucket, key, contentType }) {
  if (sourceBucket === RESIZED_BUCKET) return false;
  if (TASK_ATTACHMENT_KEY.test(key)) return true;
  if (key.startsWith('attachments/')) {
    return IMAGE_EXT.test(key) || (contentType || '').startsWith('image/');
  }
  return IMAGE_EXT.test(key) || (contentType || '').startsWith('image/');
}

/**
 * Read latest version from originals, write JPEG thumbnail to resized bucket using the **same key**.
 */
async function resizeAndStore({ sourceBucket, key }) {
  if (!RESIZED_BUCKET) {
    throw new Error('RESIZED_BUCKET_NAME is required');
  }

  const obj = await s3.send(new GetObjectCommand({ Bucket: sourceBucket, Key: key }));
  const contentType = obj.ContentType || '';

  if (!shouldProcessObject({ sourceBucket, key, contentType })) {
    return { skipped: true, reason: 'not-image', key };
  }

  const input = await streamToBuffer(obj.Body);
  const thumb = await sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  // Same key as originals → matches DynamoDB thumbnailUrl built in s3Service.publicThumbnailUrl(key)
  await s3.send(
    new PutObjectCommand({
      Bucket: RESIZED_BUCKET,
      Key: key,
      Body: thumb,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=86400',
    })
  );

  return { ok: true, key, resizedBucket: RESIZED_BUCKET, bytes: thumb.length };
}

exports.handler = async (event) => {
  const results = [];
  for (const record of event.Records || []) {
    const sourceBucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const eventName = record.eventName || 'unknown';
    try {
      const out = await resizeAndStore({ sourceBucket, key });
      results.push({ eventName, ...out });
    } catch (err) {
      console.error('[imageResize] failed', { sourceBucket, key, eventName, err });
      throw err;
    }
  }
  return { processed: results.length, results };
};
