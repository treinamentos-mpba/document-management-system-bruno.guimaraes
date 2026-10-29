const { createHmac, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { auth } = require('../config');

const scryptAsync = promisify(scrypt);
const tokenLifetimeSeconds = 60 * 60;
const dummyPasswordHash = `${randomBytes(16).toString('hex')}:${randomBytes(64).toString('hex')}`;

function parsePasswordHash(passwordHash) {
  const [saltHex, hashHex] = passwordHash.split(':');
  return { salt: Buffer.from(saltHex, 'hex'), hash: Buffer.from(hashHex, 'hex') };
}

async function authenticatePassword(userId, password) {
  const user = auth.users.find((candidate) => candidate.id === userId);
  const storedPasswordHash = user ? user.passwordHash : dummyPasswordHash;
  const { salt, hash } = parsePasswordHash(storedPasswordHash);
  const suppliedHash = await scryptAsync(password, salt, hash.length);
  const matches = timingSafeEqual(hash, suppliedHash);

  return matches ? user : null;
}

function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds,
  })).toString('base64url');
  const signature = createHmac('sha256', auth.secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!auth.enabled || typeof token !== 'string') {
    return null;
  }

  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) {
    return null;
  }

  const expectedSignature = createHmac('sha256', auth.secret).update(payload).digest();
  let suppliedSignature;
  try {
    suppliedSignature = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }

  if (
    suppliedSignature.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof claims.sub !== 'string'
      || !Number.isInteger(claims.exp)
      || claims.exp <= Math.floor(Date.now() / 1000)
      || !auth.users.some((user) => user.id === claims.sub)
    ) {
      return null;
    }

    return claims.sub;
  } catch {
    return null;
  }
}

async function login(userId, password) {
  if (
    typeof userId !== 'string'
    || typeof password !== 'string'
    || userId.length > 128
    || password.length > 1024
  ) {
    await authenticatePassword('', '');
    return null;
  }

  const user = await authenticatePassword(userId, password);
  return user ? { token: createToken(user.id), userId: user.id } : null;
}

module.exports = { login, verifyToken };
