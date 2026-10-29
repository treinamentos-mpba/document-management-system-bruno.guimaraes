import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { getAuthMode, listDocuments, login, uploadDocument } from './services/documents.js';
import './App.css';

export default function App() {
  const [userId, setUserId] = useState('user-123');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [authRequired, setAuthRequired] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, limit: 50, total: 0, nextOffset: null });
  const [pageOffset, setPageOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    getAuthMode()
      .then(({ authRequired: required }) => {
        if (active) setAuthRequired(required);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
          setIsLoading(false);
        }
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authRequired === null) {
      return undefined;
    }

    if (authRequired && !token) {
      setDocuments([]);
      setPagination({ offset: 0, limit: 50, total: 0, nextOffset: null });
      setIsLoading(false);
      return undefined;
    }

    const activeUserId = userId.trim();
    if (!activeUserId) {
      setDocuments([]);
      setPagination({ offset: 0, limit: 50, total: 0, nextOffset: null });
      setIsLoading(false);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setDocuments([]);
    setPagination({ offset: pageOffset, limit: 50, total: 0, nextOffset: null });
    setIsLoading(true);
    setError('');

    listDocuments(activeUserId, {
      token: authRequired ? token : undefined,
      signal: controller.signal,
      offset: pageOffset,
    })
      .then((result) => {
        if (active) {
          setDocuments(result.documents);
          setPagination(result.pagination);
        }
      })
      .catch((requestError) => {
        if (active && requestError.name !== 'AbortError') handleRequestError(requestError);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [authRequired, pageOffset, refreshKey, token, userId]);

  function refreshDocuments() {
    if (!userId.trim()) {
      setError('Informe um identificador de usuário.');
      return;
    }

    setNotice('');
    setPageOffset(0);
    setRefreshKey((current) => current + 1);
  }

  function handleRequestError(requestError) {
    const message = typeof requestError === 'string' ? requestError : requestError.message;
    if (authRequired && requestError?.status === 401) {
      setToken('');
      setDocuments([]);
      setPagination({ offset: 0, limit: 50, total: 0, nextOffset: null });
    }
    setError(message);
  }

  async function handleUpload(file) {
    if (!userId.trim()) {
      throw new Error('Informe um identificador de usuário.');
    }

    if (authRequired === null || (authRequired && !token)) {
      throw new Error('Aguarde a autenticação antes de enviar documentos.');
    }

    setNotice('');
    setIsUploading(true);
    try {
      await uploadDocument(userId.trim(), file, { token: authRequired ? token : undefined });
      setNotice('Documento enviado.');
      setPageOffset(0);
      setRefreshKey((current) => current + 1);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    try {
      const session = await login(userId.trim(), password);
      setUserId(session.userId);
      setPassword('');
      setToken(session.token);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function handleUserIdChange(event) {
    setUserId(event.target.value);
    setDocuments([]);
    setPagination({ offset: 0, limit: 50, total: 0, nextOffset: null });
    setPageOffset(0);
    setError('');
    setNotice('');
  }

  function handleLogout() {
    setToken('');
    setDocuments([]);
    setPagination({ offset: 0, limit: 50, total: 0, nextOffset: null });
    setPageOffset(0);
    setUserId('');
    setPassword('');
    setError('');
    setNotice('');
  }

  if (authRequired && !token) {
    return (
      <main className="workspace">
        <header className="topbar">
          <a className="wordmark" href="/" aria-label="Documentos, início">D<span>/</span>M</a>
        </header>
        <div className="content">
          <section className="page-heading" aria-labelledby="page-title">
            <p className="eyebrow">ESPAÇO DE TRABALHO</p>
            <h1 id="page-title">Entrar</h1>
            <p className="subtitle">Autentique-se para acessar seus documentos.</p>
          </section>
          <section className="upload-section" aria-labelledby="login-title">
            <h2 id="login-title">Acessar conta</h2>
            <form className="upload-form" onSubmit={handleLogin}>
              <label>
                Usuário
                <input
                  autoComplete="username"
                  maxLength={128}
                  onChange={handleUserIdChange}
                  required
                  value={userId}
                />
              </label>
              <label>
                Senha
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <button className="primary-button" type="submit">Entrar</button>
            </form>
            {error && <p className="message error-message" role="alert">{error}</p>}
          </section>
        </div>
        <footer className="footer"><span>DOCUMENT MANAGEMENT SYSTEM</span><span>ARMAZENAMENTO LOCAL</span></footer>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Documentos, início">D<span>/</span>M</a>
        {authRequired
          ? (
            <div className="identity-field">
              <span>Usuário: {userId}</span>
              <button className="text-button" type="button" onClick={handleLogout}>Sair</button>
            </div>
          )
          : (
            <div className="identity-field">
              <label htmlFor="user-id">Usuário</label>
              <input
                id="user-id"
                maxLength={128}
                disabled={isUploading}
                value={userId}
                onChange={handleUserIdChange}
                autoComplete="off"
              />
            </div>
          )}
      </header>

      <div className="content">
        <section className="page-heading" aria-labelledby="page-title">
          <p className="eyebrow">ESPAÇO DE TRABALHO</p>
          <h1 id="page-title">Documentos</h1>
          <p className="subtitle">Arquivos enviados por <strong>{userId || 'usuário não informado'}</strong></p>
        </section>

        <UploadComponent onUpload={handleUpload} onError={handleRequestError} />
        <DocumentList
          documents={documents}
          isLoading={isLoading}
          userId={userId}
          token={authRequired ? token : undefined}
          pagination={pagination}
          onRefresh={refreshDocuments}
          onPageChange={setPageOffset}
          onError={handleRequestError}
          error={error}
          notice={notice}
        />
      </div>
      <footer className="footer"><span>DOCUMENT MANAGEMENT SYSTEM</span><span>ARMAZENAMENTO LOCAL</span></footer>
    </main>
  );
}
