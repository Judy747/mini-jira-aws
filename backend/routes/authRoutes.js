const { Router } = require('express');
const authController = require('../controllers/authController');

const r = Router();
r.post('/login', authController.login);
r.post('/register', authController.register);
r.post('/confirm', authController.confirm);
r.post('/resend-code', authController.resendCode);

module.exports = r;
