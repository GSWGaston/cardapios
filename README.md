# Cardápio digital

Cardápio público em React, TypeScript e Vite, com editor administrativo em `/editor`. Cada tema reúne um restaurante completo: identidade visual, categorias, produtos, adicionais, recomendações, documentação e capturas. O carrinho continua no navegador e não envia pedidos.

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

Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`) para o cardápio e `/editor` para a central administrativa. A API local usa a porta 3001 e grava dados e imagens em `data/cardapio.db`. A primeira inicialização abre uma biblioteca vazia; dados existentes no banco são preservados. O catálogo ilustrativo fica disponível apenas em prévias de temas vazios e nos testes.

`npm.cmd` evita o bloqueio de `npm.ps1` em algumas configurações do PowerShell. Em outros terminais, `npm` funciona normalmente.

## Como editar

1. Entre em `/editor`. A primeira tela é **Meus temas**.
2. Crie um tema vazio, crie a partir de outro ou duplique um card existente.
3. Edite identidade visual, categorias, produtos, adicionais, grupos e recomendações. Na paleta, escolha um grupo; a prévia mostra o componente real correspondente. **Visão geral** abre o site inteiro e **Fixar visão geral** mantém esse enquadramento durante a edição. A prévia aceita mobile/desktop, claro/escuro e cardápio/detalhes.
4. Selecione **Salvar** para persistir o rascunho e a documentação do projeto. A prévia e a exportação de rascunho também refletem alterações ainda não salvas.
5. No card da biblioteca, selecione **Selecionar destaque** e confirme a publicação. Só um tema fica em destaque e alimenta o site público. Alterações posteriores permanecem em rascunho até **Publicar alterações**.
6. Em **Projeto e Código**, preencha a documentação, envie capturas e use **Exportar para IA (ZIP)**. Escolha rascunho atual ou última publicação, capturas e assets disponíveis. Em execução local, é possível optar por incluir o código-base compartilhado. Na Vercel, o pacote inclui apenas a referência cadastrada, pois os arquivos-fonte completos não estão disponíveis de forma segura para a função.

Só um tema fica publicado por instalação. Para excluir o publicado, publique outro primeiro. Ao excluir uma categoria com produtos, realoque ou exclua esses produtos antes. Fotos e logos aceitam SVG, PNG e JPG de até 2 MB; capturas aceitam PNG, JPEG e WebP de até 5 MB. O servidor valida e converte imagens para WebP. As capturas privadas e os dados de projeto são vinculados ao tema; cópias recebem novos IDs e preservam os arquivos compartilhados.

Os preços são armazenados em centavos. Os dados nutricionais cadastrados no editor são informados pelo administrador e mostram o produto base; adicionais não alteram esses valores. A seção nutricional só é salva com uma referência de porção. Imagens e valores do catálogo demonstrativo estão identificados como ilustrativos. Favoritos usam o armazenamento do navegador; o carrinho fica apenas no estado da página.

## Arquitetura e segurança

- `src/App.tsx` carrega o template publicado pela API e reaproveita as telas e componentes existentes. A prévia usa a mesma interface pública.
- `src/editor/` contém a interface administrativa separada da navegação pública.
- `server/` oferece API Express, validação no servidor com Zod, sessão em cookie HttpOnly, proteção por origem, limitação de tentativas de login e persistência libSQL.
- `api/index.ts` e `vercel.json` preparam a API para Vercel Functions e o frontend Vite para rotas `/editor` e `/preview`.
- `src/data/menu.ts` é apenas catálogo ilustrativo para a prévia de um tema vazio e testes. O site público usa somente o tema publicado no banco.
- `server/projectRoutes.ts` e `server/exportProject.ts` armazenam documentação e capturas e geram o ZIP. As tabelas novas são criadas sem remover dados antigos.

A senha inicial é fornecida somente como hash `scrypt` em `ADMIN_PASSWORD_HASH`. Sessões são validadas no servidor, expiram após sete dias e podem ser encerradas pelo botão **Sair**. Após cinco tentativas de senha inválida por origem em 15 minutos, o login é bloqueado por 15 minutos. A autorização cobre as rotas de leitura de rascunhos, escrita, publicação, capturas e exportação. Não há conta pública nem recuperação automática de senha.

## Preparar hospedagem na Vercel

O arquivo SQLite local não serve como armazenamento persistente em funções sem estado. Antes de publicar na Vercel, provisionar um banco libSQL/Turso persistente e configurar estas variáveis no projeto:

```text
ADMIN_PASSWORD_HASH=scrypt:<salt>:<hash>
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

Use uma senha e um banco próprios para produção. O build é `npm run build` e a saída estática é `dist`. A API usa a mesma origem do frontend. Credenciais devem ficar somente nas variáveis da hospedagem ou em `.env` local ignorado pelo Git. Mesmo ao selecionar a inclusão de código local, o ZIP exclui `.env`, dependências instaladas, dados privados e arquivos fora da lista segura de fontes.

## Verificação

```powershell
npm.cmd run build
npm.cmd run typecheck:server
npm.cmd test
```

Os testes Playwright iniciam uma API e um banco de teste isolados, com senha aleatória guardada somente em `data/`. O catálogo demonstrativo é criado apenas nesse banco. Cobrem login, isolamento, publicação, upload, prévia contextual e fixável, documentação, capturas, ZIP e os fluxos públicos anteriores. No Windows, os testes usam Microsoft Edge; em outros sistemas, instale Chromium com `npx playwright install chromium`.

Para gerar capturas das telas públicas com o servidor de desenvolvimento aberto: `npm.cmd run screenshots`. Consulte [ASSETS.md](ASSETS.md) para fontes e licenças das fotografias ilustrativas.
