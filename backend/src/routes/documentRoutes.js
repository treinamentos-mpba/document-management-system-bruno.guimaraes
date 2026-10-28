const express = require('express');
const documentController = require('../controllers/documentController');
const requireUserId = require('../middleware/requireUserId');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/upload', requireUserId, upload.single('file'), documentController.upload);
router.get('/documents', requireUserId, documentController.list);
router.get('/documents/:id/download', requireUserId, documentController.download);

module.exports = router;