const taskService = require('../services/taskService');
const { AppError } = require('../utils/errors');

async function list(req, res, next) {
  try {
    const { teamId, projectId, status } = req.query;
    const tasks = await taskService.listTasks(req.auth.profile, {
      teamId,
      projectId,
      status,
    });
    tasks.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    res.json(tasks);
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const task = await taskService.getTask(req.auth.profile, req.params.id);
    res.json(task);
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const task = await taskService.createTask(req.auth.profile, req.body);
    res.status(201).json(task);
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const task = await taskService.updateTask(req.auth.profile, req.params.id, req.body);
    res.json(task);
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    await taskService.removeTask(req.auth.profile, req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne, create, update, remove };
