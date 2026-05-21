const auditService = require('../services/auditService');
const taskService = require('../services/taskService');

async function listForTask(req, res, next) {
  try {
    const { taskId } = req.params;
    await taskService.getTask(req.auth.profile, taskId);
    const items = await auditService.listEntriesForTask(taskId);
    res.json(items);
  } catch (e) {
    next(e);
  }
}

module.exports = { listForTask };
