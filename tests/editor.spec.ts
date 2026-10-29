import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'

test('editor protects APIs, persists isolated drafts, previews and publishes a template', async ({
  page,
  request,
}) => {
  test.setTimeout(90000)
  const name = `Template de teste ${Date.now()}`
  const base = 'http://127.0.0.1:4173'
  const unauthorized = await request.get(`${base}/api/templates`)
  expect(unauthorized.status()).toBe(401)
  const unauthorizedWrite = await request.post(`${base}/api/templates`, { data: { name } })
  expect(unauthorizedWrite.status()).toBe(401)

  await page.goto('/editor')
  await expect(page.getByRole('heading', { name: 'Central de edição' })).toBeVisible()
  await page.locator('.ed-password input').fill('senha-incorreta')
  await page.getByRole('button', { name: 'Entrar no editor' }).click()
  await expect(page.getByRole('alert')).toContainText('Senha incorreta')
  await page.locator('.ed-password input').fill(process.env.EDITOR_TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar no editor' }).click()
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.screenshot({ path: 'test-results/editor-overview.png', fullPage: true })

  const admin = page.request
  const list = await (await admin.get(`${base}/api/templates`)).json()
  const original = list.find((item: { published: boolean }) => item.published)
  expect(original).toBeTruthy()
  const before = await (await admin.get(`${base}/api/public`)).json()
  let newId = ''
  let duplicateId = ''
  try {
    const created = await admin.post(`${base}/api/templates`, {
      data: { name, sourceId: original.id },
    })
    expect(created.status()).toBe(201)
    newId = (await created.json()).id
    const draft = structuredClone(original.draft)
    draft.restaurant.name = 'Restaurante de teste'
    draft.themes.light.primary = '#dd6542'
    draft.products[0].name = 'Produto alterado no rascunho'
    const saved = await admin.put(`${base}/api/templates/${newId}`, { data: { name, draft } })
    expect(saved.ok()).toBeTruthy()
    expect((await (await admin.get(`${base}/api/public`)).json()).products[0].name).toBe(
      before.products[0].name,
    )
    const afterReload = await (await admin.get(`${base}/api/templates`)).json()
    expect(
      afterReload.find((item: { id: string }) => item.id === newId).draft.products[0].name,
    ).toBe('Produto alterado no rascunho')
    expect(
      afterReload.find((item: { id: string }) => item.id === original.id).draft.products[0].name,
    ).toBe(before.products[0].name)

    const duplicated = await admin.post(`${base}/api/templates`, {
      data: { name: name + ' cópia', sourceId: newId },
    })
    duplicateId = (await duplicated.json()).id
    expect(duplicateId).not.toBe(newId)
    const deletedCopy = await admin.delete(`${base}/api/templates/${duplicateId}`)
    expect(deletedCopy.ok()).toBeTruthy()
    duplicateId = ''

    await page.reload()
    await page.getByRole('button', { name: 'Meus templates' }).click()
    await page
      .locator('.ed-template-card')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Abrir e editar' })
      .click()
    await page.getByRole('button', { name: 'Identidade visual' }).click()
    await page.getByLabel('Nome do restaurante').fill('Prévia em tempo real')
    await page.getByRole('button', { name: 'Pré-visualização' }).click()
    await expect(
      page.frameLocator('iframe[title="Pré-visualização do cardápio"]').locator('.site-title'),
    ).toContainText('Prévia em tempo real')
    await expect(page.getByText('Alterações não salvas')).toBeVisible()
    await page.getByRole('button', { name: 'Salvar', exact: true }).first().click()
    await expect(page.getByText('Alterações salvas com sucesso.')).toBeVisible()

    const published = await admin.post(`${base}/api/templates/${newId}/publish`)
    expect(published.ok()).toBeTruthy()
    const publicMenu = await (await admin.get(`${base}/api/public`)).json()
    expect(publicMenu.products[0].name).toBe('Produto alterado no rascunho')
    expect(publicMenu.restaurant.name).toBe('Prévia em tempo real')
    expect(publicMenu.themes.light.primary).toBe('#dd6542')
    const deletePublished = await admin.delete(`${base}/api/templates/${newId}`)
    expect(deletePublished.status()).toBe(409)

    const uploaded = await admin.post(`${base}/api/assets`, {
      data: {
        filename: 'teste.png',
        data: `data:image/png;base64,${readFileSync('assets/originals/onion.png').toString('base64')}`,
      },
    })
    expect(uploaded.status()).toBe(201)
    const asset = await admin.get(`${base}${(await uploaded.json()).url}`)
    expect(asset.ok()).toBeTruthy()
    expect(asset.headers()['content-type']).toContain('image/webp')
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#f57823"/></svg>'
    const svgUpload = await admin.post(`${base}/api/assets`, {
      data: {
        filename: 'logo.svg',
        data: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      },
    })
    expect(svgUpload.status()).toBe(201)
    const unsafeSvg = await admin.post(`${base}/api/assets`, {
      data: {
        filename: 'unsafe.svg',
        data: `data:image/svg+xml;base64,${Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')}`,
      },
    })
    expect(unsafeSvg.status()).toBe(400)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible()
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Navegação do editor' })).toBeVisible()
    await page.getByRole('button', { name: 'Fechar menu' }).click()
    await expect
      .poll(() =>
        page
          .locator('.ed-sidebar')
          .evaluate((element) => element.getBoundingClientRect().right <= 0),
      )
      .toBeTruthy()
    await page.screenshot({ path: 'test-results/editor-mobile.png', fullPage: true })
  } finally {
    if (original?.id) await admin.post(`${base}/api/templates/${original.id}/publish`)
    if (duplicateId) await admin.delete(`${base}/api/templates/${duplicateId}`)
    if (newId) await admin.delete(`${base}/api/templates/${newId}`)
  }
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.getByRole('button', { name: 'Sair' }).click()
  expect((await admin.get(`${base}/api/templates`)).status()).toBe(401)
})

test('published option group enforces required selection and updates cart total', async ({
  page,
  request,
}) => {
  const base = 'http://127.0.0.1:4173'
  await request.post(`${base}/api/auth/login`, {
    data: { password: process.env.EDITOR_TEST_PASSWORD },
  })
  const list = await (await request.get(`${base}/api/templates`)).json()
  const original = list.find((item: { published: boolean }) => item.published)
  const created = await request.post(`${base}/api/templates`, {
    data: { name: 'Teste de grupos', sourceId: original.id },
  })
  const id = (await created.json()).id
  try {
    const draft = structuredClone(original.draft)
    draft.optionGroups.push({
      id: 'test-group',
      name: 'Escolha o queijo',
      optionIds: ['cheddar', 'ovo'],
      min: 1,
      max: 2,
    })
    draft.addOns.find((item: { id: string }) => item.id === 'cheddar').maxQuantity = 2
    draft.products[0].groupIds = ['test-group']
    draft.products[0].extraIds = []
    draft.products[0].removableIngredients = ['Cebola']
    draft.products[0].nutrition.calories = 999
    draft.products[0].nutritionSource = 'provided'
    draft.themes.dark.background = '#101010'
    draft.categories.push({
      id: 'test-category',
      name: 'Categoria de teste',
      description: 'Criada pelo editor',
      visible: true,
      order: 9,
    })
    draft.products.push({
      ...structuredClone(draft.products[0]),
      id: 'test-product',
      category: 'test-category',
      name: 'Produto criado no editor',
      groupIds: [],
      order: 99,
    })
    expect(
      (
        await request.put(`${base}/api/templates/${id}`, {
          data: { name: 'Teste de grupos', draft },
        })
      ).ok(),
    ).toBeTruthy()
    expect((await request.post(`${base}/api/templates/${id}/publish`)).ok()).toBeTruthy()
    await page.goto('/?theme=dark')
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe('rgb(16, 16, 16)')
    await page
      .locator('.product-card')
      .filter({ hasText: 'Clássico da casa' })
      .getByRole('link', { name: 'Personalizar Clássico da casa' })
      .click()
    await expect(page.getByRole('button', { name: /Abrir carrinho, 0 itens/ })).toBeVisible()
    await page.goto('/#/produto/classico')
    await expect(page.locator('.nutrition-card').first()).toContainText('999')
    await page.getByRole('button', { name: /Adicionar ao carrinho/ }).click()
    await expect(page.getByRole('alert')).toContainText('Escolha pelo menos 1')
    const addCheddar = page
      .locator('.option-group')
      .getByRole('button', { name: 'Adicionar Queijo cheddar' })
    await addCheddar.click()
    await addCheddar.click()
    await expect(addCheddar).toBeDisabled()
    await page.getByRole('checkbox', { name: 'Sem Cebola' }).check()
    await page.getByRole('button', { name: /Adicionar ao carrinho/ }).click()
    await expect(page.getByRole('button', { name: /Abrir carrinho, 1 item/ })).toBeVisible()
    await expect(page.locator('.order-total strong')).toContainText('34,90')
    await page.getByRole('button', { name: /Abrir carrinho, 1 item/ }).click()
    await expect(page.locator('.cart-panel')).toContainText('Sem Cebola')
    await page.goto('/')
    await page.getByRole('button', { name: 'Categoria de teste' }).click()
    await expect(page.getByRole('heading', { name: 'Produto criado no editor' })).toBeVisible()
  } finally {
    await request.post(`${base}/api/templates/${original.id}/publish`)
    await request.delete(`${base}/api/templates/${id}`)
  }
})

test('login blocks repeated invalid attempts', async ({ request }) => {
  const db = createClient({ url: 'file:./data/test-cardapio-v2.db' })
  try {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await request.post('http://127.0.0.1:4173/api/auth/login', {
        data: { password: 'senha-incorreta' },
      })
      expect(response.status()).toBe(attempt === 5 ? 429 : 401)
    }
    const blocked = await request.post('http://127.0.0.1:4173/api/auth/login', {
      data: { password: process.env.EDITOR_TEST_PASSWORD },
    })
    expect(blocked.status()).toBe(429)
  } finally {
    await db.execute('DELETE FROM login_attempts')
    db.close()
  }
})
