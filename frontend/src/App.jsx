import { useEffect, useState } from 'react';
import { downloadDocument, listDocuments, uploadDocument } from './services/documents.js';
import './App.css';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function App() {
  const [userId, setUserId] = useState('user-123');
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
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

  async function handleUpload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedFile || !userId.trim()) {
      setError(!userId.trim() ? 'Informe um identificador de usuário.' : 'Selecione um arquivo para enviar.');
      return;
    }

    setIsUploading(true);
    setError('');
    setNotice('');
    try {
      await uploadDocument(userId.trim(), selectedFile);
      setSelectedFile(null);
      form.reset();
      setNotice('Documento enviado.');
      await refreshDocuments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(document) {
    setDownloadingId(document.id);
    setError('');
    try {
      const file = await downloadDocument(userId.trim(), document.id);
      const objectUrl = URL.createObjectURL(file);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.originalName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloadingId(null);
    }
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

        <section className="upload-section" aria-labelledby="upload-title">
          <div className="section-heading">
            <div>
              <p className="section-index">01 / ARQUIVO</p>
              <h2 id="upload-title">Adicionar documento</h2>
            </div>
          </div>
          <form className="upload-form" onSubmit={handleUpload}>
            <label className="file-picker" htmlFor="document-file">
              <span className="file-picker-mark" aria-hidden="true">+</span>
              <span>{selectedFile ? selectedFile.name : 'Escolher arquivo'}</span>
              <input
                id="document-file"
                type="file"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
            </label>
            <button className="primary-button" type="submit" disabled={isUploading || !selectedFile}>
              {isUploading ? 'Enviando...' : 'Enviar documento'}
            </button>
          </form>
          <p className="field-note">Um arquivo por envio. Tamanho máximo: 10 MiB.</p>
        </section>

        <section className="documents-section" aria-labelledby="documents-title">
          <div className="section-heading list-heading">
            <div>
              <p className="section-index">02 / ARQUIVO PESSOAL</p>
              <h2 id="documents-title">Seus documentos <span className="count">{documents.length}</span></h2>
            </div>
            <button className="text-button" type="button" onClick={refreshDocuments} disabled={isLoading}>
              {isLoading ? 'Atualizando...' : 'Atualizar lista'}
            </button>
          </div>

          {error && <p className="message error-message" role="alert">{error}</p>}
          {notice && <p className="message success-message" role="status">{notice}</p>}

          {isLoading ? (
            <p className="list-state">Carregando documentos...</p>
          ) : documents.length === 0 ? (
            <p className="list-state">Nenhum documento enviado por este usuário.</p>
          ) : (
            <ul className="document-list">
              {documents.map((document) => (
                <li className="document-row" key={document.id}>
                  <div className="document-mark" aria-hidden="true">DOC</div>
                  <div className="document-details">
                    <span className="document-name">{document.originalName}</span>
                    <span className="document-meta">{formatSize(document.size)} <span aria-hidden="true">·</span> {formatDate(document.uploadedAt)}</span>
                  </div>
                  <button
                    className="download-button"
                    type="button"
                    onClick={() => handleDownload(document)}
                    disabled={downloadingId === document.id}
                    aria-label={`Baixar ${document.originalName}`}
                    title="Baixar documento"
                  >
                    {downloadingId === document.id ? '...' : '↓'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <footer className="footer"><span>DOCUMENT MANAGEMENT SYSTEM</span><span>ARMAZENAMENTO LOCAL</span></footer>
    </main>
  );
}
