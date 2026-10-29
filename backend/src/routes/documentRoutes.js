const express = require('express');
const authController = require('../controllers/authController');
const documentController = require('../controllers/documentController');
const requireUserId = require('../middleware/requireUserId');
const createRateLimiter = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

const router = express.Router();
const loginRateLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 1000, code: 'LOGIN_RATE_LIMITED' });
const uploadRateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000, code: 'UPLOAD_RATE_LIMITED' });

router.get('/auth/mode', authController.mode);
router.post('/auth/login', loginRateLimiter, authController.login);

router.post('/upload', requireUserId, uploadRateLimiter, upload.single('file'), documentController.upload);
router.get('/documents', requireUserId, documentController.list);
router.get('/documents/:id/download', requireUserId, documentController.download);

module.exports = router;