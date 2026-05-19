const projectService = require('../services/projectService');

async function list(req, res, next) {
  try {
    const items = await projectService.listProjects(req.auth.profile, req.query);
    res.json(items);
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const item = await projectService.getProject(req.auth.profile, req.params.id);
    res.json(item);
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const item = await projectService.createProject(req.auth.profile, req.body);
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const item = await projectService.updateProject(req.auth.profile, req.params.id, req.body);
    res.json(item);
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    await projectService.removeProject(req.auth.profile, req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne, create, update, remove };
