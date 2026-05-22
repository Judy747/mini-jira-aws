const activityRepo = require('./activityRepository');
const { AppError } = require('../utils/errors');

async function listAssignmentActivity(profile, { limit } = {}) {
  if (profile.role !== 'MANAGER' && profile.role !== 'ADMIN') {
    throw new AppError('Only managers can view assignment activity', 403);
  }
  const cap = Math.min(Math.max(Number(limit) || 25, 1), 100);
  return activityRepo.listRecent(cap);
}

module.exports = { listAssignmentActivity };
