import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/documents.js';

afterEach(() => mock.restoreAll());

test('lista documentos via /api com o identificador do usuário', async () => {
  const documents = [{ id: 'document-1', originalName: 'arquivo.txt' }];
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ documents }));

  assert.deepEqual(await listDocuments('user-123'), documents);
  assert.deepEqual(fetchMock.mock.calls[0].arguments, [
    '/api/documents', { headers: { 'X-User-Id': 'user-123' } },
  ]);
});

test('envia o arquivo no campo file sem sobrescrever o Content-Type multipart', async () => {
  const file = new File(['conteúdo'], 'arquivo.txt', { type: 'text/plain' });
  const document = { id: 'document-1', originalName: file.name };
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ document }, { status: 201 }));

  assert.deepEqual(await uploadDocument('user-123', file), document);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/upload');
  assert.equal(options.method, 'POST');
  assert.deepEqual(options.headers, { 'X-User-Id': 'user-123' });
  assert.equal(options.body.get('file').name, file.name);
  assert.equal(await options.body.get('file').text(), await file.text());
});

test('baixa o conteúdo binário usando o ID codificado e o cabeçalho do usuário', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('conteúdo'));

  assert.equal(await (await downloadDocument('user-123', 'id/com espaço')).text(), 'conteúdo');
  assert.deepEqual(fetchMock.mock.calls[0].arguments, [
    '/api/documents/id%2Fcom%20espa%C3%A7o/download',
    { headers: { 'X-User-Id': 'user-123' } },
  ]);
});

for (const [operation, request] of [
  ['listagem', () => listDocuments('user-123')],
  ['upload', () => uploadDocument('user-123', new File([''], 'arquivo.txt'))],
  ['download', () => downloadDocument('user-123', 'document-1')],
]) {
  test(`propaga a mensagem de erro do backend na operação de ${operation}`, async () => {
    mock.method(globalThis, 'fetch', async () => Response.json({
      error: { code: 'REQUEST_FAILED', message: 'Operação recusada.' },
    }, { status: 400 }));

    await assert.rejects(request, { message: 'Operação recusada.' });
  });
}

test('mostra erro quando o proxy responde sem JSON', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('Bad Gateway', { status: 502 }));

  await assert.rejects(() => listDocuments('user-123'), {
    message: 'Não foi possível concluir a operação.',
  });
});

test('propaga falhas de rede', async () => {
  mock.method(globalThis, 'fetch', async () => { throw new TypeError('Falha de rede.'); });

  await assert.rejects(() => listDocuments('user-123'), { message: 'Falha de rede.' });
});
