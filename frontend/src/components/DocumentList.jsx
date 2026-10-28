import DownloadButton from './DownloadButton.jsx';

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

export default function DocumentList({ documents, isLoading, userId, onRefresh, onError, error, notice }) {
  return (
    <section className="documents-section" aria-labelledby="documents-title">
      <div className="section-heading list-heading">
        <div>
          <p className="section-index">02 / ARQUIVO PESSOAL</p>
          <h2 id="documents-title">Seus documentos <span className="count">{documents.length}</span></h2>
        </div>
        <button className="text-button" type="button" onClick={onRefresh} disabled={isLoading}>
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
              <DownloadButton document={document} userId={userId} onError={onError} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
