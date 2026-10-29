import { useState } from 'react';

export default function UploadComponent({ onUpload, onError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedFile) {
      onError('Selecione um arquivo para enviar.');
      return;
    }

    setIsUploading(true);
    onError('');
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      form.reset();
    } catch (error) {
      onError(error);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="upload-section" aria-labelledby="upload-title">
      <div className="section-heading">
        <div>
          <p className="section-index">01 / ARQUIVO</p>
          <h2 id="upload-title">Adicionar documento</h2>
        </div>
      </div>
      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="file-picker" htmlFor="document-file">
          <span className="file-picker-mark" aria-hidden="true">+</span>
          <span>{selectedFile ? selectedFile.name : 'Escolher arquivo'}</span>
          <input
            id="document-file"
            type="file"
            disabled={isUploading}
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          />
        </label>
        <button className="primary-button" type="submit" disabled={isUploading || !selectedFile}>
          {isUploading ? 'Enviando...' : 'Enviar documento'}
        </button>
      </form>
      <p className="field-note">Um arquivo por envio. Tamanho máximo: 10 MiB.</p>
    </section>
  );
}
