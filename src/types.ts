export type CategoryId = 'hamburgueres' | 'combos' | 'acompanhamentos' | 'bebidas' | 'sobremesas'

export interface NutritionFacts {
  /** Illustrative values for the uncustomized product, per serving. */
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  servingSize: string
}

export interface Product {
  id: string
  name: string
  category: CategoryId
  description: string
  fullDescription: string
  /** All monetary values are integer cents. */
  price: number
  image: string
  imagePosition?: string
  time?: string
  portion: string
  badge?: string
  customizable?: boolean
  nutrition?: NutritionFacts
}

export interface AddOn {
  id: string
  name: string
  price: number
  image: string
  /** Optional per-selection values for a future nutrition calculation. */
  nutrition?: NutritionFacts
}

export interface CartItem {
  id: string
  product: Product
  addOns: AddOn[]
  recommendations: Product[]
  notes: string
  quantity: number
}
