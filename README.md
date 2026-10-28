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
| GET | `/documents` | Retorna `{ documents }` com os documentos do usuário. |
| GET | `/documents/:id/download` | Retorna o arquivo com seu nome original. |

Todos esses endpoints exigem o cabeçalho `X-User-Id`. Ele identifica o dono nesta
fase inicial; não representa autenticação. Documentos de outros usuários não são
listados e retornam `404` ao tentar baixá-los.

Os uploads usam `multer.diskStorage`, com nomes UUID e armazenamento local em
`backend/storage` por padrão. Os metadados ficam somente em memória e são perdidos
ao reiniciar o servidor; os arquivos permanecem no disco.

Configuração por variáveis de ambiente:

- `PORT`: porta HTTP (padrão: `3000`).
- `MAX_FILE_SIZE_BYTES`: limite por arquivo (padrão: `10485760`, ou 10 MiB).
- `STORAGE_DIR`: diretório local alternativo, útil para testes.

Erros usam `{ error: { code, message } }`, com status `400` para entrada inválida,
`401` para usuário ausente, `404` para documento inexistente ou de outro dono,
`413` para tamanho excedido e `500` para falhas internas ou de leitura.

---

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
