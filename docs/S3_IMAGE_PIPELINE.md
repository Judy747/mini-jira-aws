# S3 image pipeline (Marwan)

Task attachments use two buckets and a resize Lambda. This document covers **application behavior**; bucket/Lambda creation is done in the AWS console or IaC during deployment.

## Buckets

| Bucket | Env var | Purpose |
|--------|---------|---------|
| Originals | `S3_BUCKET_NAME` | User uploads via presigned PUT. **Enable versioning** so replacing an image keeps prior versions under the same key. |
| Resized | `S3_RESIZED_BUCKET_NAME` | Thumbnails written by `backend/lambda/imageResizeLambda`. **Do not enable versioning** — each resize overwrites the thumbnail in place. |

Public URLs (optional CloudFront):

- `S3_PUBLIC_BASE_URL` — originals
- `S3_RESIZED_PUBLIC_BASE_URL` — thumbnails

## Object keys

- Per task (recommended): `tasks/{taskId}/attachment` — stable key; a new upload creates a **new S3 version** when versioning is on.
- Ad-hoc (no `taskId` in presign): `attachments/{userId}/{uuid}-{filename}`

## DynamoDB (`Tasks` table)

| Field | Description |
|-------|-------------|
| `imageKey` | S3 key in the originals bucket (source of truth) |
| `imageUrl` | Public URL for the full image |
| `thumbnailUrl` | Public URL for the thumbnail (same key in resized bucket) |

The API normalizes these on create/update via `resolveImageFields` in `backend/services/s3Service.js`.

## Upload flow

1. Client calls `POST /uploads/presign` with `{ filename, contentType, taskId? }`.
2. Client `PUT`s the file to `uploadUrl` (browser → S3; requires **CORS** on originals — see `infra/s3-cors-originals.json`).
3. S3 emits `ObjectCreated` (new upload **or** replacement PUT) → **image resize Lambda** reads the latest version and writes a JPEG thumbnail to the resized bucket using the **same key** as originals.
4. Client `PUT /tasks/:id` with `{ imageUrl, imageKey, thumbnailUrl }` from presign. `thumbnailUrl` is precomputed (`publicThumbnailUrl(key)`) so DynamoDB matches where Lambda will write; the file may 404 for a few seconds until Lambda finishes.

## Replace image

Upload again with the same `taskId` in presign → PUT to `tasks/{taskId}/attachment` → new **version** in originals; DynamoDB URLs updated; Lambda regenerates thumbnail.

## Delete task

When a manager deletes a task (`DELETE /tasks/:id`):

- The API calls `DeleteObject` **without** a `VersionId` (never bulk-deletes all versions).
- **Originals (versioned):** delete marker on the current version; **older versions remain**.
- **Resized (not versioned):** thumbnail object is removed.

To permanently purge all versions, use S3 lifecycle rules or manual version cleanup in AWS (not required for the assignment demo).

## Lambda deploy (AWS phase)

```bash
cd backend/lambda/imageResizeLambda
npm ci --omit=dev
# Package for Lambda (Amazon Linux 2023 / Node 20 x86_64), then upload zip.
```

Environment:

- `RESIZED_BUCKET_NAME` — thumbnails bucket name
- Optional: `THUMBNAIL_MAX_WIDTH` (default `400`)

IAM: `s3:GetObject` on originals `/*`, `s3:PutObject` on resized `/*`.

Trigger: S3 event on originals bucket, event type `s3:ObjectCreated:*`, prefix optional `tasks/` and `attachments/`.

## CORS (originals bucket)

`infra/s3-cors-originals.json` allows **GET, PUT, HEAD** (PUT is required for presigned browser uploads; POST is not used).

Apply and replace `YOUR_CLOUDFRONT_DOMAIN` with your frontend CloudFront hostname:

```bash
aws s3api put-bucket-cors --bucket YOUR_ORIGINALS_BUCKET --cors-configuration file://infra/s3-cors-originals.json
```

## Acceptance checklist

- [ ] Upload on a task → object in originals; thumbnail appears in resized bucket (same key).
- [ ] Replace image on same task → two versions visible in originals (versioning tab in S3 console).
- [ ] Delete task → current image + thumbnail removed; older versions still in originals if versioning was on.
