/** Canonical API enums — must match backend utils/constants.js */
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH']

export const STATUS_LABELS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
}

export const PRIORITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

/** Kanban column order (droppableId = status enum) */
export const KANBAN_COLUMNS = TASK_STATUSES

export function statusLabel(status) {
  return STATUS_LABELS[status] || status
}

export function priorityLabel(priority) {
  return PRIORITY_LABELS[priority] || priority
}

export function priorityVariant(priority) {
  if (priority === 'HIGH') return 'destructive'
  if (priority === 'LOW') return 'secondary'
  return 'outline'
}
