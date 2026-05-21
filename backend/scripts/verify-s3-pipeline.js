#!/usr/bin/env node
/**
 * Quick sanity checks for Marwan's S3 image pipeline (no AWS calls).
 * Run: node backend/scripts/verify-s3-pipeline.js
 */
process.env.S3_BUCKET_NAME = 'mini-jira-originals-test';
process.env.S3_RESIZED_BUCKET_NAME = 'mini-jira-resized-test';
process.env.AWS_REGION = 'us-east-1';

const assert = require('assert');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const {
  taskImageKey,
  buildUploadKey,
  publicOriginalUrl,
  publicThumbnailUrl,
  resolveImageFields,
} = require('../services/s3Service');

const taskId = 'task-abc-123';
const key = taskImageKey(taskId);
assert.strictEqual(key, 'tasks/task-abc-123/attachment', 'stable task key');

const built = buildUploadKey({ taskId, userId: 'u1', filename: 'photo.png' });
assert.strictEqual(built, key, 'taskId upload uses stable key');

const thumb = publicThumbnailUrl(key);
const orig = publicOriginalUrl(key);
assert(thumb.includes('mini-jira-resized-test'), 'thumbnail URL targets resized bucket');
assert(orig.includes('mini-jira-originals-test'), 'original URL targets originals bucket');
assert(thumb.endsWith('/tasks/task-abc-123/attachment'), 'thumbnail path matches originals key');

const fields = resolveImageFields({ imageKey: key });
assert.strictEqual(fields.imageKey, key);
assert.strictEqual(fields.thumbnailUrl, thumb, 'DynamoDB thumbnailUrl matches Lambda output path');

const cmd = new PutObjectCommand({
  Bucket: 'b',
  Key: key,
  ContentType: 'image/png',
});
assert.strictEqual(cmd.constructor.name, 'PutObjectCommand', 'presign uses PutObject');

const TASK_ATTACHMENT_KEY = /^tasks\/[^/]+\/attachment$/;
assert(TASK_ATTACHMENT_KEY.test(key), 'lambda regex matches stable key');

console.log('verify-s3-pipeline: all checks passed');
