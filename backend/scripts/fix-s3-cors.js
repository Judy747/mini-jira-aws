/**
 * One-shot: replace the originals bucket CORS config with the correct
 * AllowedOrigins (real CloudFront + localhost for dev). Safe to re-run.
 *
 * Usage (from backend/):
 *   node scripts/fix-s3-cors.js
 *
 * Override the bucket name with $env:S3_BUCKET_NAME, the CloudFront origin
 * with $env:CLOUDFRONT_ORIGIN.
 */
require('dotenv').config();
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET_NAME || 'mini-jira-originals-744683930574-us-east-1-an';
const CF_ORIGIN = process.env.CLOUDFRONT_ORIGIN || 'https://d2qic2nqco9xo5.cloudfront.net';

const s3 = new S3Client({ region: REGION });

const CORS = {
  CORSRules: [
    {
      AllowedMethods: ['GET', 'PUT', 'HEAD'],
      AllowedOrigins: [CF_ORIGIN, 'http://localhost:5173'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000,
    },
  ],
};

(async () => {
  console.log(`Bucket: ${BUCKET}`);
  console.log('Applying CORS:');
  console.log(JSON.stringify(CORS, null, 2));
  await s3.send(new PutBucketCorsCommand({ Bucket: BUCKET, CORSConfiguration: CORS }));
  console.log('\nVerifying...');
  const r = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
  console.log(JSON.stringify(r.CORSRules, null, 2));
  console.log('\nDone.');
})().catch((e) => {
  console.error(`${e.name}: ${e.message}`);
  process.exit(1);
});
