const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/aiController');

router.post('/chat', handleChat);

module.exports = router;
