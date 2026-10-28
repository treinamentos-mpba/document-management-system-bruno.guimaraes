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

function list(req, res, next) {
  try {
    return res.json({ documents: documentService.listDocuments(req.userId) });
  } catch (error) {
    return next(error);
  }
}

function download(req, res, next) {
  let document;
  try {
    document = documentService.getDocumentForDownload(req.params.id, req.userId);
  } catch (error) {
    return next(error);
  }

  res.type(document.mimeType || 'application/octet-stream');
  return res.download(document.storagePath, document.originalName, (error) => {
    if (error) {
      return next(res.headersSent
        ? error
        : new HttpError(500, 'FILE_READ_FAILED', 'Não foi possível ler o arquivo.'));
    }
  });
}

module.exports = { download, list, upload };