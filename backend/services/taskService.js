const { v4: uuidv4 } = require('uuid');
const taskRepo = require('../services/taskRepository');
const teamRepo = require('../services/teamRepository');
const { AppError } = require('../utils/errors');

const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];

function assertTaskVisible(profile, task) {
  if (!task) throw new AppError('Task not found', 404);
  if (profile.role === 'MANAGER' || profile.role === 'ADMIN') return;
  if (profile.teamId !== task.teamId) {
    throw new AppError('Cross-team access denied', 403);
  }
}

/**
 * Lists tasks with server-side team scoping. Employees are always restricted to their team.
 * Managers may filter by teamId; without filter, tasks from all teams are aggregated.
 */
async function listTasks(profile, { teamId: queryTeamId, projectId, status }) {
  if (status && !STATUSES.includes(status)) {
    throw new AppError('Invalid status filter');
  }
  if (profile.role === 'EMPLOYEE') {
    const tid = profile.teamId;
    if (!tid) throw new AppError('Employee missing team', 403);
    return taskRepo.queryByTeam(tid, { projectId, status });
  }
  if (queryTeamId) {
    return taskRepo.queryByTeam(queryTeamId, { projectId, status });
  }
  const teams = await teamRepo.listTeams();
  const chunks = await Promise.all(
    teams.map((t) => taskRepo.queryByTeam(t.teamId, { projectId, status }))
  );
  return chunks.flat();
}

async function getTask(profile, taskId) {
  const task = await taskRepo.getById(taskId);
  assertTaskVisible(profile, task);
  return task;
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
    deadline,
    assigneeId,
    teamId,
    projectId,
    imageUrl,
  } = body;
  if (!title || !teamId || !projectId) {
    throw new AppError('title, teamId, and projectId are required');
  }
  const st = status && STATUSES.includes(status) ? status : 'To Do';
  const now = new Date().toISOString();
  const taskId = uuidv4();
  const item = {
    taskId,
    title,
    description: description || '',
    priority: priority || 'Medium',
    status: st,
    deadline: deadline || null,
    assigneeId: assigneeId || null,
    teamId,
    projectId,
    imageUrl: imageUrl || null,
    createdAt: now,
    updatedAt: now,
  };
  await taskRepo.putTask(item);
  return item;
}

async function updateTask(profile, taskId, body) {
  const existing = await taskRepo.getById(taskId);
  assertTaskVisible(profile, existing);

  const isPrivileged = profile.role === 'MANAGER' || profile.role === 'ADMIN';
  const patch = { ...body };
  delete patch.taskId;
  delete patch.createdAt;

  if (!isPrivileged) {
    const allowed = ['status', 'imageUrl'];
    for (const k of Object.keys(patch)) {
      if (!allowed.includes(k)) delete patch[k];
    }
    if (patch.status && !STATUSES.includes(patch.status)) {
      throw new AppError('Invalid status');
    }
  } else {
    if (patch.status && !STATUSES.includes(patch.status)) {
      throw new AppError('Invalid status');
    }
  }

  if (!isPrivileged && patch.status === undefined && patch.imageUrl === undefined) {
    throw new AppError('No permitted fields to update', 400);
  }

  const next = {
    ...existing,
    ...patch,
    taskId,
    updatedAt: new Date().toISOString(),
  };
  await taskRepo.putTask(next);
  return next;
}

async function removeTask(profile, taskId) {
  if (profile.role !== 'MANAGER' && profile.role !== 'ADMIN') {
    throw new AppError('Only managers can delete tasks', 403);
  }
  const existing = await taskRepo.getById(taskId);
  assertTaskVisible(profile, existing);
  await taskRepo.deleteTask(taskId);
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  removeTask,
  STATUSES,
};
