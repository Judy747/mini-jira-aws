const { Router } = require('express');
const projectController = require('../controllers/projectController');

const r = Router();
r.get('/', projectController.list);
r.get('/:id', projectController.getOne);
r.post('/', projectController.create);
r.put('/:id', projectController.update);
r.delete('/:id', projectController.remove);

module.exports = r;
