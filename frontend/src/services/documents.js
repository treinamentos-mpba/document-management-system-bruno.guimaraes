const apiBase = '/api';

async function readResponse(response) {
  if (response.ok) {
    return response;
  }

  const body = await response.json().catch(() => null);
  throw new Error(body?.error?.message || 'Não foi possível concluir a operação.');
}

export async function listDocuments(userId) {
  const response = await readResponse(await fetch(`${apiBase}/documents`, {
    headers: { 'X-User-Id': userId },
  }));
  return (await response.json()).documents;
}

export async function uploadDocument(userId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await readResponse(await fetch(`${apiBase}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': userId },
    body: formData,
  }));
  return (await response.json()).document;
}

export async function downloadDocument(userId, documentId) {
  const response = await readResponse(await fetch(`${apiBase}/documents/${encodeURIComponent(documentId)}/download`, {
    headers: { 'X-User-Id': userId },
  }));
  return response.blob();
}