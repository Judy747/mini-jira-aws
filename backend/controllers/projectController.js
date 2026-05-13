const projectRepo = require('../services/projectRepository');
const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

async function list(req, res, next) {
  try {
    const { teamId } = req.query;
    const profile = req.auth.profile;
    let items;
    if (profile.role === 'MANAGER' || profile.role === 'ADMIN') {
      if (teamId) {
        items = await projectRepo.listByTeam(teamId);
      } else {
        items = await projectRepo.listAllProjects();
      }
    } else {
      if (!profile.teamId) throw new AppError('Employee missing team', 403);
      items = await projectRepo.listByTeam(profile.teamId);
    }
    res.json(items);
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    if (req.auth.profile.role !== 'MANAGER' && req.auth.profile.role !== 'ADMIN') {
      throw new AppError('Only managers can create projects', 403);
    }
    const { name, description, teamId } = req.body || {};
    if (!name || !teamId) throw new AppError('name and teamId are required');
    const projectId = uuidv4();
    const now = new Date().toISOString();
    const item = {
      projectId,
      name,
      description: description || '',
      teamId,
      ownerId: req.auth.profile.userId,
      createdAt: now,
    };
    await projectRepo.putProject(item);
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    if (req.auth.profile.role !== 'MANAGER' && req.auth.profile.role !== 'ADMIN') {
      throw new AppError('Only managers can update projects', 403);
    }
    const existing = await projectRepo.getById(req.params.id);
    if (!existing) throw new AppError('Project not found', 404);
    const { name, description, teamId } = req.body || {};
    const next = {
      ...existing,
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(teamId !== undefined ? { teamId } : {}),
    };
    await projectRepo.putProject(next);
    res.json(next);
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    if (req.auth.profile.role !== 'MANAGER' && req.auth.profile.role !== 'ADMIN') {
      throw new AppError('Only managers can delete projects', 403);
    }
    const existing = await projectRepo.getById(req.params.id);
    if (!existing) throw new AppError('Project not found', 404);
    await projectRepo.deleteProject(req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

module.exports = { list, create, update, remove };
