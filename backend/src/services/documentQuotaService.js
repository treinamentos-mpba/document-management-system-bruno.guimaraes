const repository = require('../repositories/localDocumentRepository');
const HttpError = require('../errors/httpError');
const { maxDocumentsPerUser, maxStorageBytesPerUser } = require('../config');

const ownerCreationLocks = new Map();

async function withOwnerLock(owner, operation) {
  const previous = ownerCreationLocks.get(owner) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  ownerCreationLocks.set(owner, current);
  await previous;

  try {
    return await operation();
  } finally {
    release();
    if (ownerCreationLocks.get(owner) === current) {
      ownerCreationLocks.delete(owner);
    }
  }
}

async function withAvailableQuota(owner, fileSize, operation) {
  return withOwnerLock(owner, async () => {
    const ownerDocuments = await repository.findByOwner(owner);
    if (
      ownerDocuments.total >= maxDocumentsPerUser
      || ownerDocuments.totalBytes + fileSize > maxStorageBytesPerUser
    ) {
      throw new HttpError(413, 'USER_QUOTA_EXCEEDED', 'O usuário atingiu o limite de armazenamento.');
    }

    return operation();
  });
}

module.exports = { withAvailableQuota };
