import { db } from './db.ts'
import type { MenuTemplateData } from '../src/types.ts'

export function assetIds(data: MenuTemplateData) {
  const refs = [
    ...[data.themes.light, data.themes.dark].flatMap((mode) => [mode.logo, mode.nameImage]),
    ...data.categories.map((item) => item.image),
    ...data.products.map((item) => item.image),
    ...data.addOns.map((item) => item.image),
  ]
  return [
    ...new Set(
      refs.flatMap((ref) => {
        const match = /^\/api\/assets\/([a-f0-9-]{36})$/.exec(ref || '')
        return match ? [match[1]] : []
      }),
    ),
  ]
}

export async function assetsBelongTo(data: MenuTemplateData, templateId: string) {
  for (const assetId of assetIds(data)) {
    const owners = await db.execute({
      sql: 'SELECT template_id FROM asset_owners WHERE asset_id=?',
      args: [assetId],
    })
    if (owners.rows.length && !owners.rows.some((row) => row.template_id === templateId))
      return false
  }
  return true
}
