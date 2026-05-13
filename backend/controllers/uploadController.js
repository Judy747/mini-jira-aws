const { getPresignedPutUrl, publicObjectUrl } = require('../services/s3Service');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../utils/errors');

async function presign(req, res, next) {
  try {
    const { filename, contentType } = req.body || {};
    if (!filename) throw new AppError('filename is required');
    const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `attachments/${req.auth.profile.userId}/${uuidv4()}-${safe}`;
    const uploadUrl = await getPresignedPutUrl({ key, contentType });
    res.json({ uploadUrl, key, publicUrl: publicObjectUrl(key) });
  } catch (e) {
    next(e);
  }
}

module.exports = { presign };
