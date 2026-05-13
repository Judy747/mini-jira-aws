const { Router } = require('express');
const userController = require('../controllers/userController');
const uploadController = require('../controllers/uploadController');
const { requireRoles } = require('../middleware/auth');

const r = Router();

r.get('/users', requireRoles('MANAGER', 'ADMIN'), userController.listUsers);
r.get('/teams', userController.listTeams);
r.post('/teams', requireRoles('ADMIN'), userController.createTeam);
r.post('/users', requireRoles('ADMIN'), userController.createUser);
r.post('/uploads/presign', uploadController.presign);

module.exports = r;
