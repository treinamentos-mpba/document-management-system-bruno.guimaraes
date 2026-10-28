const fs = require('node:fs/promises');
const path = require('node:path');
const repository = require('../repositories/inMemoryDocumentRepository');
const HttpError = require('../errors/httpError');

function toPublicDocument(document) {
  const { storagePath, mimeType, ...publicDocument } = document;
  return publicDocument;
}

async function createDocument(file, owner) {
  const document = {
    id: file.filename,
    originalName: path.basename(file.originalname.replace(/\\/g, '/')),
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    storagePath: file.path,
    mimeType: file.mimetype,
  };

  try {
    repository.create(document);
  } catch (error) {
    await fs.unlink(file.path).catch(() => {});
    throw error;
  }

  return toPublicDocument(document);
}

function listDocuments(owner) {
  return repository.findByOwner(owner).map(toPublicDocument);
}

function getDocumentForDownload(id, owner) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_DOCUMENT_ID', 'O identificador do documento é inválido.');
  }

  const document = repository.findById(id);
  if (!document || document.owner !== owner) {
    throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }

  return document;
}

module.exports = { createDocument, getDocumentForDownload, listDocuments };