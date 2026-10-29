function createDocumentService(repository) {
  return {
    upload(file) {
      return repository.save(file);
    },
    list() {
      return repository.list();
    },
    getDownload(id) {
      const document = repository.findById(id);
      if (!document) {
        return null;
      }
      return { document, filePath: repository.getFilePath(id) };
    },
  };
}

module.exports = createDocumentService;
