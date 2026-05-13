const commentRepo = require('../services/commentRepository');
const taskService = require('../services/taskService');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../utils/errors');

async function listForTask(req, res, next) {
  try {
    const taskId = req.params.taskId;
    await taskService.getTask(req.auth.profile, taskId);
    const items = await commentRepo.listByTask(taskId);
    res.json(items);
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const { taskId, text } = req.body || {};
    if (!taskId || !text) throw new AppError('taskId and text are required');
    await taskService.getTask(req.auth.profile, taskId);
    const commentId = uuidv4();
    const item = {
      taskId,
      commentId,
      text,
      authorId: req.auth.profile.userId,
      authorName: req.auth.profile.name || req.auth.profile.email,
      createdAt: new Date().toISOString(),
    };
    await commentRepo.createComment(item);
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
}

module.exports = { listForTask, create };
