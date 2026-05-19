/** Canonical task statuses stored in DynamoDB */
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

/** Canonical task priorities */
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

/** Human-readable labels (legacy UI / imports) */
const LEGACY_STATUS_MAP = {
  'To Do': 'TODO',
  'In Progress': 'IN_PROGRESS',
  'In Review': 'IN_REVIEW',
  Done: 'DONE',
};

const STATUS_LABELS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const LEGACY_PRIORITY_MAP = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
};

module.exports = {
  TASK_STATUSES,
  TASK_PRIORITIES,
  LEGACY_STATUS_MAP,
  STATUS_LABELS,
  LEGACY_PRIORITY_MAP,
};
