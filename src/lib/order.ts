import type { CartItem } from '../types'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (cents: number) => currency.format(cents / 100)

export function unitPrice(item: Pick<CartItem, 'product' | 'addOns' | 'recommendations'>): number {
  return (
    item.product.price +
    item.addOns.reduce((sum, extra) => sum + extra.price, 0) +
    item.recommendations.reduce((sum, product) => sum + product.price, 0)
  )
}

export function linePrice(item: CartItem): number {
  return unitPrice(item) * item.quantity
}

export function sameConfiguration(a: CartItem, b: Omit<CartItem, 'id'>): boolean {
  const ids = (items: { id: string }[]) =>
    items
      .map((item) => item.id)
      .sort()
      .join(',')
  return (
    a.product.id === b.product.id &&
    a.notes === b.notes &&
    ids(a.addOns) === ids(b.addOns) &&
    ids(a.recommendations) === ids(b.recommendations)
  )
}

export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
