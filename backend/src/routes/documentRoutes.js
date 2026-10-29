const { Router } = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const createDocumentController = require('../controllers/documentController');
const createDocumentService = require('../services/documentService');
const createDocumentRepository = require('../repositories/documentRepository');

function createDocumentRoutes(storageDirectory) {
  const router = Router();
  const repository = createDocumentRepository(storageDirectory);
  const controller = createDocumentController(createDocumentService(repository));
  const upload = multer({
    storage: multer.diskStorage({
      destination: storageDirectory,
      filename(req, file, callback) {
        callback(null, randomUUID());
      },
    }),
  });

  router.post('/upload', upload.single('file'), controller.upload);
  router.get('/documents', controller.list);
  router.get('/documents/:id/download', controller.download);
  return router;
}

module.exports = createDocumentRoutes;
