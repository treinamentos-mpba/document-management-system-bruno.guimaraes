const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { maxFileSizeBytes, storageDirectory } = require('../config');

const storage = multer.diskStorage({
  destination(req, file, callback) {
    fs.mkdir(storageDirectory, { recursive: true }, (error) => callback(error, storageDirectory));
  },
  filename(req, file, callback) {
    callback(null, crypto.randomUUID());
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: maxFileSizeBytes, files: 1 },
});