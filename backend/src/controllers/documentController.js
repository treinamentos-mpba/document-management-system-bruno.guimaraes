const HttpError = require('../errors/httpError');
const documentService = require('../services/documentService');

async function upload(req, res, next) {
  if (!req.file) {
    return next(new HttpError(400, 'FILE_REQUIRED', 'Envie um arquivo no campo file.'));
  }

  try {
    const document = await documentService.createDocument(req.file, req.userId);
    return res.status(201).json({ document });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (
      !Number.isSafeInteger(offset)
      || offset < 0
      || !Number.isSafeInteger(limit)
      || limit < 1
      || limit > 100
    ) {
      throw new HttpError(400, 'INVALID_PAGINATION', 'Os parâmetros de paginação são inválidos.');
    }

    return res.json(await documentService.listDocuments(req.userId, { offset, limit }));
  } catch (error) {
    return next(error);
  }
}

async function download(req, res, next) {
  try {
    const document = await documentService.getDocumentForDownload(req.params.id, req.userId);
    res.type('application/octet-stream');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, no-store');
    return res.download(document.storagePath, document.originalName, (error) => {
      if (error) {
        return next(res.headersSent
          ? error
          : new HttpError(500, 'FILE_READ_FAILED', 'Não foi possível ler o arquivo.'));
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { download, list, upload };