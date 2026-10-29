function createDocumentController(service) {
  return {
    upload(req, res) {
      if (!req.file) {
        return res.status(400).json({ error: 'Envie um arquivo no campo file.' });
      }
      res.status(201).json(service.upload(req.file));
    },
    list(req, res) {
      res.json(service.list());
    },
    download(req, res, next) {
      const download = service.getDownload(req.params.id);
      if (!download) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
      }
      res.download(download.filePath, download.document.originalName, (error) => {
        if (error) {
          next(error);
        }
      });
    },
  };
}

module.exports = createDocumentController;
