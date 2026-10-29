# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey brgsousa!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-mpba/document-management-system-bruno.guimaraes/issues/1)

---

## Execução e validação

Use Node.js 24 ou superior. Instale as dependências em cada pacote:

```bash
cd backend
npm install
npm test
cd ../frontend
npm install
npm run build
```

O workflow [CI](.github/workflows/ci.yml) executa esses passos em todo
`push` e `pull_request`. Os testes de integração usam HTTP real, porta
temporária e diretórios isolados, removidos ao final.

Para iniciar a API, execute `npm start` em `backend` (porta padrão 3000,
configurável por `PORT`):

- `POST /upload`: envie um único arquivo multipart no campo `file`;
  retorna HTTP 201 com `id`, `originalName`, `size`, `createdAt` e `owner`.
- `GET /documents`: retorna o array de metadados.
- `GET /documents/:id/download`: retorna o arquivo como anexo ou HTTP 404.
- `GET /health`: retorna `{ "status": "ok" }`.

Os arquivos ficam em `backend/storage`, com nomes internos únicos. Os metadados
ficam em memória e são perdidos ao reiniciar a API; os arquivos permanecem no
disco. Não há autenticação nesta fase e `owner` é `null`.
Uploads sem arquivo ou com campos de arquivo inesperados retornam HTTP 400.

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
