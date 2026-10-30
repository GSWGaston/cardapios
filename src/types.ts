export type CategoryId = string

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
  nutritionSource?: 'estimate' | 'provided'
  available?: boolean
  featured?: boolean
  order?: number
  ingredients?: string
  removableIngredients?: string[]
  allergens?: string
  extraIds?: string[]
  recommendationIds?: string[]
  groupIds?: string[]
}

export interface AddOn {
  id: string
  name: string
  price: number
  image: string
  /** Optional per-selection values for a future nutrition calculation. */
  nutrition?: NutritionFacts
  nutritionSource?: 'estimate' | 'provided'
  description?: string
  available?: boolean
  maxQuantity?: number
}

export interface MenuCategory {
  id: string
  name: string
  description: string
  image?: string
  visible?: boolean
  order?: number
}

export interface OptionGroup {
  id: string
  name: string
  optionIds: string[]
  min: number
  max: number
}

export interface ThemeColors {
  background: string
  card: string
  primary: string
  secondary: string
  button: string
  text: string
  muted: string
  border: string
  icon: string
  selected: string
  logo?: string
  nameImage?: string
}

export interface MenuTemplateData {
  restaurant: {
    name: string
    subtitle: string
    description: string
    display: 'text' | 'logo' | 'image'
  }
  themes: { light: ThemeColors; dark: ThemeColors }
  font: 'dm-sans' | 'manrope'
  categories: MenuCategory[]
  products: Product[]
  addOns: AddOn[]
  optionGroups: OptionGroup[]
  recommendationIds: string[]
}

export interface MenuTemplate {
  id: string
  name: string
  draft: MenuTemplateData
  updatedAt: string
  published: boolean
  dirty: boolean
}

export interface ProjectDocs {
  title: string
  description: string
  establishment: string
  audience: string
  technologies: string
  siteUrl: string
  repositoryUrl: string
  codeRef: string
  architecture: string
  operations: string
  notes: string
  aiInstructions: string
}

export interface ProjectCapture {
  id: string
  title: string
  description: string
  screen: string
  device: string
  mode: string
  state: string
  createdAt: string
  position: number
}

export interface CartItem {
  id: string
  product: Product
  addOns: AddOn[]
  recommendations: Product[]
  notes: string
  quantity: number
}
