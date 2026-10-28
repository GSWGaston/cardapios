import { expect, test } from '@playwright/test'

test('mobile menu renders two columns, complete photos and touch targets', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu próximo')
  await expect(page.locator('.product-card')).toHaveCount(6)
  const cards = await page
    .locator('.product-card')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(cards[0].y).toEqual(cards[1].y)
  expect(cards[0].x).toBeLessThan(cards[1].x)
  expect(cards[2].y).toBeGreaterThan(cards[0].y)
  await page.locator('.footer').scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      page
        .locator('main img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true)
  for (const selector of ['.header-search', '.cart-button', '.favorite-button', '.add-button']) {
    const rect = await page.locator(selector).first().boundingBox()
    expect(rect!.width).toBeGreaterThanOrEqual(44)
    expect(rect!.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(errors).toEqual([])
})

test('all five category filters display their products', async ({ page }) => {
  await page.goto('/')
  for (const name of ['Combos', 'Acompanhamentos', 'Bebidas', 'Sobremesas']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('.product-card')).toHaveCount(2)
    await expect(page.locator('.category-title h2')).toHaveText(name)
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }
  await page.getByRole('button', { name: 'Hambúrgueres', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(6)
})

test('search ignores accents and searches across categories, with empty and reset states', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Bebidas', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir busca de produtos' }).click()
  await page.getByRole('searchbox', { name: 'Buscar produtos' }).fill('CLASSICO')
  await expect(page.locator('.product-card')).toHaveCount(2)
  await page.getByRole('searchbox').fill('frango')
  await expect(page.locator('.product-card')).toHaveCount(1)
  await expect(page.locator('.product-card h3')).toHaveText('Frango crocante')
  await page.getByRole('searchbox').fill('produto inexistente')
  await expect(page.getByText('Ainda não encontramos esse sabor')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar busca' }).click()
  await expect(page.locator('.category-title h2')).toHaveText('Bebidas')
  await expect(page.locator('.product-card')).toHaveCount(2)
})

test('favorites persist, filter the menu and can be removed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Filtrar favoritos' }).click()
  await expect(page.getByText('Seus favoritos moram aqui')).toBeVisible()
  await page.getByRole('button', { name: 'Filtrar favoritos' }).click()
  await page
    .getByRole('button', { name: 'Adicionar Clássico da casa aos favoritos', exact: true })
    .click()
  await page.reload()
  await page.getByRole('button', { name: 'Filtrar favoritos' }).click()
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Remover Clássico da casa dos favoritos' }).click()
  await expect(page.locator('.product-card')).toHaveCount(0)
  await expect(page.getByText('Seus favoritos moram aqui')).toBeVisible()
})

test('direct additions merge, update quantities and can be removed without checkout', async ({
  page,
}) => {
  await page.goto('/')
  const add = page.getByRole('button', {
    name: 'Adicionar Clássico da casa ao carrinho',
    exact: true,
  })
  await add.click()
  await add.click()
  await expect(page.getByText('Clássico da casa adicionado ao pedido.')).toBeVisible()
  await page.getByRole('button', { name: 'Abrir carrinho, 2 itens' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.cart-item')).toHaveCount(1)
  await expect(dialog.locator('.cart-summary strong')).toHaveText(/R\$\s*57,80/)
  await dialog.getByRole('button', { name: 'Diminuir quantidade de Clássico da casa' }).click()
  await expect(dialog.locator('.cart-summary strong')).toHaveText(/R\$\s*28,90/)
  await dialog.getByRole('button', { name: 'Remover Clássico da casa do carrinho' }).click()
  await expect(dialog.getByText('Seu pedido começa aqui')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir carrinho, 0 itens' })).toBeVisible()
})

test('customizations, recommendations and quantity arrive in cart with the exact total', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Ver detalhes de Clássico da casa' }).click()
  await expect(page).toHaveURL(/#\/produto\/classico$/)
  await expect(page.locator('.order-total strong')).toHaveText(/R\$\s*28,90/)
  await expect(
    page.getByRole('button', { name: 'Diminuir quantidade', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: /^Adicionar Bacon extra,/ }).click()
  await expect(page.locator('.order-total strong')).toHaveText(/R\$\s*32,90/)
  await page.getByRole('button', { name: /^Adicionar Queijo cheddar,/ }).click()
  await page.getByRole('button', { name: /^Adicionar Batata frita,/ }).click()
  await expect(page.locator('.order-total strong')).toHaveText(/R\$\s*50,80/)
  await page.getByRole('button', { name: /^Remover Bacon extra,/ }).click()
  await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).click()
  await expect(page.locator('.order-total strong')).toHaveText(/R\$\s*93,60/)
  await page.getByRole('textbox', { name: 'Alguma observação?' }).fill('Sem cebola, molho à parte.')
  await page.getByRole('button', { name: /Adicionar ao carrinho/ }).click()
  await page.getByRole('button', { name: 'Abrir carrinho, 2 itens' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('+ Queijo cheddar')).toBeVisible()
  await expect(dialog.getByText(/Com Batata frita/)).toBeVisible()
  await expect(dialog.getByText('“Sem cebola, molho à parte.”')).toBeVisible()
  await expect(dialog.locator('.cart-summary strong')).toHaveText(/R\$\s*93,60/)
  await dialog.getByRole('button', { name: 'Aumentar quantidade de Clássico da casa' }).click()
  await expect(dialog.locator('.cart-summary strong')).toHaveText(/R\$\s*140,40/)
  await dialog.getByRole('button', { name: 'Fechar carrinho' }).click()
  await page.getByRole('link', { name: 'Voltar ao cardápio' }).click()
  await expect(page.locator('.product-card')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Abrir carrinho, 3 itens' })).toBeVisible()
})

test('recommendations are reversible and vegetarian extras exclude bacon', async ({ page }) => {
  await page.goto('/#/produto/vegetariano')
  await expect(page.locator('.extra-card')).toHaveCount(4)
  await expect(page.getByRole('button', { name: /Adicionar Bacon extra/ })).toHaveCount(0)
  await page.getByRole('button', { name: /^Adicionar Refrigerante cola,/ }).click()
  await expect(page.locator('.order-total strong')).toHaveText(/R\$\s*37,90/)
  await page.getByRole('button', { name: /^Remover Refrigerante cola,/ }).click()
  await expect(page.locator('.order-total strong')).toHaveText(/R\$\s*30,90/)
})

test('separate configurations stay separate and drink details have no burger extras', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Adicionar Clássico da casa ao carrinho', exact: true })
    .click()
  await page.getByRole('link', { name: 'Ver detalhes de Clássico da casa' }).click()
  await page.getByRole('button', { name: /^Adicionar Ovo,/ }).click()
  await page.getByRole('button', { name: /Adicionar ao carrinho/ }).click()
  await page.getByRole('button', { name: 'Abrir carrinho, 2 itens' }).click()
  await expect(page.locator('.cart-item')).toHaveCount(2)
  await expect(page.locator('.cart-summary strong')).toHaveText(/R\$\s*60,30/)
  await page.keyboard.press('Escape')
  await page.goto('/#/produto/refrigerante')
  await expect(page.getByRole('heading', { level: 1, name: 'Refrigerante cola' })).toBeVisible()
  await expect(page.locator('.extras-section')).toHaveCount(0)
  await expect(page.locator('.recommendation-card')).toHaveCount(2)
})

test('image errors fall back to a local photograph', async ({ page }) => {
  await page.route('**/images/double.webp', (route) => route.abort())
  await page.goto('/')
  await expect(page.locator('.hero-image')).toHaveAttribute('src', '/images/classic.webp')
  await expect
    .poll(() =>
      page.locator('.hero-image').evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0)
})

test('responsive menu and details stay inside 320px, 768px and desktop viewports', async ({
  page,
}) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/', '/#/produto/classico']) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      const overflow = await page
        .locator('main button, main h1, main textarea')
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              if (element.closest('.category-nav')) return false
              const rect = element.getBoundingClientRect()
              return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1)
            })
            .map((element) => element.textContent),
        )
      expect(overflow).toEqual([])
    }
  }
})
