const path = require('node:path');
const repository = require('../repositories/localDocumentRepository');
const HttpError = require('../errors/httpError');
const { storageDirectory } = require('../config');
const documentQuotaService = require('./documentQuotaService');
const localDocumentStorageService = require('./localDocumentStorageService');

function toPublicDocument(document) {
  const { storagePath, mimeType, ...publicDocument } = document;
  return publicDocument;
}

async function createDocument(file, owner) {
  try {
    return await documentQuotaService.withAvailableQuota(owner, file.size, async () => {
      await localDocumentStorageService.prepareUpload(file.path);
      const originalName = path.basename(file.originalname.replace(/\\/g, '/')) || 'documento';
      if (Buffer.byteLength(originalName) > 255) {
        throw new HttpError(400, 'INVALID_FILE_NAME', 'O nome do arquivo não pode exceder 255 bytes.');
      }

      const document = {
        id: file.filename,
        originalName,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        owner,
        storagePath: path.join(storageDirectory, file.filename),
        mimeType: file.mimetype,
      };

      await repository.create(document);
      return toPublicDocument(document);
    });
  } catch (error) {
    await localDocumentStorageService.removeUpload(file.path);
    throw error;
  }
}

async function listDocuments(owner, pagination) {
  const result = await repository.findByOwner(owner, pagination);
  return {
    documents: result.documents.map(toPublicDocument),
    pagination: {
      ...pagination,
      total: result.total,
      nextOffset: pagination.offset + pagination.limit < result.total
        ? pagination.offset + pagination.limit
        : null,
    },
  };
}

async function getDocumentForDownload(id, owner) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, 'INVALID_DOCUMENT_ID', 'O identificador do documento é inválido.');
  }

  const document = await repository.findById(id, owner);
  if (!document || document.owner !== owner) {
    throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }

  const storagePath = await localDocumentStorageService.getDownloadPath(id, document.storagePath);
  return { ...document, storagePath };
}

module.exports = { createDocument, getDocumentForDownload, listDocuments };