const {
  TASK_STATUSES,
  TASK_PRIORITIES,
  LEGACY_STATUS_MAP,
  LEGACY_PRIORITY_MAP,
} = require('./constants');

function normalizeStatus(value) {
  if (!value) return null;
  if (TASK_STATUSES.includes(value)) return value;
  return LEGACY_STATUS_MAP[value] || null;
}

function normalizePriority(value) {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  if (TASK_PRIORITIES.includes(upper)) return upper;
  return LEGACY_PRIORITY_MAP[value] || null;
}

/** API response shape: canonical enums + dueDate alias */
function serializeTask(item) {
  if (!item) return null;
  const status = normalizeStatus(item.status) || item.status;
  const priority = normalizePriority(item.priority) || item.priority || 'MEDIUM';
  return {
    ...item,
    status,
    priority,
    dueDate: item.dueDate ?? item.deadline ?? null,
    createdBy: item.createdBy ?? item.ownerId ?? null,
    imageKey: item.imageKey ?? null,
    imageUrl: item.imageUrl ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
  };
}

module.exports = { normalizeStatus, normalizePriority, serializeTask };
