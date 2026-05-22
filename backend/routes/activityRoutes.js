const express = require('express');
const activityController = require('../controllers/activityController');

const router = express.Router();

router.get('/', activityController.list);

module.exports = router;
