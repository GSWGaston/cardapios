# Cardápio

Aplicativo web de cardápio digital, mobile-first, desenvolvido em React, TypeScript, Vite, Tailwind CSS e Lucide React. Duas telas: cardápio e detalhes do produto, com resumo do carrinho em uma janela lateral. Interface neutra, sem marca de restaurante, inspirada nas referências fornecidas.

## Iniciar localmente

Requisito: Node.js 22.12+ ou 24+. Na pasta `D:\Cardapio`, execute no PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Abra o endereço exibido no terminal, normalmente **http://localhost:5173**. Se as dependências já estiverem instaladas, basta executar `npm.cmd run dev`. Para encerrar, pressione `Ctrl+C`.

`npm.cmd` evita o bloqueio de `npm.ps1` pela política de execução do PowerShell. Em macOS, Linux ou CMD, também é possível usar `npm`.

## Funcionalidades

- Grade com dois produtos por linha no mobile e adaptação para tablet e desktop.
- Cinco categorias com dados demonstrativos, fotos locais e preços em reais.
- Busca global por nome ou descrição, sem distinção entre maiúsculas e acentos.
- Favoritos persistidos no navegador com `localStorage` e filtro de favoritos.
- Navegação por links, suporte aos botões voltar/avançar do navegador e URL direta do produto, por exemplo `/#/produto/classico`.
- Adicionais opcionais com imagens transparentes, seleção visual e preço atualizado.
- Recomendações que podem ser incluídas e removidas.
- Quantidade de 1 a 99 e observações de até 300 caracteres.
- Adição direta pelos cards e adição personalizada pelos detalhes.
- Indicadores nutricionais ilustrativos por porção na tela de detalhes, com estado de informação indisponível.
- Carrinho com contador, agrupamento de configurações iguais, edição da quantidade, remoção e total.
- Confirmação visual ao adicionar, estados vazios e fallback local de imagens.
- Diálogo nativo com foco contido, fechamento por Escape, labels e suporte a movimento reduzido.

O carrinho fica no estado local da aplicação e reinicia ao atualizar a página. Os favoritos permanecem no navegador. Não há checkout, autenticação, painel administrativo, backend ou envio real de pedidos.

## Regra de cálculo

Todos os preços são representados em **centavos inteiros** para evitar erros de ponto flutuante:

```text
Total = quantidade × (produto + adicionais selecionados + recomendações selecionadas)
```

Cada recomendação corresponde a uma porção por unidade do produto principal. A interface informa essa regra. Por exemplo: 2 × (R$ 28,90 + cheddar R$ 3,00 + batata R$ 14,90) = **R$ 93,60**. O contador do carrinho soma as quantidades dos produtos principais; adicionais e recomendações integram a configuração de cada item.

Todos os adicionais desta demonstração são opcionais. Assim, os cards permitem adicionar diretamente ao carrinho.

## Estrutura

```text
src/
  components/     Imagem com fallback, card, quantidade e diálogo do carrinho
  data/menu.ts    Categorias, produtos, adicionais e recomendações
  lib/order.ts    Formatação monetária, cálculos e comparação de configurações
  pages/          MenuPage e ProductPage
  types.ts        Tipos compartilhados
  App.tsx         Navegação e estado do app
  index.css       Tokens, componentes visuais e responsividade
public/images/   Fotografias e ingredientes otimizados em WebP
assets/originals/ Imagens originais para futuras otimizações
tests/           Testes dos fluxos no navegador
```

Para adaptar o app, altere `src/data/menu.ts` e as fotos em `public/images/`. Os preços usam centavos: `2890` representa R$ 28,90. Consulte [ASSETS.md](ASSETS.md) para as fontes e licenças das imagens.

Cada produto pode incluir `nutrition` com `calories` (kcal), `protein`, `carbohydrates` e `fat` (g) e `servingSize`. Os valores atuais são estimativas fictícias para demonstração e mostram apenas o produto base; não incluem adicionais, recomendações ou alterações de quantidade. Se `nutrition` não estiver definido, a tela mostra uma mensagem de informação indisponível. O tipo dos adicionais já aceita informações nutricionais opcionais, mas nenhum adicional traz esses dados nesta demonstração. Para uso real, substitua as estimativas por dados nutricionais verificados.

Para gerar os arquivos WebP a partir dos originais:

```powershell
node scripts/optimize-images.mjs
```

## Compilação e verificação

```powershell
npm.cmd run build
npm.cmd run preview
```

O build valida TypeScript e gera `dist/`. O preview permite testar esse resultado localmente.

```powershell
npm.cmd run test:e2e
```

O comando compila o app e executa os 14 testes Playwright sobre o build de produção. A configuração usa Microsoft Edge no Windows. Em outros sistemas, utiliza Chromium, instalável com `npx playwright install chromium`.

Os testes cobrem busca, categorias, favoritos, imagens, navegação, cálculo da personalização, quantidade, adição direta, carrinho, informações nutricionais por produto, estado indisponível e ausência de transbordamento em 320, 390, 768 e 1440 px.

Com o servidor de desenvolvimento aberto, `npm.cmd run screenshots` gera capturas das duas telas em mobile e desktop na pasta `artifacts/`. Essa pasta e os resultados dos testes são ignorados pelo Git.

## Referências visuais

Os cards claros, as imagens grandes, os favoritos sobrepostos e os botões laranja seguem a referência do cardápio. A seção de adicionais usa o fundo escuro, as fotografias recortadas e os controles circulares da referência de ingredientes. As fotos dos produtos são ilustrativas; o conteúdo pode ser substituído por um catálogo real.
