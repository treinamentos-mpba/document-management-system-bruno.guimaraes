const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const storageDirectory = mkdtempSync(path.join(os.tmpdir(), 'dms-development-auth-'));
delete process.env.AUTH_SECRET;
delete process.env.AUTH_USERS_JSON;
process.env.NODE_ENV = 'test';
process.env.STORAGE_DIR = storageDirectory;

const app = require('../src/app');
const repository = require('../src/repositories/localDocumentRepository');
let server;
let baseUrl;

before(async () => {
  await repository.initialize();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  rmSync(storageDirectory, { recursive: true, force: true });
});

test('mantém o cabeçalho X-User-Id somente no modo de desenvolvimento sem autenticação', async () => {
  const modeResponse = await fetch(`${baseUrl}/auth/mode`);
  assert.deepStrictEqual(await modeResponse.json(), { authRequired: false });

  const documentsResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'local-user' },
  });
  assert.strictEqual(documentsResponse.status, 200);
  assert.deepStrictEqual((await documentsResponse.json()).documents, []);
});
