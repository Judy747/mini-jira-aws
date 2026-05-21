const {
  getPresignedPutUrl,
  publicOriginalUrl,
  publicThumbnailUrl,
  buildUploadKey,
} = require('../services/s3Service');
const { AppError } = require('../utils/errors');

async function presign(req, res, next) {
  try {
    const { filename, contentType, taskId } = req.body || {};
    if (!filename) throw new AppError('filename is required');
    const key = buildUploadKey({
      taskId,
      userId: req.auth.profile.userId,
      filename,
    });
    const { uploadUrl, method } = await getPresignedPutUrl({ key, contentType });
    const thumbnailUrl = publicThumbnailUrl(key);
    res.json({
      method,
      uploadUrl,
      key,
      publicUrl: publicOriginalUrl(key),
      thumbnailUrl,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { presign };
