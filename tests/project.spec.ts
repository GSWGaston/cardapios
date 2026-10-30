import { expect, request as playwrightRequest, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import { demoTemplate } from '../src/data/template'

test('theme project is isolated, captures persist and ZIP contains only its data', async ({
  page,
  request,
}) => {
  test.setTimeout(90000)
  const base = 'http://127.0.0.1:4173'
  const name = `Projeto de teste ${Date.now()}`
  const login = await request.post(`${base}/api/auth/login`, {
    data: { password: process.env.EDITOR_TEST_PASSWORD },
  })
  expect(login.ok()).toBeTruthy()
  const created = await request.post(`${base}/api/templates`, { data: { name } })
  expect(created.status()).toBe(201)
  const id = (await created.json()).id as string
  let copyId = ''
  let otherId = ''
  let sourceDeleted = false
  try {
    const draft = demoTemplate()
    draft.restaurant.name = name
    expect(
      (await request.put(`${base}/api/templates/${id}`, { data: { name, draft } })).ok(),
    ).toBeTruthy()
    const docs = {
      title: 'Projeto do cardápio',
      description: 'Descrição própria',
      establishment: '',
      audience: '',
      technologies: 'React',
      siteUrl: '',
      repositoryUrl: '',
      codeRef: '',
      architecture: '',
      operations: '',
      notes: 'TURSO_AUTH_TOKEN=segredo-ficticio',
      aiInstructions: 'Usar somente os dados do pacote.',
    }
    expect(
      (await request.put(`${base}/api/templates/${id}/project`, { data: docs })).ok(),
    ).toBeTruthy()
    const imageData = `data:image/png;base64,${readFileSync('assets/originals/onion.png').toString('base64')}`
    const uploaded = await request.post(`${base}/api/templates/${id}/captures`, {
      data: {
        title: 'Cardápio mobile',
        description: 'Referência',
        screen: 'cardapio',
        device: 'mobile',
        mode: 'light',
        state: '',
        data: imageData,
      },
    })
    expect(uploaded.status()).toBe(201)
    const captureId = (await uploaded.json()).id
    const anonymous = await playwrightRequest.newContext()
    expect(
      (await anonymous.get(`${base}/api/templates/${id}/captures/${captureId}`)).status(),
    ).toBe(401)
    expect((await anonymous.get(`${base}/api/templates/${id}/export`)).status()).toBe(401)
    await anonymous.dispose()
    expect(
      (
        await request.put(`${base}/api/templates/${id}/captures/${captureId}/file`, {
          data: { data: imageData },
        })
      ).ok(),
    ).toBeTruthy()
    const project = await (await request.get(`${base}/api/templates/${id}/project`)).json()
    expect(project.docs.title).toBe(docs.title)
    expect(project.captures).toHaveLength(1)
    expect(
      (await request.get(`${base}/api/templates/${id}/captures/${captureId}`)).headers()[
        'content-type'
      ],
    ).toContain('image/webp')
    const exported = await request.get(
      `${base}/api/templates/${id}/export?version=draft&captures=1&assets=0`,
    )
    expect(exported.ok()).toBeTruthy()
    const files = unzipSync(new Uint8Array(await exported.body()))
    const paths = Object.keys(files)
    expect(paths).toContain('projeto-cardapio/configuracoes.json')
    expect(paths).toContain('projeto-cardapio/estrutura-e-funcionalidades.md')
    expect(paths).toContain('projeto-cardapio/capturas/indice.json')
    expect(paths).toContain('projeto-cardapio/manifesto.json')
    expect(paths.some((path) => path.endsWith(`${captureId}.webp`))).toBeTruthy()
    expect(
      JSON.parse(strFromU8(files['projeto-cardapio/configuracoes.json'])).restaurant.name,
    ).toBe(name)
    expect(strFromU8(files['projeto-cardapio/documentacao.md'])).not.toContain('segredo-ficticio')
    expect(strFromU8(files['projeto-cardapio/documentacao.md'])).toContain('[REDACTED]')
    expect(JSON.parse(strFromU8(files['projeto-cardapio/manifesto.json'])).version).toBe('draft')

    const assetUpload = await request.post(`${base}/api/assets`, {
      data: { filename: 'logo.png', templateId: id, data: imageData },
    })
    expect(assetUpload.status()).toBe(201)
    const assetUrl = (await assetUpload.json()).url as string
    draft.themes.light.logo = assetUrl
    expect(
      (await request.put(`${base}/api/templates/${id}`, { data: { name, draft } })).ok(),
    ).toBeTruthy()

    const duplicate = await request.post(`${base}/api/templates`, {
      data: { name: `${name} cópia`, sourceId: id },
    })
    expect(duplicate.status()).toBe(201)
    copyId = (await duplicate.json()).id
    const list = await (await request.get(`${base}/api/templates`)).json()
    const source = list.find((item: { id: string }) => item.id === id)
    const copy = list.find((item: { id: string }) => item.id === copyId)
    expect(copy.draft.products[0].id).not.toBe(source.draft.products[0].id)
    expect(copy.draft.products[0].category).toBe(
      copy.draft.categories.find(
        (category: { id: string }) => category.id === copy.draft.products[0].category,
      )?.id,
    )
    expect(
      (await (await request.get(`${base}/api/templates/${copyId}/project`)).json()).captures,
    ).toHaveLength(1)
    expect(copy.draft.themes.light.logo).toBe(assetUrl)
    expect(
      (
        await request.put(`${base}/api/templates/${copyId}`, {
          data: { name: `${name} cópia`, draft: copy.draft },
        })
      ).ok(),
    ).toBeTruthy()
    const unrelated = await request.post(`${base}/api/templates`, {
      data: { name: 'Outro tema isolado' },
    })
    otherId = (await unrelated.json()).id
    expect(
      (
        await request.put(`${base}/api/templates/${otherId}`, {
          data: { name: 'Outro tema isolado', draft },
        })
      ).status(),
    ).toBe(403)

    await page.goto('/editor')
    await page.locator('.ed-password input').fill(process.env.EDITOR_TEST_PASSWORD!)
    await page.getByRole('button', { name: 'Entrar no editor' }).click()
    await page
      .locator('.ed-template-card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) })
      .getByRole('button', { name: 'Abrir e editar' })
      .click()
    await page.getByRole('button', { name: 'Cards de produtos' }).click()
    const frame = page.frameLocator('.ed-identity-preview iframe')
    await expect(frame.locator('.product-card').first()).toBeVisible()
    await expect(frame.locator('html')).toHaveAttribute('data-preview-context', 'cards')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: 'test-results/identity-cards.png', fullPage: true })
    await page
      .locator('.ed-identity-preview')
      .getByRole('button', { name: 'Visão geral', exact: true })
      .click()
    await page.getByRole('button', { name: 'Estrutura e fundos' }).click()
    await expect(frame.locator('html')).toHaveAttribute('data-preview-context', 'structure')
    await page.getByRole('button', { name: 'Cards de produtos' }).click()
    await expect(page.locator('.ed-identity-preview')).toHaveAttribute('data-context', 'cards')
    await expect(frame.locator('html')).toHaveAttribute('data-preview-context', 'cards')
    await page
      .locator('.ed-identity-preview')
      .getByRole('button', { name: 'Visão geral', exact: true })
      .click()
    await page.getByRole('button', { name: 'Fixar visão geral' }).click()
    await page.locator('.ed-identity-preview').getByRole('button', { name: 'Desktop' }).click()
    await expect(page.locator('.ed-identity-preview iframe')).toHaveAttribute(
      'style',
      /width: 1280px/,
    )
    await page.locator('.ed-identity-preview').getByRole('button', { name: 'Escuro' }).click()
    await expect(frame.locator('html')).toHaveAttribute('data-menu-theme', 'dark')
    await page.locator('.ed-identity-preview').getByRole('button', { name: 'Detalhes' }).click()
    await expect(frame.locator('.detail-title')).toBeVisible()
    await page.locator('.ed-identity-preview').getByRole('button', { name: 'Cardápio' }).click()
    await page.locator('.ed-identity-preview').getByRole('button', { name: 'Claro' }).click()
    await page.getByRole('button', { name: 'Botões e ações' }).click()
    await expect(frame.locator('html')).toHaveAttribute('data-preview-context', 'overview')
    await page.getByLabel('Botões HEX').fill('#112233')
    await expect
      .poll(() =>
        frame
          .locator('html')
          .evaluate((element) => element.style.getPropertyValue('--menu-button')),
      )
      .toBe('#112233')
    await page.getByLabel('Botões HEX').fill('#1')
    await expect
      .poll(() =>
        frame
          .locator('html')
          .evaluate((element) => element.style.getPropertyValue('--menu-button')),
      )
      .toBe('#112233')
    await page.getByLabel('Botões HEX').fill('#112233')
    await page.getByRole('button', { name: 'Visão geral fixada' }).click()
    await expect(frame.locator('html')).toHaveAttribute('data-preview-context', 'actions')
    await page.getByRole('button', { name: 'Projeto e Código' }).click()
    await expect(page.getByRole('heading', { name: 'Projeto e Código' }).last()).toBeVisible()
    await expect(page.locator('.ed-capture-card')).toHaveCount(1)
    await page.getByLabel('Descrição e objetivo').fill('Descrição salva pela interface')
    await page.getByLabel('Incluir código-base local').check()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar para IA (ZIP)' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
    const currentZip = unzipSync(new Uint8Array(readFileSync(await download.path())))
    expect(currentZip['projeto-cardapio/codigo-fonte/src/App.tsx']).toBeDefined()
    expect(
      Object.keys(currentZip).some(
        (path) =>
          /(^|\/)(?:\.env[^/]*|node_modules|\.git)(\/|$)/.test(path) ||
          path.startsWith('projeto-cardapio/data/'),
      ),
    ).toBe(false)
    expect(
      JSON.parse(strFromU8(currentZip['projeto-cardapio/configuracoes.json'])).themes.light.button,
    ).toBe('#112233')
    const bundledLogo = JSON.parse(strFromU8(currentZip['projeto-cardapio/configuracoes.json']))
      .themes.light.logo
    expect(bundledLogo).toMatch(/^assets\//)
    expect(currentZip[`projeto-cardapio/${bundledLogo}`]).toBeDefined()
    expect(strFromU8(currentZip['projeto-cardapio/documentacao.md'])).toContain(
      'Descrição salva pela interface',
    )
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Alterações salvas com sucesso.')).toBeVisible()
    expect(
      (await (await request.get(`${base}/api/templates/${id}/project`)).json()).docs.description,
    ).toBe('Descrição salva pela interface')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBeTruthy()
    expect((await request.delete(`${base}/api/templates/${id}`)).ok()).toBeTruthy()
    sourceDeleted = true
    const remaining = await (await request.get(`${base}/api/templates/${copyId}/project`)).json()
    expect(remaining.captures).toHaveLength(1)
    expect(
      (
        await request.get(`${base}/api/templates/${copyId}/captures/${remaining.captures[0].id}`)
      ).ok(),
    ).toBeTruthy()
  } finally {
    if (otherId) await request.delete(`${base}/api/templates/${otherId}`)
    if (copyId) await request.delete(`${base}/api/templates/${copyId}`)
    if (!sourceDeleted) await request.delete(`${base}/api/templates/${id}`)
  }
})
