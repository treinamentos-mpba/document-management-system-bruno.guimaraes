const express = require('express');
const multer = require('multer');
const path = require('node:path');
const createDocumentRoutes = require('./routes/documentRoutes');

const PORT = process.env.PORT || 3000;

function createApp({ storageDirectory = path.join(__dirname, '../storage') } = {}) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(createDocumentRoutes(storageDirectory));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Upload inválido. Use o campo file para um único arquivo.' });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'Requisição inválida.' });
    }
    console.error('Erro ao processar documento:', error);
    res.status(500).json({ error: 'Não foi possível processar o documento.' });
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
