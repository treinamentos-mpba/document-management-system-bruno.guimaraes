const { after, before, test } = require('node:test');
const assert = require('node:assert');
const { createHash, randomBytes, randomUUID, scryptSync } = require('node:crypto');
const { mkdtempSync, rmSync, statSync } = require('node:fs');
const { mkdir, readFile, symlink, unlink, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const storageDirectory = mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
process.env.STORAGE_DIR = storageDirectory;
process.env.MAX_FILE_SIZE_BYTES = '32';
process.env.MAX_DOCUMENTS_PER_USER = '2';
process.env.MAX_STORAGE_BYTES_PER_USER = '30';
process.env.NODE_ENV = 'test';

const passwordSalt = randomBytes(16);
const passwordHash = `${passwordSalt.toString('hex')}:${scryptSync('test-password', passwordSalt, 64).toString('hex')}`;
process.env.AUTH_SECRET = 'test-secret-with-at-least-thirty-two-bytes';
process.env.AUTH_USERS_JSON = JSON.stringify(['alice', 'bob', 'quota', 'filequota']
  .map((id) => ({ id, passwordHash })));

const app = require('../src/app');
const documentRepository = require('../src/repositories/localDocumentRepository');
let server;
let baseUrl;
const tokens = new Map();

async function authHeaders(userId) {
  if (!tokens.has(userId)) {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password: 'test-password' }),
    });
    assert.strictEqual(response.status, 200);
    tokens.set(userId, (await response.json()).token);
  }

  return { Authorization: `Bearer ${tokens.get(userId)}` };
}

async function upload(userId, contents, fileName = 'arquivo.txt') {
  const formData = new FormData();
  formData.append('file', new Blob([contents], { type: 'text/plain' }), fileName);
  return fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: await authHeaders(userId),
    body: formData,
  });
}

before(async () => {
  const orphanPath = path.join(storageDirectory, '00000000-0000-4000-8000-000000000000');
  const orphanSymlinkPath = path.join(storageDirectory, '00000000-0000-4000-8000-000000000001');
  const staleId = randomUUID();
  const staleMetadataDirectory = path.join(
    storageDirectory,
    '.metadata',
    createHash('sha256').update('stale-user').digest('hex'),
  );
  const staleMetadataPath = path.join(staleMetadataDirectory, `${staleId}.json`);
  await writeFile(orphanPath, 'orphan');
  await symlink('/etc/passwd', orphanSymlinkPath);
  await mkdir(staleMetadataDirectory, { recursive: true });
  await writeFile(staleMetadataPath, JSON.stringify({
    id: staleId,
    owner: 'stale-user',
    originalName: 'stale.txt',
    size: 5,
    uploadedAt: new Date().toISOString(),
    mimeType: 'text/plain',
  }));
  await documentRepository.initialize();
  assert.throws(() => statSync(orphanPath), { code: 'ENOENT' });
  assert.throws(() => statSync(orphanSymlinkPath), { code: 'ENOENT' });
  assert.throws(() => statSync(staleMetadataPath), { code: 'ENOENT' });
  assert.strictEqual(statSync(storageDirectory).mode & 0o777, 0o700);

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

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('publica o modo de autenticação sem expor dados da configuração', async () => {
  const response = await fetch(`${baseUrl}/auth/mode`);
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await response.json(), { authRequired: true });
  assert.strictEqual(response.headers.get('cache-control'), 'no-store');
});

test('faz upload, lista e baixa somente documentos do próprio usuário', async () => {
  const formData = new FormData();
  formData.append('file', new Blob(['conteudo do documento'], { type: 'text/plain' }), 'relatorio.txt');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: await authHeaders('alice'),
    body: formData,
  });

  assert.strictEqual(uploadResponse.status, 201);
  const { document } = await uploadResponse.json();
  assert.strictEqual(document.originalName, 'relatorio.txt');
  assert.strictEqual(document.size, Buffer.byteLength('conteudo do documento'));
  assert.strictEqual(document.owner, 'alice');
  assert.deepStrictEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
  assert.ok(document.id);
  assert.ok(Number.isFinite(Date.parse(document.uploadedAt)));
  assert.strictEqual(
    await readFile(path.join(storageDirectory, document.id), 'utf8'),
    'conteudo do documento',
  );
  assert.strictEqual(statSync(path.join(storageDirectory, document.id)).mode & 0o777, 0o600);

  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: await authHeaders('alice'),
  });
  assert.strictEqual(listResponse.status, 200);
  const listBody = await listResponse.json();
  assert.deepStrictEqual(listBody.documents, [document]);
  assert.deepStrictEqual(listBody.pagination, {
    offset: 0,
    limit: 50,
    total: 1,
    nextOffset: null,
  });

  const otherUserResponse = await fetch(`${baseUrl}/documents`, {
    headers: await authHeaders('bob'),
  });
  assert.deepStrictEqual((await otherUserResponse.json()).documents, []);

  const forgedIdentityResponse = await fetch(`${baseUrl}/documents`, {
    headers: {
      ...(await authHeaders('alice')),
      'X-User-Id': 'bob',
    },
  });
  assert.deepStrictEqual((await forgedIdentityResponse.json()).documents, [document]);

  const forbiddenDownload = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: await authHeaders('bob'),
  });
  assert.strictEqual(forbiddenDownload.status, 404);

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: await authHeaders('alice'),
  });
  assert.strictEqual(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /relatorio\.txt/);
  assert.strictEqual(downloadResponse.headers.get('content-type'), 'application/octet-stream');
  assert.strictEqual(downloadResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(downloadResponse.headers.get('cache-control'), 'private, no-store');
  assert.strictEqual(await downloadResponse.text(), 'conteudo do documento');

  const repositoryPath = require.resolve('../src/repositories/localDocumentRepository');
  delete require.cache[repositoryPath];
  const restartedRepository = require(repositoryPath);
  assert.strictEqual((await restartedRepository.findById(document.id, 'alice')).owner, 'alice');
  assert.strictEqual(await restartedRepository.findById(document.id, 'bob'), null);
});

test('retorna erros consistentes para usuário ausente, arquivo ausente e arquivo grande', async () => {
  const missingUserResponse = await fetch(`${baseUrl}/documents`);
  assert.strictEqual(missingUserResponse.status, 401);
  assert.strictEqual((await missingUserResponse.json()).error.code, 'AUTHENTICATION_REQUIRED');

  const invalidIdResponse = await fetch(`${baseUrl}/documents/not-a-uuid/download`, {
    headers: await authHeaders('alice'),
  });
  assert.strictEqual(invalidIdResponse.status, 400);
  assert.strictEqual((await invalidIdResponse.json()).error.code, 'INVALID_DOCUMENT_ID');

  const missingFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: await authHeaders('alice'),
    body: new FormData(),
  });
  assert.strictEqual(missingFileResponse.status, 400);
  assert.strictEqual((await missingFileResponse.json()).error.code, 'FILE_REQUIRED');

  const largeFormData = new FormData();
  largeFormData.append('file', new Blob(['x'.repeat(33)]), 'large.txt');
  const largeFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: await authHeaders('alice'),
    body: largeFormData,
  });
  assert.strictEqual(largeFileResponse.status, 413);
  assert.strictEqual((await largeFileResponse.json()).error.code, 'FILE_TOO_LARGE');
});

test('retorna 404 para documento inexistente', async () => {
  const response = await fetch(`${baseUrl}/documents/00000000-0000-4000-8000-000000000000/download`, {
    headers: await authHeaders('alice'),
  });

  assert.strictEqual(response.status, 404);
  assert.strictEqual((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');

  const invalidPaginationResponse = await fetch(`${baseUrl}/documents?offset=-1&limit=101`, {
    headers: await authHeaders('alice'),
  });
  assert.strictEqual(invalidPaginationResponse.status, 400);
  assert.strictEqual((await invalidPaginationResponse.json()).error.code, 'INVALID_PAGINATION');
});

test('exige token, rejeita X-User-Id forjado e bloqueia tentativa de path traversal', async () => {
  const noTokenResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'alice' },
  });
  assert.strictEqual(noTokenResponse.status, 401);
  assert.strictEqual((await noTokenResponse.json()).error.code, 'AUTHENTICATION_REQUIRED');

  const invalidLoginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'alice', password: 'senha-incorreta' }),
  });
  assert.strictEqual(invalidLoginResponse.status, 401);
  assert.strictEqual((await invalidLoginResponse.json()).error.code, 'INVALID_CREDENTIALS');

  const traversalResponse = await fetch(
    `${baseUrl}/documents/%2e%2e%2f..%2fetc%2fpasswd/download`,
    { headers: await authHeaders('alice') },
  );
  assert.notStrictEqual(traversalResponse.status, 200);

  const tamperedToken = `${tokens.get('alice')}x`;
  const tamperedTokenResponse = await fetch(`${baseUrl}/documents`, {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });
  assert.strictEqual(tamperedTokenResponse.status, 401);
});

test('rejeita campos multipart extras e respeita as cotas por usuário', async () => {
  const extraFieldForm = new FormData();
  extraFieldForm.append('file', new Blob(['ok']), 'ok.txt');
  extraFieldForm.append('unexpected', 'value');
  const extraFieldResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: await authHeaders('alice'),
    body: extraFieldForm,
  });
  assert.strictEqual(extraFieldResponse.status, 400);

  assert.strictEqual((await upload('quota', 'a')).status, 201);
  assert.strictEqual((await upload('quota', 'b')).status, 201);
  const firstPageResponse = await fetch(`${baseUrl}/documents?limit=1`, {
    headers: await authHeaders('quota'),
  });
  const firstPage = await firstPageResponse.json();
  assert.strictEqual(firstPage.documents.length, 1);
  assert.deepStrictEqual(firstPage.pagination, {
    offset: 0,
    limit: 1,
    total: 2,
    nextOffset: 1,
  });
  const documentLimitResponse = await upload('quota', 'c');
  assert.strictEqual(documentLimitResponse.status, 413);
  assert.strictEqual((await documentLimitResponse.json()).error.code, 'USER_QUOTA_EXCEEDED');

  assert.strictEqual((await upload('filequota', 'x'.repeat(30))).status, 201);
  const storageLimitResponse = await upload('filequota', 'x');
  assert.strictEqual(storageLimitResponse.status, 413);
  assert.strictEqual((await storageLimitResponse.json()).error.code, 'USER_QUOTA_EXCEEDED');
});

test('trata falha de leitura quando o arquivo não existe mais no disco', async () => {
  const uploadResponse = await upload('alice', 'temp', 'temporario.txt');
  assert.strictEqual(uploadResponse.status, 201);
  const { document } = await uploadResponse.json();
  await unlink(path.join(storageDirectory, document.id));

  const response = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: await authHeaders('alice'),
  });

  assert.strictEqual(response.status, 500);
  assert.strictEqual((await response.json()).error.code, 'FILE_READ_FAILED');

  const documentPath = path.join(storageDirectory, document.id);
  await symlink('/etc/passwd', documentPath);
  const symlinkResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: await authHeaders('alice'),
  });
  assert.strictEqual(symlinkResponse.status, 500);
  assert.strictEqual((await symlinkResponse.json()).error.code, 'INVALID_STORAGE_REFERENCE');
  await unlink(documentPath);
});
