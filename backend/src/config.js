const path = require('node:path');

function readIntegerEnvironmentVariable(name, fallback, minimum, maximum) {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? fallback : Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

const backendDirectory = path.resolve(__dirname, '..');

module.exports = {
  port: readIntegerEnvironmentVariable('PORT', 3000, 1, 65535),
  maxFileSizeBytes: readIntegerEnvironmentVariable('MAX_FILE_SIZE_BYTES', 10485760, 1, Number.MAX_SAFE_INTEGER),
  storageDirectory: path.resolve(process.env.STORAGE_DIR || path.join(backendDirectory, 'storage')),
};