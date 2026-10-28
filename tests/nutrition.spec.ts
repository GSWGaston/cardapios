import { expect, test } from '@playwright/test'

test('nutrition belongs to the selected product and follows price before extras', async ({
  page,
}) => {
  await page.goto('/#/produto/classico')
  const section = page.getByRole('region', { name: 'Informações nutricionais' })
  await expect(section).toBeVisible()
  await expect(section.locator('.nutrition-card')).toHaveCount(4)
  await expect(section.locator('.nutrition-card').first()).toHaveAttribute(
    'aria-label',
    'Calorias: 520 kcal',
  )
  await expect(section).toContainText('Por 1 unidade (180 g)')
  await expect(section).toContainText('Valores estimados para demonstração')
  await expect(section).toContainText('produto base, sem adicionais ou acompanhamentos')
  await expect(section).toContainText('Os anéis são decorativos')
  await expect(section.locator('.nutrition-ring svg[aria-hidden="true"]')).toHaveCount(4)
  const ringStyles = await section
    .locator('.nutrition-ring-accent')
    .evaluateAll((rings) => rings.map((ring) => getComputedStyle(ring).strokeDasharray))
  expect(new Set(ringStyles).size).toBe(1)
  const order = await page
    .locator('.detail-content > *')
    .evaluateAll((elements) => elements.map((element) => element.className))
  expect(order.indexOf('detail-title')).toBeLessThan(order.indexOf('nutrition-section'))
  expect(order.indexOf('nutrition-section')).toBeLessThan(order.indexOf('extras-section'))

  await page.getByRole('link', { name: 'Voltar ao cardápio' }).click()
  await page.getByRole('link', { name: 'Ver detalhes de Bacon & cheddar' }).click()
  await expect(section.locator('.nutrition-card').first()).toHaveAttribute(
    'aria-label',
    'Calorias: 635 kcal',
  )
  await expect(section).toContainText('Por 1 unidade (180 g)')
})

test('unavailable nutrition shows no made-up numbers', async ({ page }) => {
  await page.goto('/#/produto/combo-duplo')
  const section = page.getByRole('region', { name: 'Informações nutricionais' })
  await expect(section).toContainText('Informações nutricionais indisponíveis para este produto.')
  await expect(section.locator('.nutrition-card')).toHaveCount(0)
  await expect(section.locator('.nutrition-serving')).toHaveCount(0)
})

test('four cards fit on 390px and adapt to narrower and wider product layouts', async ({
  page,
}) => {
  await page.goto('/#/produto/classico')
  const cards = page.locator('.nutrition-card')
  for (const width of [390, 320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const positions = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, right: rect.right, width: rect.width }
      }),
    )
    expect(
      positions.every(
        ({ x, right, width: cardWidth }) => x >= 0 && right <= width && cardWidth >= 70,
      ),
    ).toBe(true)
    if (width === 320) {
      expect(positions[2].y).toBeGreaterThan(positions[0].y)
    } else {
      expect(positions.every(({ y }) => y === positions[0].y)).toBe(true)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test('selecting extras updates the price while base nutrition stays unchanged', async ({
  page,
}) => {
  await page.goto('/#/produto/classico')
  const section = page.getByRole('region', { name: 'Informações nutricionais' })
  const calories = section.locator('.nutrition-card').first()
  await expect(calories).toHaveAttribute('aria-label', 'Calorias: 520 kcal')
  await page.getByRole('button', { name: /^Adicionar Bacon extra,/ }).click()
  await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).click()
  await expect(page.locator('.order-total strong')).toHaveText(/R\$\s*65,80/)
  await expect(calories).toHaveAttribute('aria-label', 'Calorias: 520 kcal')
  await expect(section).toContainText('produto base, sem adicionais ou acompanhamentos')
})
