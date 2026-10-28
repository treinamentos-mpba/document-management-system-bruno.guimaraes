const express = require('express');
const documentRoutes = require('./routes/documentRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const { port } = require('./config');

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(documentRoutes);
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint não encontrado.' } });
});
app.use(errorHandler);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`DMS backend ouvindo na porta ${port}`);
  });
}

module.exports = app;
