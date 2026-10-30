import { randomUUID } from 'node:crypto'
import type { MenuTemplateData } from '../src/types.ts'

/** Give a copied restaurant its own entity IDs while retaining its image references. */
export function cloneTemplateData(source: MenuTemplateData): MenuTemplateData {
  const data = structuredClone(source)
  const categories = new Map(data.categories.map((item) => [item.id, randomUUID()]))
  const products = new Map(data.products.map((item) => [item.id, randomUUID()]))
  const addOns = new Map(data.addOns.map((item) => [item.id, randomUUID()]))
  const groups = new Map(data.optionGroups.map((item) => [item.id, randomUUID()]))
  const map = (ids: string[] | undefined, values: Map<string, string>) =>
    ids?.map((id) => values.get(id) ?? id)

  data.categories.forEach((item) => {
    item.id = categories.get(item.id)!
  })
  data.addOns.forEach((item) => {
    item.id = addOns.get(item.id)!
  })
  data.optionGroups.forEach((item) => {
    item.id = groups.get(item.id)!
    item.optionIds = map(item.optionIds, addOns) || []
  })
  data.products.forEach((item) => {
    item.id = products.get(item.id)!
    item.category = categories.get(item.category) ?? item.category
    item.extraIds = map(item.extraIds, addOns)
    item.groupIds = map(item.groupIds, groups)
    item.recommendationIds = map(item.recommendationIds, products)
  })
  data.recommendationIds = map(data.recommendationIds, products) || []
  return data
}
