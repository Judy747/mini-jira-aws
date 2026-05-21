const { v4: uuidv4 } = require('uuid');
const taskRepo = require('./taskRepository');
const teamRepo = require('./teamRepository');
const { AppError } = require('../utils/errors');
const { publishMetric } = require('./cloudwatchService');
const { TASK_STATUSES, TASK_PRIORITIES } = require('../utils/constants');
const { normalizeStatus, normalizePriority, serializeTask } = require('../utils/taskNormalizer');
const { publishTaskAssignedEvent } = require('./assignmentEvents');
const { recordStatusChange } = require('./auditService');
const { resolveImageFields, deleteTaskImages } = require('./s3Service');

function assertTaskVisible(profile, task) {
  if (!task) throw new AppError('Task not found', 404);
  if (profile.role === 'MANAGER' || profile.role === 'ADMIN') return;
  if (profile.teamId !== task.teamId) {
    throw new AppError('Cross-team access denied', 403);
  }
}

function parseDueDate(body) {
  const raw = body.dueDate ?? body.deadline;
  if (raw === undefined || raw === null || raw === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new AppError('Invalid dueDate');
  return d.toISOString();
}

/**
 * Tasks that are not done and have a due date strictly before now (UTC).
 * Uses normalized status so legacy rows (e.g. "Done") still behave correctly.
 */
function countOverdueTasks(tasks) {
  const now = Date.now();
  let n = 0;
  for (const t of tasks) {
    const st = normalizeStatus(t.status) || t.status;
    if (st === 'DONE') continue;
    const dueRaw = t.dueDate ?? t.deadline;
    if (!dueRaw) continue;
    const dueMs = new Date(dueRaw).getTime();
    if (Number.isNaN(dueMs)) continue;
    if (dueMs < now) n += 1;
  }
  return n;
}

/**
 * Lists tasks with server-side team scoping. Employees are always restricted to their team.
 * Managers may filter by teamId; without filter, tasks from all teams are aggregated.
 */
async function listTasks(profile, { teamId: queryTeamId, projectId, status } = {}) {
  const normalizedStatus = status ? normalizeStatus(status) : null;
  if (status && !normalizedStatus) {
    throw new AppError('Invalid status filter');
  }

  let items;
  if (profile.role === 'EMPLOYEE') {
    const tid = profile.teamId;
    if (!tid) throw new AppError('Employee missing team', 403);
    items = await taskRepo.queryByTeam(tid, { projectId });
  } else if (queryTeamId) {
    items = await taskRepo.queryByTeam(queryTeamId, { projectId });
  } else {
    const teams = await teamRepo.listTeams();
    const chunks = await Promise.all(
      teams.map((t) => taskRepo.queryByTeam(t.teamId, { projectId }))
    );
    items = chunks.flat();
  }
  if (normalizedStatus) {
    items = items.filter((t) => normalizeStatus(t.status) === normalizedStatus);
  }
  return items.map(serializeTask);
}

async function getTask(profile, taskId) {
  const task = await taskRepo.getById(taskId);
  assertTaskVisible(profile, task);
  return serializeTask(task);
}

async function createTask(profile, body) {
  if (profile.role !== 'MANAGER' && profile.role !== 'ADMIN') {
    throw new AppError('Only managers can create tasks', 403);
  }
  const {
    title,
    description,
    priority,
    status,
    assigneeId,
    teamId,
    projectId,
    imageUrl,
    imageKey,
    thumbnailUrl,
  } = body || {};

  if (!title?.trim() || !teamId?.trim() || !projectId?.trim()) {
    throw new AppError('title, teamId, and projectId are required');
  }

  const st = normalizeStatus(status) || 'TODO';
  if (!TASK_STATUSES.includes(st)) throw new AppError('Invalid status');

  const pr = normalizePriority(priority) || 'MEDIUM';
  if (!TASK_PRIORITIES.includes(pr)) throw new AppError('Invalid priority');

  const now = new Date().toISOString();
  const taskId = uuidv4();
  const images = resolveImageFields({ imageUrl, imageKey, thumbnailUrl });
  const item = {
    taskId,
    title: title.trim(),
    description: (description || '').trim(),
    priority: pr,
    status: st,
    dueDate: parseDueDate(body),
    assigneeId: assigneeId?.trim() || null,
    teamId: teamId.trim(),
    projectId: projectId.trim(),
    imageKey: images.imageKey,
    imageUrl: images.imageUrl,
    thumbnailUrl: images.thumbnailUrl,
    createdBy: profile.userId,
    createdAt: now,
    updatedAt: now,
  };
  await taskRepo.putTask(item);
  await publishMetric('TasksCreated', 1);
  if (item.assigneeId) {
    publishTaskAssignedEvent({
      taskId: item.taskId,
      title: item.title,
      teamId: item.teamId,
      assigneeId: item.assigneeId,
      assignedBy: profile.userId,
    });
  }
  return serializeTask(item);
}

async function updateTask(profile, taskId, body) {
  const existing = await taskRepo.getById(taskId);
  assertTaskVisible(profile, existing);

  const isPrivileged = profile.role === 'MANAGER' || profile.role === 'ADMIN';
  const patch = { ...body };
  delete patch.taskId;
  delete patch.createdAt;
  delete patch.createdBy;

  if (patch.deadline !== undefined && patch.dueDate === undefined) {
    patch.dueDate = patch.deadline;
  }
  delete patch.deadline;

  if (!isPrivileged) {
    const allowed = ['status', 'imageUrl', 'imageKey', 'thumbnailUrl'];
    for (const k of Object.keys(patch)) {
      if (!allowed.includes(k)) delete patch[k];
    }
  }

  if (
    patch.imageUrl !== undefined ||
    patch.imageKey !== undefined ||
    patch.thumbnailUrl !== undefined
  ) {
    const merged = resolveImageFields({
      imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : existing.imageUrl,
      imageKey: patch.imageKey !== undefined ? patch.imageKey : existing.imageKey,
      thumbnailUrl:
        patch.thumbnailUrl !== undefined ? patch.thumbnailUrl : existing.thumbnailUrl,
    });
    patch.imageKey = merged.imageKey;
    patch.imageUrl = merged.imageUrl;
    patch.thumbnailUrl = merged.thumbnailUrl;
    if (patch.imageUrl === null) {
      patch.imageKey = null;
      patch.thumbnailUrl = null;
    }
  }

  if (patch.status !== undefined) {
    const st = normalizeStatus(patch.status);
    if (!st || !TASK_STATUSES.includes(st)) throw new AppError('Invalid status');
    patch.status = st;
  }

  if (patch.priority !== undefined) {
    const pr = normalizePriority(patch.priority);
    if (!pr || !TASK_PRIORITIES.includes(pr)) throw new AppError('Invalid priority');
    patch.priority = pr;
  }

  if (patch.dueDate !== undefined || patch.deadline !== undefined) {
    patch.dueDate = parseDueDate(patch);
  }

  if (patch.title !== undefined) {
    if (!String(patch.title).trim()) throw new AppError('title cannot be empty');
    patch.title = String(patch.title).trim();
  }

  if (
    !isPrivileged &&
    patch.status === undefined &&
    patch.imageUrl === undefined &&
    patch.imageKey === undefined
  ) {
    throw new AppError('No permitted fields to update', 400);
  }

  const oldStatus = normalizeStatus(existing.status) || existing.status;

  if (patch.assigneeId !== undefined) {
    patch.assigneeId = patch.assigneeId?.trim() || null;
  }

  const next = {
    ...existing,
    ...patch,
    taskId,
    updatedAt: new Date().toISOString(),
  };
  await taskRepo.putTask(next);

  const newStatus = normalizeStatus(next.status) || next.status;
  if (patch.status !== undefined && oldStatus !== newStatus) {
    await recordStatusChange({
      taskId,
      changedBy: profile.userId,
      fromStatus: oldStatus,
      toStatus: newStatus,
    });
  }

  const assigneeChanged =
    patch.assigneeId !== undefined &&
    next.assigneeId &&
    next.assigneeId !== existing.assigneeId;
  if (assigneeChanged) {
    publishTaskAssignedEvent({
      taskId: next.taskId,
      title: next.title,
      teamId: next.teamId,
      assigneeId: next.assigneeId,
      assignedBy: profile.userId,
    });
  }

  if (oldStatus !== 'DONE' && newStatus === 'DONE') {
    await publishMetric('TasksCompleted', 1);
    await publishMetric(
      'TasksCompletedPerTeam',
      1,
      [{ Name: 'Team', Value: String(next.teamId || 'unknown') }]
    );
  }

  return serializeTask(next);
}

async function removeTask(profile, taskId) {
  if (profile.role !== 'MANAGER' && profile.role !== 'ADMIN') {
    throw new AppError('Only managers can delete tasks', 403);
  }
  const existing = await taskRepo.getById(taskId);
  assertTaskVisible(profile, existing);
  if (existing.imageKey) {
    await deleteTaskImages(existing.imageKey);
  }
  await taskRepo.deleteTask(taskId);
}

/** Dashboard aggregates — counts and recent items */
async function getTaskSummary(profile, { teamId: queryTeamId } = {}) {
  const tasks = await listTasks(profile, { teamId: queryTeamId });
  const overdueCount = countOverdueTasks(tasks);
  await publishMetric('OverdueTasks', overdueCount);

  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'DONE').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    inReview: tasks.filter((t) => t.status === 'IN_REVIEW').length,
    todo: tasks.filter((t) => t.status === 'TODO').length,
  };
  const recentTasks = [...tasks]
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 8);
  const recentActivity = [...tasks]
    .filter((t) => t.updatedAt && t.updatedAt !== t.createdAt)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 10)
    .map((t) => ({
      type: 'task_updated',
      taskId: t.taskId,
      title: t.title,
      status: t.status,
      teamId: t.teamId,
      at: t.updatedAt,
    }));
  return { stats, recentTasks, recentActivity };
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  removeTask,
  getTaskSummary,
  TASK_STATUSES,
  TASK_PRIORITIES,
};
