import { addOns, categories, products, recommendationIds } from './menu'
import type { MenuTemplateData, ThemeColors } from '../types'

export const defaultLight: ThemeColors = {
  background: '#faf9f6',
  card: '#ffffff',
  primary: '#f57823',
  secondary: '#202622',
  button: '#f57823',
  text: '#252522',
  muted: '#82827b',
  border: '#eae8e2',
  icon: '#f57823',
  selected: '#fff4eb',
}

export const defaultDark: ThemeColors = {
  background: '#171a18',
  card: '#242824',
  primary: '#ff9854',
  secondary: '#f7f3ed',
  button: '#ef7b31',
  text: '#f7f3ed',
  muted: '#bbbcb5',
  border: '#40443f',
  icon: '#ff9854',
  selected: '#3c2b20',
}

export function emptyTemplate(): MenuTemplateData {
  return {
    restaurant: { name: '', subtitle: '', description: '', display: 'text' },
    themes: { light: { ...defaultLight }, dark: { ...defaultDark } },
    font: 'dm-sans',
    categories: [],
    products: [],
    addOns: [],
    optionGroups: [],
    recommendationIds: [],
  }
}

export function demoTemplate(): MenuTemplateData {
  return {
    ...emptyTemplate(),
    categories: categories.map((item, order) => ({ ...item, visible: true, order })),
    products: products.map((item, order) => ({
      ...item,
      available: true,
      order,
      nutritionSource: item.nutrition ? ('estimate' as const) : undefined,
    })),
    addOns: addOns.map((item) => ({ ...item, available: true })),
    recommendationIds: [...recommendationIds],
  }
}
