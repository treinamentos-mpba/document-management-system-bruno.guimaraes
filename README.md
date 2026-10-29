# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey brgsousa!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-mpba/document-management-system-bruno.guimaraes/issues/1)

## Backend

```sh
cd backend
npm ci
npm start
```

O servidor inicia em `http://localhost:3000`. Para executar os testes, use
`npm test` no mesmo diretório.

O fluxo segue `routes -> controllers -> services -> repositories`, dentro de
`backend/src`. O roteador está registrado em `backend/src/app.js`.

| Método | Endpoint | Entrada e resultado |
|---|---|---|
| POST | `/upload` | `multipart/form-data` com arquivo no campo `file`; retorna `201` com `{ document }`. |
| GET | `/documents?offset=0&limit=50` | Retorna `{ documents, pagination }` do usuário autenticado. |
| GET | `/documents/:id/download` | Retorna o arquivo com seu nome original. |

`GET /auth/mode` informa se o backend exige login. Em produção, configure
`AUTH_SECRET` e `AUTH_USERS_JSON`; `POST /auth/login` valida usuário/senha e emite
um bearer token com validade de uma hora. Senhas são armazenadas como hashes
scrypt, e o token fica somente em memória no frontend. A lista de usuários é
configuração operacional, não há cadastro de contas.

Sem configuração de autenticação, o backend aceita `X-User-Id` apenas para
desenvolvimento local. Esse modo não autentica usuários e não é seguro para
exposição pública. A inicialização com `NODE_ENV=production` falha se a
autenticação não estiver configurada.

Uploads usam `multer.diskStorage`, nomes UUID e armazenamento exclusivamente
local em `backend/storage` por padrão. Diretório e arquivos recebem permissões
restritas; metadados são persistidos em arquivos JSON locais, organizados por
hash do proprietário. A inicialização remove arquivos UUID sem metadados,
metadados sem arquivo e temporários de escrita interrompida. A API valida propriedade antes do download
e sempre entrega o conteúdo como `application/octet-stream`.

Configuração por variáveis de ambiente:

- `PORT`: porta HTTP (padrão: `3000`).
- `MAX_FILE_SIZE_BYTES`: limite por arquivo (padrão: `10485760`, ou 10 MiB).
- `MAX_DOCUMENTS_PER_USER`: limite de documentos por usuário (padrão: `1000`).
- `MAX_STORAGE_BYTES_PER_USER`: cota local por usuário (padrão: `1073741824`, ou 1 GiB).
- `STORAGE_DIR`: diretório local alternativo dedicado ao DMS.
- `AUTH_SECRET`: segredo aleatório de pelo menos 32 bytes, obrigatório com `AUTH_USERS_JSON`.
- `AUTH_USERS_JSON`: array JSON com usuários e hashes scrypt no formato `saltHex:hashHex`.

Para produção, gere um segredo e um hash localmente, sem colocar senhas em argumentos
de processos ou no repositório:

```bash
export NODE_ENV=production
export AUTH_SECRET="$(openssl rand -hex 32)"
read -s -p "Senha: " DMS_PASSWORD; printf '\n'
export PASSWORD_HASH="$(printf '%s' "$DMS_PASSWORD" | node -e '
  const { randomBytes, scryptSync } = require("node:crypto");
  let password = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { password += chunk; });
  process.stdin.on("end", () => {
    const salt = randomBytes(16);
    console.log(`${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`);
  });
')"
unset DMS_PASSWORD
export AUTH_USERS_JSON="[{\"id\":\"alice\",\"passwordHash\":\"$PASSWORD_HASH\"}]"
unset PASSWORD_HASH
```

Configure essas variáveis em um gerenciador de segredos no ambiente de execução.
O limite geral é de 120 requisições/minuto por IP, o de login é 5/minuto e o de
upload é 10/minuto. Limites de taxa e locks de cota são por processo; armazenamento
local e metadados não devem ser compartilhados entre réplicas sem uma camada de
coordenação/persistência apropriada.

Erros usam `{ error: { code, message } }`, com status `400` para entrada inválida,
`401` para autenticação/credenciais inválidas, `404` para documento inexistente
ou de outro dono, `413` para tamanho/cota excedidos, `429` para limite de taxa e
`500` para falhas internas ou de leitura.

## Frontend

Com o backend em execução:

```sh
cd frontend
npm ci
npm run dev
```

Acesse `http://localhost:5173`. Em desenvolvimento sem autenticação, informe o
identificador do usuário; em produção, entre com as credenciais configuradas.
Selecione um arquivo e clique em **Enviar documento**. A lista é paginada, atualiza
após cada envio e é limpa ao trocar de usuário. O botão de download salva o arquivo
com seu nome original.

O [App](frontend/src/App.jsx) monta os componentes funcionais
[UploadComponent](frontend/src/components/UploadComponent.jsx),
[DocumentList](frontend/src/components/DocumentList.jsx) e
[DownloadButton](frontend/src/components/DownloadButton.jsx). O
[cliente de API](frontend/src/services/documents.js) centraliza as chamadas `fetch`
com o prefixo `/api`, usando o proxy do Vite e bearer tokens quando a API exige login.

Execute `npm test` para verificar os componentes e o cliente de API, e
`npm run build` para gerar a versão de produção. Em produção, configure também
o encaminhamento de `/api` para o backend no servidor que hospeda o frontend.

---

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
