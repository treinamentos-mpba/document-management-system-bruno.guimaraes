# Especificação: Document Management System

## 1. Objetivo

Permitir que usuários enviem, listem e baixem seus documentos, armazenando os arquivos no filesystem local e mantendo os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos associados ao usuário da requisição.
- Download de um documento pelo identificador.
- Isolamento básico dos documentos por identificador de usuário.
- Interface web React para upload, listagem e download.

### Fora do escopo

- Armazenamento em nuvem ou em serviços externos.
- Persistência durável de metadados ou banco de dados.
- Versionamento, exclusão e compartilhamento de documentos.
- Cadastro, login e autenticação de usuários.
- Busca, paginação e categorização de documentos.

## 3. Premissas e identidade do usuário

- No MVP, as requisições identificam o usuário pelo cabeçalho `X-User-Id`.
- O cabeçalho serve somente para associar e filtrar documentos; não autentica o usuário. Portanto, não deve ser tratado como uma fronteira de segurança para exposição pública.
- O identificador deve ser não vazio. Requisições sem esse cabeçalho recebem `401`.
- Uma futura integração de autenticação deverá fornecer a identidade do usuário pelo contexto autenticado, sem alterar as regras de propriedade dos documentos.

## 4. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O usuário pode enviar um arquivo usando `multipart/form-data`, no campo `file`. |
| RF-02 | O sistema gera um identificador único e associa o documento ao usuário indicado por `X-User-Id`. |
| RF-03 | Após o upload, o sistema retorna os metadados públicos do documento criado. |
| RF-04 | O usuário pode listar somente os documentos associados ao seu identificador. |
| RF-05 | A listagem ordena os documentos do mais recente para o mais antigo. |
| RF-06 | O usuário pode baixar um documento próprio usando seu identificador. |
| RF-07 | Um documento inexistente ou pertencente a outro usuário não pode ser baixado; ambos os casos retornam `404`. |
| RF-08 | O sistema informa erros de entrada, tamanho e operação em formato JSON consistente. |
| RF-09 | O frontend permite upload, consulta da lista e download por meio da API. |

## 5. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local usando `multer` com `diskStorage`. |
| RNF-02 | O diretório padrão de armazenamento é `backend/storage`; pode ser sobrescrito por configuração. |
| RNF-03 | Os metadados ficam em memória e são perdidos ao reiniciar o processo. |
| RNF-04 | O tamanho máximo padrão é 10 MiB, configurável por variável de ambiente. |
| RNF-05 | O sistema não usa o nome original fornecido pelo cliente como nome físico do arquivo. |
| RNF-06 | Caminhos físicos e nomes internos de armazenamento não são expostos na API. |
| RNF-07 | Configurações operacionais são obtidas por variáveis de ambiente. |
| RNF-08 | O backend segue as camadas `routes -> controllers -> services -> repositories`. |
| RNF-09 | A comunicação frontend-backend usa `fetch` e o prefixo `/api` configurado no proxy do Vite. |

### Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `STORAGE_DIR` | `backend/storage` | Diretório local dos arquivos. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Limite de tamanho por arquivo, em bytes. |

Valores inválidos para porta, diretório ou limite devem ser tratados na inicialização ou validados antes do uso, sem falha silenciosa.

## 6. Modelo de dados

### Metadados públicos do documento

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string | Identificador único, gerado pelo servidor. |
| `originalName` | string | Nome original informado no upload. |
| `size` | number | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Data/hora do upload em ISO 8601. |
| `owner` | string | Identificador do usuário proprietário. |

### Dados internos de armazenamento

O repositório mantém também uma referência interna ao arquivo salvo, como caminho ou nome de armazenamento gerado pelo servidor. Essa referência não faz parte da resposta pública. O nome físico deve ser derivado de um identificador seguro gerado pelo servidor, nunca diretamente do nome recebido do cliente.

### Ciclo de vida

Os metadados são mantidos em memória. Após reinício, os arquivos podem continuar em `STORAGE_DIR`, mas não estarão disponíveis pela API porque seus metadados não persistem. A reconciliação ou limpeza desses arquivos não faz parte do MVP.

## 7. Contratos de API

Todos os endpoints de documentos exigem `X-User-Id`. Os caminhos abaixo são os caminhos do backend. No frontend, as chamadas usam `/api` e o proxy do Vite remove esse prefixo.

Formato padrão de erro:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrição legível do erro."
  }
}
```

### `POST /upload`

- Cabeçalho: `X-User-Id: <identificador>`.
- Content-Type: `multipart/form-data`.
- Campo obrigatório: `file`, exatamente um arquivo.
- Sucesso: `201 Created`.

```json
{
  "document": {
    "id": "uuid",
    "originalName": "relatorio.pdf",
    "size": 12345,
    "uploadedAt": "2026-10-28T12:00:00.000Z",
    "owner": "user-123"
  }
}
```

Erros esperados: `400` (`FILE_REQUIRED` ou requisição inválida), `401` (`USER_ID_REQUIRED`), `413` (`FILE_TOO_LARGE`) e `500` (`INTERNAL_ERROR`). Se o registro dos metadados falhar depois de salvar o arquivo, o arquivo recém-criado deve ser removido.

### `GET /documents`

- Cabeçalho: `X-User-Id: <identificador>`.
- Sucesso: `200 OK`.
- Retorna apenas documentos do usuário, ordenados por `uploadedAt` decrescente. Sem documentos, retorna uma lista vazia.

```json
{
  "documents": [
    {
      "id": "uuid",
      "originalName": "relatorio.pdf",
      "size": 12345,
      "uploadedAt": "2026-10-28T12:00:00.000Z",
      "owner": "user-123"
    }
  ]
}
```

Erro esperado: `401` (`USER_ID_REQUIRED`) ou `500` (`INTERNAL_ERROR`).

### `GET /documents/:id/download`

- Cabeçalho: `X-User-Id: <identificador>`.
- Sucesso: `200 OK`, corpo binário.
- Resposta inclui `Content-Disposition: attachment` com o nome original tratado com segurança e um `Content-Type` apropriado, usando `application/octet-stream` como fallback.
- Documento inexistente ou de outro usuário: `404` (`DOCUMENT_NOT_FOUND`).
- Identificador ausente ou inválido: `400` (`INVALID_DOCUMENT_ID`).
- Usuário não informado: `401` (`USER_ID_REQUIRED`).
- Falha de leitura: `500` (`FILE_READ_FAILED`).

## 8. Decisões arquiteturais

- `routes/`: registra endpoints e conecta middlewares e controllers.
- `controllers/`: valida dados HTTP, interpreta cabeçalhos e traduz resultados para status e respostas.
- `services/`: aplica regras de upload, propriedade, listagem e download.
- `repositories/`: mantém metadados em memória e resolve referências aos arquivos locais.
- `multer` com `diskStorage` grava os arquivos em diretório local configurado; seu limite de tamanho deve usar `MAX_FILE_SIZE_BYTES`.
- Falhas de upload após gravação devem remover o arquivo parcial ou órfão daquela operação.
- O frontend mantém a apresentação e chama a API por um serviço baseado em `fetch`.
- O endpoint `/health` existente é operacional e não substitui os contratos de documentos.

## 9. Riscos e limitações

- `X-User-Id` pode ser forjado sem autenticação; o MVP não é apropriado para exposição pública com dados sensíveis.
- Metadados em memória desaparecem no reinício, deixando arquivos locais sem referência pela API.
- Falhas abruptas durante upload podem deixar arquivos sem metadados; limpeza geral não está definida no MVP.
- O conteúdo e o tipo MIME não são uma prova de segurança do arquivo. O MVP não promete inspeção antimalware nem validação avançada de conteúdo.
- O limite de tamanho reduz uploads excessivos, mas não substitui limites operacionais do servidor.

## 10. Plano de execução

As etapas abaixo descrevem trabalho futuro. Nesta solicitação, não executar mudanças nos arquivos de backend ou frontend.

1. **Formalizar a especificação:** criar e revisar somente `docs/specs/dms-spec.md`. Aceite: requisitos, modelo, contratos, decisões, riscos e etapas registrados neste documento.
2. **Implementar o fluxo de upload no backend:** configurar armazenamento local, validação do arquivo, geração de metadados e limpeza em caso de falha. Aceite: upload válido retorna `201`; arquivo excedendo o limite ou requisição inválida recebe erro definido.
3. **Implementar listagem e download no backend:** aplicar isolamento por proprietário e respostas HTTP documentadas. Aceite: usuário lista e baixa somente documentos próprios; inexistentes ou de outro proprietário retornam `404`.
4. **Implementar a interface frontend:** permitir upload, exibir lista, apresentar estados de carregamento/erro e baixar arquivos usando a API via `/api`. Aceite: os fluxos principais funcionam pelo proxy do Vite.
5. **Verificar integração e critérios de aceite:** testar contratos, isolamento, erros, reinício e integração frontend-backend. Aceite: testes relevantes passam e as limitações de persistência e identidade permanecem documentadas.
```

O contexto consultado confirma que o modelo já prevê esses três endpoints e o armazenamento local; o backend atual ainda contém apenas `/health`, e o frontend é um seed. Referências: modelo, backend e proxy do Vite.