const path = require('node:path');

function readIntegerEnvironmentVariable(name, fallback, minimum, maximum) {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? fallback : Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

function readAuthUsers(rawValue) {
  if (!rawValue) {
    return [];
  }

  let users;
  try {
    users = JSON.parse(rawValue);
  } catch {
    throw new Error('AUTH_USERS_JSON must contain a valid JSON array');
  }

  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('AUTH_USERS_JSON must contain at least one user');
  }

  const ids = new Set();
  return users.map((user) => {
    if (
      !user
      || typeof user.id !== 'string'
      || user.id.trim().length === 0
      || user.id.length > 128
      || typeof user.passwordHash !== 'string'
      || !/^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(user.passwordHash)
      || ids.has(user.id)
    ) {
      throw new Error('Each AUTH_USERS_JSON user must have a unique id and a valid scrypt passwordHash');
    }

    ids.add(user.id);
    return { id: user.id, passwordHash: user.passwordHash };
  });
}

const backendDirectory = path.resolve(__dirname, '..');
const storageDirectory = path.resolve(process.env.STORAGE_DIR || path.join(backendDirectory, 'storage'));
const authSecret = process.env.AUTH_SECRET;
const authUsersJson = process.env.AUTH_USERS_JSON;
const authConfigured = Boolean(authSecret && authUsersJson);

if (storageDirectory === path.parse(storageDirectory).root) {
  throw new Error('STORAGE_DIR must not be a filesystem root');
}

if (Boolean(authSecret) !== Boolean(authUsersJson)) {
  throw new Error('AUTH_SECRET and AUTH_USERS_JSON must be configured together');
}

if (process.env.NODE_ENV === 'production' && !authConfigured) {
  throw new Error('Authentication must be configured when NODE_ENV is production');
}

if (authConfigured && Buffer.byteLength(authSecret) < 32) {
  throw new Error('AUTH_SECRET must contain at least 32 bytes');
}

module.exports = {
  port: readIntegerEnvironmentVariable('PORT', 3000, 1, 65535),
  maxFileSizeBytes: readIntegerEnvironmentVariable('MAX_FILE_SIZE_BYTES', 10485760, 1, Number.MAX_SAFE_INTEGER),
  maxDocumentsPerUser: readIntegerEnvironmentVariable('MAX_DOCUMENTS_PER_USER', 1000, 1, Number.MAX_SAFE_INTEGER),
  maxStorageBytesPerUser: readIntegerEnvironmentVariable('MAX_STORAGE_BYTES_PER_USER', 1073741824, 1, Number.MAX_SAFE_INTEGER),
  storageDirectory,
  auth: {
    enabled: authConfigured,
    secret: authSecret,
    users: readAuthUsers(authUsersJson),
  },
};