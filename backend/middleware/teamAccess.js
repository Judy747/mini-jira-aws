const { AppError } = require('../utils/errors');

/** Employees may only ever read/write data for their own team */
function assertTeamAccess(profile, teamId) {
  if (profile.role === 'MANAGER' || profile.role === 'ADMIN') return;
  if (!profile.teamId) {
    throw new AppError('Employee account missing teamId', 403);
  }
  if (profile.teamId !== teamId) {
    throw new AppError('Cross-team access denied', 403);
  }
}

module.exports = { assertTeamAccess };
