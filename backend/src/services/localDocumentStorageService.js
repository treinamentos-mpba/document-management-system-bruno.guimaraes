const fs = require('node:fs/promises');
const path = require('node:path');
const HttpError = require('../errors/httpError');
const { storageDirectory } = require('../config');

async function prepareUpload(filePath) {
  await fs.chmod(filePath, 0o600);
}

async function removeUpload(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[DMS] Failed to remove unregistered uploaded file', error.message);
    }
  }
}

async function getDownloadPath(id, storagePath) {
  const expectedPath = path.resolve(storageDirectory, id);
  if (storagePath !== expectedPath) {
    throw new HttpError(500, 'INVALID_STORAGE_REFERENCE', 'A referência ao arquivo é inválida.');
  }

  try {
    const fileStat = await fs.lstat(storagePath);
    if (!fileStat.isFile()) {
      throw new HttpError(500, 'INVALID_STORAGE_REFERENCE', 'A referência ao arquivo é inválida.');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new HttpError(500, 'FILE_READ_FAILED', 'Não foi possível ler o arquivo.');
    }
    throw error;
  }

  return storagePath;
}

module.exports = { getDownloadPath, prepareUpload, removeUpload };
