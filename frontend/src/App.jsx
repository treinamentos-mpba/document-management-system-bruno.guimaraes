import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments, uploadDocument } from './services/documents.js';
import './App.css';

export default function App() {
  const [userId, setUserId] = useState('user-123');
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refreshDocuments() {
    if (!userId.trim()) {
      setError('Informe um identificador de usuário.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      setDocuments(await listDocuments(userId.trim()));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialDocuments() {
      try {
        const result = await listDocuments(userId);
        if (active) setDocuments(result);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadInitialDocuments();
    return () => { active = false; };
  }, []);

  async function handleUpload(file) {
    if (!userId.trim()) {
      throw new Error('Informe um identificador de usuário.');
    }

    setNotice('');
    await uploadDocument(userId.trim(), file);
    setNotice('Documento enviado.');
    await refreshDocuments();
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Documentos, início">D<span>/</span>M</a>
        <div className="identity-field">
          <label htmlFor="user-id">Usuário</label>
          <input
            id="user-id"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="off"
          />
        </div>
      </header>

      <div className="content">
        <section className="page-heading" aria-labelledby="page-title">
          <p className="eyebrow">ESPAÇO DE TRABALHO</p>
          <h1 id="page-title">Documentos</h1>
          <p className="subtitle">Arquivos enviados por <strong>{userId || 'usuário não informado'}</strong></p>
        </section>

        <UploadComponent onUpload={handleUpload} onError={setError} />
        <DocumentList
          documents={documents}
          isLoading={isLoading}
          userId={userId}
          onRefresh={refreshDocuments}
          onError={setError}
          error={error}
          notice={notice}
        />
      </div>
      <footer className="footer"><span>DOCUMENT MANAGEMENT SYSTEM</span><span>ARMAZENAMENTO LOCAL</span></footer>
    </main>
  );
}
