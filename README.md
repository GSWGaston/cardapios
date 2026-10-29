# Cardápio digital

Cardápio público em React, TypeScript e Vite, com editor administrativo em `/editor`. O editor gerencia templates independentes, categorias, produtos, adicionais, grupos de opções, recomendações, identidade visual e publicação. O carrinho continua no navegador e não envia pedidos.

## Executar localmente

Requer Node.js 22.12+ ou 24+. No PowerShell:

```powershell
npm.cmd install
npm.cmd run hash-password
```

O último comando solicita uma senha de pelo menos 12 caracteres e imprime apenas o hash. Crie um arquivo `.env` na raiz e cole a linha `ADMIN_PASSWORD_HASH=...` gerada. O arquivo é ignorado pelo Git. Não use a senha em código nem no frontend.

```powershell
npm.cmd run dev
```

Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`) para o cardápio e `/editor` para a central administrativa. A API local usa a porta 3001 e grava dados e imagens em `data/cardapio.db`. A primeira inicialização cria um **cardápio demonstrativo publicado**, sem nome ou logo de restaurante. Os valores nutricionais desse catálogo são estimativas fictícias. Os templates criados depois podem começar vazios ou ser duplicados.

`npm.cmd` evita o bloqueio de `npm.ps1` em algumas configurações do PowerShell. Em outros terminais, `npm` funciona normalmente.

## Como editar

1. Entre em `/editor` com a senha configurada.
2. Crie um template vazio ou duplique um existente em **Meus templates**.
3. Edite identidade visual, categorias, produtos, adicionais, grupos e recomendações.
4. Selecione **Salvar**. A prévia mobile ou desktop reflete alterações ainda não salvas, mas somente a versão salva pode ser recuperada ao retornar depois.
5. Selecione **Publicar** para atualizar o cardápio público. Alterações posteriores no template publicado permanecem em rascunho até uma nova publicação.

Só um template fica publicado por instalação. Para excluir o publicado, publique outro primeiro. Ao excluir uma categoria com produtos, realoque ou exclua esses produtos antes. Fotos e logos aceitam SVG, PNG e JPG de até 2 MB; o servidor valida e converte para WebP. Imagens enviadas ficam no banco, e a remoção de uma imagem no editor remove sua referência do template.

Os preços são armazenados em centavos. Os dados nutricionais cadastrados no editor são informados pelo administrador e mostram o produto base; adicionais não alteram esses valores. A seção nutricional só é salva com uma referência de porção. Imagens e valores do catálogo demonstrativo estão identificados como ilustrativos. Favoritos usam o armazenamento do navegador; o carrinho fica apenas no estado da página.

## Arquitetura e segurança

- `src/App.tsx` carrega o template publicado pela API e reaproveita as telas e componentes existentes. A prévia usa a mesma interface pública.
- `src/editor/` contém a interface administrativa separada da navegação pública.
- `server/` oferece API Express, validação no servidor com Zod, sessão em cookie HttpOnly, proteção por origem, limitação de tentativas de login e persistência libSQL.
- `api/index.ts` e `vercel.json` preparam a API para Vercel Functions e o frontend Vite para rotas `/editor` e `/preview`.
- `src/data/menu.ts` é apenas o catálogo inicial de demonstração. Depois da primeira inicialização, mudanças publicadas vêm do banco, sem edição de código.

A senha inicial é fornecida somente como hash `scrypt` em `ADMIN_PASSWORD_HASH`. Sessões são validadas no servidor, expiram após sete dias e podem ser encerradas pelo botão **Sair**. Após cinco tentativas de senha inválida por origem em 15 minutos, o login é bloqueado por 15 minutos. A autorização cobre as rotas de leitura de rascunhos, escrita, publicação e upload. Não há conta pública nem recuperação automática de senha.

## Preparar hospedagem na Vercel

O arquivo SQLite local não serve como armazenamento persistente em funções sem estado. Antes de publicar na Vercel, provisionar um banco libSQL/Turso persistente e configurar estas variáveis no projeto:

```text
ADMIN_PASSWORD_HASH=scrypt:<salt>:<hash>
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

Use uma senha e um banco próprios para produção. O build é `npm run build` e a saída estática é `dist`. A API usa a mesma origem do frontend. Nenhuma credencial de produção, banco remoto ou implantação foi configurada neste repositório. Verifique o roteamento das Functions e a conexão com o banco na implantação antes de disponibilizar o editor.

## Verificação

```powershell
npm.cmd run build
npm.cmd run typecheck:server
npm.cmd test
```

Os testes Playwright iniciam uma API e um banco de teste isolados, com senha aleatória guardada somente em `data/`. Cobrem login válido e inválido, bloqueio de APIs sem sessão, rascunhos isolados, salvar, duplicar, excluir, publicar, upload, prévia ao vivo, editor mobile e os fluxos públicos anteriores (busca, categorias, favoritos, adicionais, nutrição, carrinho e responsividade). No Windows, os testes usam Microsoft Edge; em outros sistemas, instale Chromium com `npx playwright install chromium`.

Para gerar capturas das telas públicas com o servidor de desenvolvimento aberto: `npm.cmd run screenshots`. Consulte [ASSETS.md](ASSETS.md) para fontes e licenças das fotografias ilustrativas.
