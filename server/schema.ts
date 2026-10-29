import { z } from 'zod'

const text = (max = 300) => z.string().trim().max(max)
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)
const image = z
  .string()
  .max(500)
  .refine((value) => !value || /^\/(images\/|api\/assets\/)[\w.-]+$/.test(value), 'Imagem inválida')
const nutrition = z.object({
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbohydrates: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
  servingSize: text(100).min(1),
})
const colors = z
  .object({
    background: text(7),
    card: text(7),
    primary: text(7),
    secondary: text(7),
    button: text(7),
    text: text(7),
    muted: text(7),
    border: text(7),
    icon: text(7),
    selected: text(7),
    logo: image.optional(),
    nameImage: image.optional(),
  })
  .refine(
    (value) =>
      Object.entries(value).every(
        ([key, color]) => key === 'logo' || key === 'nameImage' || /^#[0-9a-fA-F]{6}$/.test(color),
      ),
    'Cor HEX inválida',
  )

export const templateSchema = z
  .object({
    restaurant: z.object({
      name: text(100),
      subtitle: text(160),
      description: text(500),
      display: z.enum(['text', 'logo', 'image']),
    }),
    themes: z.object({ light: colors, dark: colors }),
    font: z.enum(['dm-sans', 'manrope']),
    categories: z
      .array(
        z.object({
          id,
          name: text(100).min(1),
          description: text(300),
          image: image.optional(),
          visible: z.boolean().optional(),
          order: z.number().int().nonnegative().optional(),
        }),
      )
      .max(100),
    products: z
      .array(
        z.object({
          id,
          name: text(150).min(1),
          category: id,
          description: text(300),
          fullDescription: text(3000),
          price: z.number().int().nonnegative().max(100000000),
          image,
          imagePosition: text(100).optional(),
          time: text(100).optional(),
          portion: text(100),
          badge: text(80).optional(),
          customizable: z.boolean().optional(),
          nutrition: nutrition.optional(),
          nutritionSource: z.enum(['estimate', 'provided']).optional(),
          available: z.boolean().optional(),
          featured: z.boolean().optional(),
          order: z.number().int().nonnegative().optional(),
          ingredients: text(1000).optional(),
          removableIngredients: z
            .array(text(100))
            .max(50)
            .transform((items) => items.filter(Boolean))
            .optional(),
          allergens: text(1000).optional(),
          extraIds: z.array(id).optional(),
          recommendationIds: z.array(id).optional(),
          groupIds: z.array(id).optional(),
        }),
      )
      .max(1000),
    addOns: z
      .array(
        z.object({
          id,
          name: text(150).min(1),
          price: z.number().int().nonnegative().max(100000000),
          image,
          description: text(500).optional(),
          available: z.boolean().optional(),
          maxQuantity: z.number().int().min(1).max(20).optional(),
          nutrition: nutrition.optional(),
          nutritionSource: z.enum(['estimate', 'provided']).optional(),
        }),
      )
      .max(500),
    optionGroups: z
      .array(
        z
          .object({
            id,
            name: text(150).min(1),
            optionIds: z.array(id),
            min: z.number().int().nonnegative(),
            max: z.number().int().positive(),
          })
          .refine((group) => group.min <= group.max, 'Mínimo maior que máximo'),
      )
      .max(100),
    recommendationIds: z.array(id).max(100),
  })
  .superRefine((value, ctx) => {
    for (const [field, list] of [
      ['categories', value.categories],
      ['products', value.products],
      ['addOns', value.addOns],
      ['optionGroups', value.optionGroups],
    ] as const) {
      const ids = list.map((item) => item.id)
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', path: [field], message: 'Identificadores duplicados' })
    }
    const categories = new Set(value.categories.map((item) => item.id))
    const products = new Set(value.products.map((item) => item.id))
    const extras = new Set(value.addOns.map((item) => item.id))
    const groups = new Set(value.optionGroups.map((item) => item.id))
    value.optionGroups.forEach((group, index) => {
      if (group.optionIds.some((item) => !extras.has(item)))
        ctx.addIssue({
          code: 'custom',
          path: ['optionGroups', index, 'optionIds'],
          message: 'Adicional inexistente',
        })
    })
    value.products.forEach((item, index) => {
      if (!categories.has(item.category))
        ctx.addIssue({
          code: 'custom',
          path: ['products', index, 'category'],
          message: 'Categoria inexistente',
        })
      if (item.extraIds?.some((extra) => !extras.has(extra)))
        ctx.addIssue({
          code: 'custom',
          path: ['products', index, 'extraIds'],
          message: 'Adicional inexistente',
        })
      if (item.groupIds?.some((group) => !groups.has(group)))
        ctx.addIssue({
          code: 'custom',
          path: ['products', index, 'groupIds'],
          message: 'Grupo inexistente',
        })
      if (item.recommendationIds?.some((product) => !products.has(product)))
        ctx.addIssue({
          code: 'custom',
          path: ['products', index, 'recommendationIds'],
          message: 'Recomendação inexistente',
        })
    })
    if (value.recommendationIds.some((item) => !products.has(item)))
      ctx.addIssue({
        code: 'custom',
        path: ['recommendationIds'],
        message: 'Recomendação inexistente',
      })
  })

export function validatePublish(value: z.infer<typeof templateSchema>) {
  const errors: string[] = []
  if (!value.categories.some((item) => item.visible !== false))
    errors.push('Adicione ao menos uma categoria visível.')
  if (
    !value.products.some(
      (item) =>
        item.available !== false &&
        value.categories.some(
          (category) => category.id === item.category && category.visible !== false,
        ),
    )
  )
    errors.push('Adicione ao menos um produto disponível em categoria visível.')
  for (const product of value.products)
    for (const groupId of product.groupIds || []) {
      const group = value.optionGroups.find((item) => item.id === groupId)
      if (!group) continue
      const capacity = group.optionIds.reduce((sum, id) => {
        const extra = value.addOns.find((item) => item.id === id && item.available !== false)
        return sum + (extra?.maxQuantity || (extra ? 1 : 0))
      }, 0)
      if (group.min > capacity)
        errors.push(
          `${product.name}: o grupo ${group.name} não tem opções disponíveis suficientes.`,
        )
    }
  return errors
}
