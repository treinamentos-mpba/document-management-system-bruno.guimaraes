const express = require('express');
const documentRoutes = require('./routes/documentRoutes');
const errorHandler = require('./middleware/errorHandler');
const createRateLimiter = require('./middleware/rateLimiter');
const documentRepository = require('./repositories/localDocumentRepository');

const app = express();
const { port } = require('./config');

app.use(express.json());
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'private, no-store',
  });
  return next();
});
app.use(createRateLimiter({ limit: 120, windowMs: 60 * 1000 }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(documentRoutes);
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint não encontrado.' } });
});
app.use(errorHandler);

if (require.main === module) {
  documentRepository.initialize()
    .then(() => {
      app.listen(port, () => {
        console.log(`DMS backend ouvindo na porta ${port}`);
      });
    })
    .catch((error) => {
      console.error('[DMS] Failed to initialize local storage', error.message);
      process.exitCode = 1;
    });
}

module.exports = app;
