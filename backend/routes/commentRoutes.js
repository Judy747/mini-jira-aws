const { Router } = require('express');
const commentController = require('../controllers/commentController');

const r = Router();
r.get('/:taskId', commentController.listForTask);
r.post('/', commentController.create);

module.exports = r;
