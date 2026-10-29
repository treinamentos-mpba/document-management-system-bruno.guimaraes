const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { storageDirectory } = require('../config');

const metadataRootDirectory = path.join(storageDirectory, '.metadata');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getOwnerMetadataDirectory(owner) {
  const ownerKey = crypto.createHash('sha256').update(owner).digest('hex');
  return path.join(metadataRootDirectory, ownerKey);
}

function getMetadataPath(id, owner) {
  if (!uuidPattern.test(id)) {
    throw new Error('Invalid document identifier in repository');
  }

  return path.join(getOwnerMetadataDirectory(owner), `${id}.json`);
}

async function readDocument(id, owner) {
  let contents;
  try {
    contents = await fs.readFile(getMetadataPath(id, owner), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  const document = JSON.parse(contents);
  if (
    !document
    || document.id !== id
    || document.owner !== owner
    || typeof document.originalName !== 'string'
    || Buffer.byteLength(document.originalName) > 255
    || !Number.isSafeInteger(document.size)
    || document.size < 0
    || !Number.isFinite(Date.parse(document.uploadedAt))
    || typeof document.mimeType !== 'string'
  ) {
    throw new Error(`Invalid metadata for document ${id}`);
  }

  return {
    ...document,
    storagePath: path.join(storageDirectory, id),
  };
}

async function create(document) {
  const ownerMetadataDirectory = getOwnerMetadataDirectory(document.owner);
  await fs.mkdir(ownerMetadataDirectory, { recursive: true, mode: 0o700 });
  const metadata = {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    uploadedAt: document.uploadedAt,
    owner: document.owner,
    mimeType: document.mimeType,
  };
  const temporaryPath = path.join(ownerMetadataDirectory, `${document.id}.${crypto.randomUUID()}.tmp`);

  try {
    await fs.writeFile(temporaryPath, JSON.stringify(metadata), { flag: 'wx', mode: 0o600 });
    await fs.rename(temporaryPath, getMetadataPath(document.id, document.owner));
    return document;
  } catch (error) {
    try {
      await fs.unlink(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        console.error('[DMS] Failed to remove temporary metadata file', cleanupError.message);
      }
    }
    throw error;
  }
}

async function initialize() {
  await fs.mkdir(storageDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(storageDirectory, 0o700);
  await fs.mkdir(metadataRootDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(metadataRootDirectory, 0o700);

  const storageEntries = await fs.readdir(storageDirectory, { withFileTypes: true });
  for (const entry of storageEntries) {
    if (entry.isSymbolicLink() && uuidPattern.test(entry.name)) {
      await fs.unlink(path.join(storageDirectory, entry.name));
    }
  }

  const storedIds = new Set(storageEntries
    .filter((entry) => entry.isFile() && uuidPattern.test(entry.name))
    .map((entry) => entry.name));
  const ownerDirectoryEntries = await fs.readdir(metadataRootDirectory, { withFileTypes: true });
  const metadataById = new Map();
  for (const ownerDirectory of ownerDirectoryEntries) {
    if (!ownerDirectory.isDirectory() || !/^[0-9a-f]{64}$/i.test(ownerDirectory.name)) {
      continue;
    }

    const ownerDirectoryPath = path.join(metadataRootDirectory, ownerDirectory.name);
    await fs.chmod(ownerDirectoryPath, 0o700);
    const metadataEntries = await fs.readdir(ownerDirectoryPath, { withFileTypes: true });
    for (const entry of metadataEntries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const id = entry.name.slice(0, -5);
        if (uuidPattern.test(id)) {
          metadataById.set(id, path.join(ownerDirectoryPath, entry.name));
        }
      } else if (entry.isFile() && /^[0-9a-f-]{36}\.[0-9a-f-]{36}\.tmp$/i.test(entry.name)) {
        await fs.unlink(path.join(ownerDirectoryPath, entry.name));
      }
    }
  }

  for (const [id, metadataPath] of metadataById) {
    if (!storedIds.has(id)) {
      await fs.unlink(metadataPath);
      metadataById.delete(id);
    }
  }

  const registeredIds = new Set(metadataById.keys());
  for (const entry of storageEntries) {
    if (entry.isFile() && uuidPattern.test(entry.name) && !registeredIds.has(entry.name)) {
      await fs.unlink(path.join(storageDirectory, entry.name));
    }
  }
}

async function findById(id, owner) {
  return readDocument(id, owner);
}

async function findByOwner(owner, { offset = 0, limit = 50 } = {}) {
  let fileNames;
  try {
    fileNames = await fs.readdir(getOwnerMetadataDirectory(owner));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { documents: [], total: 0, totalBytes: 0 };
    }

    throw error;
  }

  const documents = await Promise.all(fileNames
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => readDocument(fileName.slice(0, -5), owner)));

  const sortedDocuments = documents
    .filter((document) => document && document.owner === owner)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));

  return {
    documents: sortedDocuments.slice(offset, offset + limit),
    total: sortedDocuments.length,
    totalBytes: sortedDocuments.reduce((total, document) => total + document.size, 0),
  };
}

module.exports = { create, findById, findByOwner, initialize };