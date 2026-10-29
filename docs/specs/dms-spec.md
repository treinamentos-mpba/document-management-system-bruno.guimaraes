# Especificação: Document Management System

## 1. Objetivo

Permitir que usuários autenticados enviem, listem e baixem documentos, armazenando arquivos e metadados persistentes no filesystem local.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos associados ao usuário da requisição.
- Download de um documento pelo identificador.
- Isolamento dos documentos pela identidade autenticada.
- Persistência local de metadados, paginação e cotas por usuário.
- Interface web React para upload, listagem e download.

### Fora do escopo

- Armazenamento em nuvem ou em serviços externos.
- Banco de dados e armazenamento em nuvem/serviços externos.
- Versionamento, exclusão e compartilhamento de documentos.
- Cadastro e recuperação de contas; os usuários são configurados pelo operador.
- Busca e categorização de documentos.

## 3. Premissas e identidade do usuário

- Com `AUTH_SECRET` e `AUTH_USERS_JSON`, o backend autentica usuário/senha em `POST /auth/login` e identifica o usuário por bearer token assinado.
- Tokens têm validade de uma hora; o frontend os mantém apenas em memória.
- Sem essas variáveis, o modo local aceita `X-User-Id` para compatibilidade de desenvolvimento, mas não autentica e não pode ser exposto publicamente.
- `NODE_ENV=production` exige configuração completa de autenticação.

## 4. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O usuário pode enviar um arquivo usando `multipart/form-data`, no campo `file`. |
| RF-02 | O sistema gera identificador único e associa o documento à identidade autenticada. |
| RF-03 | Após o upload, o sistema retorna os metadados públicos do documento criado. |
| RF-04 | O usuário pode listar somente os documentos associados ao seu identificador. |
| RF-05 | A listagem ordena os documentos do mais recente para o mais antigo. |
| RF-06 | O usuário pode baixar um documento próprio usando seu identificador. |
| RF-07 | Um documento inexistente ou pertencente a outro usuário não pode ser baixado; ambos os casos retornam `404`. |
| RF-08 | O sistema informa erros de entrada, tamanho e operação em formato JSON consistente. |
| RF-09 | O frontend permite upload, consulta da lista e download por meio da API. |
| RF-10 | A listagem é paginada, por `offset` e `limit`, com tamanho máximo de página 100. |
| RF-11 | Upload e login aplicam limites de requisições; uploads também respeitam cotas por usuário. |

## 5. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local usando `multer` com `diskStorage`. |
| RNF-02 | O diretório padrão de armazenamento é `backend/storage`; pode ser sobrescrito por configuração. |
| RNF-03 | Metadados são persistidos em arquivos JSON locais, em diretórios por hash do proprietário. |
| RNF-04 | O tamanho máximo padrão é 10 MiB, configurável por variável de ambiente. |
| RNF-05 | O sistema não usa o nome original fornecido pelo cliente como nome físico do arquivo. |
| RNF-06 | Caminhos físicos e nomes internos de armazenamento não são expostos na API. |
| RNF-07 | Configurações operacionais são obtidas por variáveis de ambiente. |
| RNF-08 | O backend segue as camadas `routes -> controllers -> services -> repositories`. |
| RNF-09 | A comunicação frontend-backend usa `fetch` e o prefixo `/api` configurado no proxy do Vite. |
| RNF-10 | Arquivos e metadados locais recebem permissões restritas; downloads usam `application/octet-stream` e `nosniff`. |

### Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `STORAGE_DIR` | `backend/storage` | Diretório local dos arquivos. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Limite de tamanho por arquivo, em bytes. |
| `MAX_DOCUMENTS_PER_USER` | `1000` | Máximo de documentos por usuário. |
| `MAX_STORAGE_BYTES_PER_USER` | `1073741824` | Cota em bytes por usuário. |
| `AUTH_SECRET` | — | Segredo de pelo menos 32 bytes para assinatura de tokens. |
| `AUTH_USERS_JSON` | — | Usuários configurados e hashes de senha scrypt `saltHex:hashHex`. |

Valores inválidos para porta, diretório ou limite devem ser tratados na inicialização ou validados antes do uso, sem falha silenciosa.
Os limites padrão por IP são 120 requisições gerais/minuto, 5 tentativas de login/minuto e 10 uploads/minuto.

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

Cada metadado é gravado atomicamente em `.metadata/<sha256-do-proprietário>/<uuid>.json`; o conteúdo do arquivo usa o UUID como nome físico. Ao iniciar, a aplicação remove temporários e arquivos UUID sem metadados. O armazenamento é local e projetado para uma única instância; rate limits e locks de cotas não são distribuídos.

## 7. Contratos de API

Os caminhos abaixo são os caminhos do backend. No frontend, as chamadas usam `/api` e o proxy do Vite remove esse prefixo. Quando a autenticação está configurada, endpoints protegidos exigem `Authorization: Bearer <token>`; no modo local de desenvolvimento, aceitam `X-User-Id`.

Formato padrão de erro:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrição legível do erro."
  }
}
```

### `GET /auth/mode`

- Público; retorna `{ "authRequired": true|false }`.

### `POST /auth/login`

- JSON: `{ "userId": "...", "password": "..." }`.
- Sucesso: `200 OK`, retorna `{ "userId", "token" }`.
- Credenciais inválidas: `401` (`INVALID_CREDENTIALS`).
- Limite de tentativas: 5 por minuto e por IP.

### `POST /upload`

- Cabeçalho em produção: `Authorization: Bearer <token>`.
- Content-Type: `multipart/form-data`.
- Campo obrigatório: `file`, exatamente um arquivo.
- Sucesso: `201 Created`.
- Limites: tamanho configurável, um arquivo e nenhum campo multipart adicional; cota por proprietário.

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

Erros esperados: `400` (`FILE_REQUIRED` ou requisição inválida), `401` (`AUTHENTICATION_REQUIRED`), `413` (`FILE_TOO_LARGE` ou `USER_QUOTA_EXCEEDED`), `429` (limite de upload) e `500` (`INTERNAL_ERROR`). Se o registro dos metadados falhar, o arquivo recém-criado é removido.

### `GET /documents?offset=0&limit=50`

- Cabeçalho em produção: `Authorization: Bearer <token>`.
- Sucesso: `200 OK`.
- Retorna até 100 documentos do proprietário, ordenados por `uploadedAt` decrescente, além de `pagination` com `offset`, `limit`, `total` e `nextOffset`.

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
  ],
  "pagination": { "offset": 0, "limit": 50, "total": 1, "nextOffset": null }
}
```

Erros esperados: `400` (`INVALID_PAGINATION`), `401` (`AUTHENTICATION_REQUIRED`) ou `500` (`INTERNAL_ERROR`).

### `GET /documents/:id/download`

- Cabeçalho em produção: `Authorization: Bearer <token>`.
- Sucesso: `200 OK`, corpo binário.
- Resposta inclui `Content-Disposition: attachment`, `Content-Type: application/octet-stream`, `X-Content-Type-Options: nosniff` e `Cache-Control: private, no-store`.
- Documento inexistente ou de outro usuário: `404` (`DOCUMENT_NOT_FOUND`).
- Identificador ausente ou inválido: `400` (`INVALID_DOCUMENT_ID`).
- Usuário não autenticado: `401` (`AUTHENTICATION_REQUIRED`).
- Falha de leitura: `500` (`FILE_READ_FAILED`).

## 8. Decisões arquiteturais

- `routes/`: registra endpoints e conecta middlewares e controllers.
- `controllers/`: valida dados HTTP, interpreta cabeçalhos e traduz resultados para status e respostas.
- `services/`: aplica regras de upload, propriedade, listagem e download.
- `repositories/`: persiste metadados JSON em arquivos locais, separados por hash do proprietário.
- `multer` com `diskStorage` grava os arquivos em diretório local, com UUIDs; uploads têm limites de conteúdo, frequência, número e cotas.
- Falhas de upload removem o arquivo não registrado; a inicialização limpa resíduos UUID e temporários de operações interrompidas.
- O frontend mantém a apresentação e chama a API por um serviço baseado em `fetch`.
- O endpoint `/health` existente é operacional e não substitui os contratos de documentos.

## 9. Riscos e limitações

- O modo local sem autenticação continua vulnerável a falsificação de `X-User-Id`; somente use em desenvolvimento confiável.
- A configuração estática de usuários não oferece cadastro, recuperação de senha, revogação imediata de tokens nem gestão de sessões; tokens comprometidos expiram em uma hora.
- Dados e limites de taxa/cota são locais ao processo/disco; réplicas não devem compartilhar o armazenamento sem coordenação distribuída.
- O MIME enviado pelo cliente não prova o conteúdo; o DMS não promete inspeção antimalware ou validação avançada.
- Cotas e rate limits reduzem abuso, mas não substituem monitoramento de disco e limites operacionais do servidor.

## 10. Estado da implementação

Os fluxos de autenticação configurável, upload local, metadados persistentes, paginação, isolamento de propriedade, cotas e download seguro estão implementados. Uma evolução além de instância única deve substituir ou coordenar a persistência/rate limiting local antes de escalar horizontalmente.