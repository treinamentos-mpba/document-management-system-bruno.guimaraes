const apiBase = '/api';

async function readResponse(response) {
  if (response.ok) {
    return response;
  }

  const body = await response.json().catch(() => null);
  const error = new Error(body?.error?.message || 'Não foi possível concluir a operação.');
  error.status = response.status;
  error.code = body?.error?.code;
  throw error;
}

function createRequestOptions(userId, { token, signal } = {}) {
  const headers = token
    ? { Authorization: `Bearer ${token}` }
    : { 'X-User-Id': userId };
  return {
    headers,
    ...(signal ? { signal } : {}),
  };
}

export async function getAuthMode() {
  const response = await readResponse(await fetch(`${apiBase}/auth/mode`));
  const mode = await response.json();
  if (typeof mode.authRequired !== 'boolean') {
    throw new Error('A API retornou um modo de autenticação inválido.');
  }
  return mode;
}

export async function login(userId, password) {
  const response = await readResponse(await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  }));
  return response.json();
}

export async function listDocuments(userId, options) {
  const offset = options?.offset || 0;
  const limit = options?.limit;
  const query = new URLSearchParams();
  if (offset > 0) query.set('offset', String(offset));
  if (limit !== undefined && limit !== 50) query.set('limit', String(limit));
  const queryString = query.toString();
  const response = await readResponse(await fetch(
    `${apiBase}/documents${queryString ? `?${queryString}` : ''}`,
    createRequestOptions(userId, options),
  ));
  return response.json();
}

export async function uploadDocument(userId, file, options) {
  const formData = new FormData();
  formData.append('file', file);

  const requestOptions = createRequestOptions(userId, options);
  const response = await readResponse(await fetch(`${apiBase}/upload`, {
    method: 'POST',
    ...requestOptions,
    body: formData,
  }));
  return (await response.json()).document;
}

export async function downloadDocument(userId, documentId, options) {
  const response = await readResponse(await fetch(
    `${apiBase}/documents/${encodeURIComponent(documentId)}/download`,
    createRequestOptions(userId, options),
  ));
  return response.blob();
}