const multer = require('multer');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    const status = tooLarge ? 413 : 400;
    const code = tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD';
    const message = tooLarge ? 'O arquivo excede o tamanho máximo permitido.' : 'Não foi possível processar o upload.';

    return res.status(status).json({ error: { code, message } });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = status === 500 ? 'Ocorreu um erro interno.' : error.message;

  return res.status(status).json({ error: { code, message } });
}

module.exports = errorHandler;