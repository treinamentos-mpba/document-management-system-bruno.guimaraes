import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let UploadComponent;
let DocumentList;
let DownloadButton;
let App;

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  ({ default: UploadComponent } = await server.ssrLoadModule('/src/components/UploadComponent.jsx'));
  ({ default: DocumentList } = await server.ssrLoadModule('/src/components/DocumentList.jsx'));
  ({ default: DownloadButton } = await server.ssrLoadModule('/src/components/DownloadButton.jsx'));
  ({ default: App } = await server.ssrLoadModule('/src/App.jsx'));
});

after(async () => { await server?.close(); });

const document = {
  id: 'document-1',
  originalName: 'relatório.txt',
  size: 2048,
  uploadedAt: '2026-10-28T12:00:00Z',
};

function render(Component, props = {}) {
  return renderToStaticMarkup(createElement(Component, props));
}

test('upload apresenta seletor e impede envio sem arquivo', () => {
  const html = render(UploadComponent);
  assert.match(html, /type="file"/);
  assert.match(html, /type="submit" disabled=""/);
  assert.match(html, /Escolher arquivo/);
});

test('listagem apresenta estado de carregamento e desabilita atualização', () => {
  const html = render(DocumentList, { documents: [], isLoading: true });
  assert.match(html, /Carregando documentos/);
  assert.match(html, /disabled="">Atualizando/);
  assert.doesNotMatch(html, /Nenhum documento/);
});

test('listagem apresenta estado vazio, erro e confirmação acessíveis', () => {
  const html = render(DocumentList, {
    documents: [], isLoading: false, error: 'Falha ao carregar.', notice: 'Documento enviado.',
  });
  assert.match(html, /Nenhum documento enviado por este usuário/);
  assert.match(html, /role="alert">Falha ao carregar/);
  assert.match(html, /role="status">Documento enviado/);
});

test('listagem mostra nome, tamanho, data e botão de download por documento', () => {
  const html = render(DocumentList, { documents: [document], isLoading: false, userId: 'user-123' });
  assert.match(html, /relatório\.txt/);
  assert.match(html, /2\.0 KB/);
  assert.match(html, /2026/);
  assert.match(html, /aria-label="Baixar relatório\.txt"/);
  assert.match(html, /class="count">1/);
});

test('botão de download possui nome acessível com o nome original', () => {
  const html = render(DownloadButton, { document, userId: 'user-123' });
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Baixar relatório\.txt"/);
  assert.doesNotMatch(html, /disabled/);
});

test('App monta upload e listagem com identificação do usuário', () => {
  const html = render(App);
  assert.match(html, /id="user-id"/);
  assert.match(html, /Adicionar documento/);
  assert.match(html, /Seus documentos/);
  assert.match(html, /Carregando documentos/);
});
