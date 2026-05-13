const { Router } = require('express');
const taskController = require('../controllers/taskController');

const r = Router();
r.get('/', taskController.list);
r.get('/:id', taskController.getOne);
r.post('/', taskController.create);
r.put('/:id', taskController.update);
r.delete('/:id', taskController.remove);

module.exports = r;
