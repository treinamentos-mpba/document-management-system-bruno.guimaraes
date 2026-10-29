const path = require('node:path');

function createDocumentRepository(storageDirectory) {
  const documents = new Map();

  return {
    save(file) {
      const document = {
        id: file.filename,
        originalName: file.originalname,
        size: file.size,
        createdAt: new Date().toISOString(),
        owner: null,
      };
      documents.set(document.id, document);
      return document;
    },
    list() {
      return Array.from(documents.values());
    },
    findById(id) {
      return documents.get(id);
    },
    getFilePath(id) {
      return path.join(storageDirectory, id);
    },
  };
}

module.exports = createDocumentRepository;
