const { v4: uuidv4 } = require('uuid');
const projectRepo = require('./projectRepository');
const { AppError } = require('../utils/errors');

function assertProjectVisible(profile, project) {
  if (!project) throw new AppError('Project not found', 404);
  if (profile.role === 'MANAGER' || profile.role === 'ADMIN') return;
  if (profile.teamId !== project.teamId) {
    throw new AppError('Cross-team access denied', 403);
  }
}

function serializeProject(item) {
  if (!item) return null;
  return {
    ...item,
    createdBy: item.createdBy ?? item.ownerId ?? null,
  };
}

async function listProjects(profile, { teamId: queryTeamId } = {}) {
  let items;
  if (profile.role === 'MANAGER' || profile.role === 'ADMIN') {
    items = queryTeamId
      ? await projectRepo.listByTeam(queryTeamId)
      : await projectRepo.listAllProjects();
  } else {
    if (!profile.teamId) throw new AppError('Employee missing team', 403);
    items = await projectRepo.listByTeam(profile.teamId);
  }
  return items.map(serializeProject);
}

async function getProject(profile, projectId) {
  const project = await projectRepo.getById(projectId);
  assertProjectVisible(profile, project);
  return serializeProject(project);
}

async function createProject(profile, body) {
  if (profile.role !== 'MANAGER' && profile.role !== 'ADMIN') {
    throw new AppError('Only managers can create projects', 403);
  }
  const { name, description, teamId } = body || {};
  if (!name?.trim() || !teamId?.trim()) {
    throw new AppError('name and teamId are required');
  }
  const projectId = uuidv4();
  const now = new Date().toISOString();
  const item = {
    projectId,
    name: name.trim(),
    description: (description || '').trim(),
    teamId: teamId.trim(),
    createdBy: profile.userId,
    createdAt: now,
  };
  await projectRepo.putProject(item);
  return serializeProject(item);
}

async function updateProject(profile, projectId, body) {
  if (profile.role !== 'MANAGER' && profile.role !== 'ADMIN') {
    throw new AppError('Only managers can update projects', 403);
  }
  const existing = await projectRepo.getById(projectId);
  assertProjectVisible(profile, existing);
  const { name, description, teamId } = body || {};
  const next = {
    ...existing,
    ...(name !== undefined ? { name: String(name).trim() } : {}),
    ...(description !== undefined ? { description: String(description).trim() } : {}),
    ...(teamId !== undefined ? { teamId: String(teamId).trim() } : {}),
  };
  if (!next.name) throw new AppError('name cannot be empty');
  if (!next.teamId) throw new AppError('teamId cannot be empty');
  await projectRepo.putProject(next);
  return serializeProject(next);
}

async function removeProject(profile, projectId) {
  if (profile.role !== 'MANAGER' && profile.role !== 'ADMIN') {
    throw new AppError('Only managers can delete projects', 403);
  }
  const existing = await projectRepo.getById(projectId);
  assertProjectVisible(profile, existing);
  await projectRepo.deleteProject(projectId);
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  removeProject,
};
