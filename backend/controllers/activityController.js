const activityService = require('../services/activityService');

async function list(req, res, next) {
  try {
    const items = await activityService.listAssignmentActivity(req.auth.profile, {
      limit: req.query.limit,
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
}

module.exports = { list };
