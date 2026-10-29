const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtemp, readFile, readdir, rm } = require('node:fs/promises');
const path = require('node:path');
const { createApp } = require('../src/app');

describe('endpoints de documentos', () => {
  let server;
  let baseUrl;
  let storageDirectory;

  beforeEach(async () => {
    storageDirectory = await mkdtemp(path.join(__dirname, '../storage/test-'));
    server = createApp({ storageDirectory }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    try {
      if (server) {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
      }
    } finally {
      if (storageDirectory) {
        await rm(storageDirectory, { recursive: true, force: true });
      }
    }
  });

  function upload(contents = 'Documento de teste', filename = 'documento.txt', field = 'file') {
    const body = new FormData();
    body.append(field, new Blob([contents]), filename);
    return fetch(`${baseUrl}/upload`, { method: 'POST', body });
  }

  test('preserva o endpoint de saúde', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  test('lista vazia antes do primeiro upload', async () => {
    const response = await fetch(`${baseUrl}/documents`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  });

  test('upload retorna metadados e grava os bytes no filesystem local', async () => {
    const contents = Buffer.from([0, 1, 127, 128, 255]);
    const response = await upload(contents, 'arquivo.bin');
    assert.equal(response.status, 201);
    const document = await response.json();
    assert.deepEqual(Object.keys(document).sort(), ['createdAt', 'id', 'originalName', 'owner', 'size']);
    assert.match(document.id, /^[0-9a-f-]{36}$/);
    assert.equal(document.originalName, 'arquivo.bin');
    assert.equal(document.size, contents.length);
    assert.ok(Number.isFinite(Date.parse(document.createdAt)));
    assert.equal(document.owner, null);
    assert.deepEqual(await readdir(storageDirectory), [document.id]);
    assert.deepEqual(await readFile(path.join(storageDirectory, document.id)), contents);
  });

  test('lista todos os documentos enviados, inclusive nomes repetidos', async () => {
    const first = await (await upload('Primeiro')).json();
    const second = await (await upload('Segundo')).json();
    assert.notEqual(first.id, second.id);
    const response = await fetch(`${baseUrl}/documents`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [first, second]);
  });

  test('download preserva os bytes e o nome original', async () => {
    const contents = Buffer.from([0, 10, 128, 255]);
    const document = await (await upload(contents, 'arquivo.bin')).json();
    const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="arquivo.bin"');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), contents);
  });

  test('upload sem arquivo retorna 400 sem criar documentos', async () => {
    const response = await fetch(`${baseUrl}/upload`, { method: 'POST' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Envie um arquivo no campo file.' });
    assert.deepEqual(await readdir(storageDirectory), []);
    assert.deepEqual(await (await fetch(`${baseUrl}/documents`)).json(), []);
  });

  test('upload em campo incorreto retorna 400 sem deixar arquivos', async () => {
    const response = await upload('Teste', 'teste.txt', 'document');
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /campo file/);
    assert.deepEqual(await readdir(storageDirectory), []);
  });

  test('upload de múltiplos arquivos retorna 400 e remove arquivos parciais', async () => {
    const body = new FormData();
    body.append('file', new Blob(['Primeiro']), 'primeiro.txt');
    body.append('file', new Blob(['Segundo']), 'segundo.txt');
    const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body });
    assert.equal(response.status, 400);
    await response.json();
    assert.deepEqual(await readdir(storageDirectory), []);
    assert.deepEqual(await (await fetch(`${baseUrl}/documents`)).json(), []);
  });

  test('download de documento inexistente retorna 404', async () => {
    const response = await fetch(`${baseUrl}/documents/inexistente/download`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Documento não encontrado.' });
  });
});
