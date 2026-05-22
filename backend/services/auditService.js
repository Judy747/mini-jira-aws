const { v4: uuidv4 } = require('uuid');
const auditRepo = require('./auditRepository');
const userRepo = require('./userRepository');

/**
 * Persist a status transition audit row (called after task update succeeds).
 */
async function recordStatusChange({ taskId, changedBy, fromStatus, toStatus }) {
  const changedAt = new Date().toISOString();
  const item = {
    auditId: uuidv4(),
    taskId,
    changedBy,
    fromStatus,
    toStatus,
    changedAt,
  };
  await auditRepo.createEntry(item);
  return item;
}

/**
 * List audit rows for a task, newest first, with display names for changedBy.
 * Authorization is enforced by the controller via taskService.getTask first.
 */
async function listEntriesForTask(taskId) {
  const items = await auditRepo.listByTask(taskId);
  items.sort((a, b) => (b.changedAt || '').localeCompare(a.changedAt || ''));

  const userCache = {};
  return Promise.all(
    items.map(async (row) => {
      let changedByName = row.changedBy;
      if (row.changedBy) {
        if (!userCache[row.changedBy]) {
          const u = await userRepo.getById(row.changedBy);
          userCache[row.changedBy] = u?.name || u?.email || row.changedBy;
        }
        changedByName = userCache[row.changedBy];
      }
      return { ...row, changedByName };
    })
  );
}

async function deleteEntriesForTask(taskId) {
  await auditRepo.deleteByTask(taskId);
}

module.exports = { recordStatusChange, listEntriesForTask, deleteEntriesForTask };
