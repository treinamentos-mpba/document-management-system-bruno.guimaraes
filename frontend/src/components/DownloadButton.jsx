import { useState } from 'react';
import { downloadDocument } from '../services/documents.js';

export default function DownloadButton({ document, userId, onError }) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    if (!userId.trim()) {
      onError('Informe um identificador de usuário.');
      return;
    }

    setIsDownloading(true);
    onError('');
    try {
      const file = await downloadDocument(userId.trim(), document.id);
      const objectUrl = URL.createObjectURL(file);
      try {
        const link = window.document.createElement('a');
        link.href = objectUrl;
        link.download = document.originalName;
        window.document.body.appendChild(link);
        try {
          link.click();
        } finally {
          link.remove();
        }
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (error) {
      onError(error.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <button
      className="download-button"
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      aria-label={`Baixar ${document.originalName}`}
      title="Baixar documento"
    >
      {isDownloading ? '...' : '↓'}
    </button>
  );
}
