const { Router } = require('express');
const auditController = require('../controllers/auditController');

const r = Router();
r.get('/:taskId', auditController.listForTask);

module.exports = r;
