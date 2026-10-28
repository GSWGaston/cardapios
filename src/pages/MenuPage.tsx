import { useRef } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Beef,
  Coffee,
  Heart,
  IceCreamBowl,
  Layers,
  Leaf,
  Search,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react'
import { categories, products } from '../data/menu'
import { normalize } from '../lib/order'
import type { CategoryId, Product } from '../types'
import { ProductCard } from '../components/ProductCard'
import { FoodImage } from '../components/FoodImage'

const categoryIcons = {
  hamburgueres: Beef,
  combos: Layers,
  acompanhamentos: Utensils,
  bebidas: Coffee,
  sobremesas: IceCreamBowl,
}

interface Props {
  category: CategoryId
  setCategory: (id: CategoryId) => void
  query: string
  setQuery: (query: string) => void
  favoritesOnly: boolean
  setFavoritesOnly: (value: boolean) => void
  favorites: string[]
  onFavorite: (id: string) => void
  onAdd: (product: Product) => void
  searchOpen: boolean
}

export function MenuPage({
  category,
  setCategory,
  query,
  setQuery,
  favoritesOnly,
  setFavoritesOnly,
  favorites,
  onFavorite,
  onAdd,
  searchOpen,
}: Props) {
  const catalogRef = useRef<HTMLElement>(null)
  const currentCategory = categories.find((item) => item.id === category)!
  const normalizedQuery = normalize(query)
  const filtered = products.filter((product) => {
    const matchesCategory = normalizedQuery || favoritesOnly || product.category === category
    const matchesSearch = normalize(`${product.name} ${product.description}`).includes(
      normalizedQuery,
    )
    return matchesCategory && matchesSearch && (!favoritesOnly || favorites.includes(product.id))
  })
  const title = normalizedQuery
    ? 'Encontramos para você'
    : favoritesOnly
      ? 'Seus favoritos'
      : currentCategory.name

  function selectCategory(id: CategoryId) {
    setCategory(id)
    setQuery('')
    setFavoritesOnly(false)
  }

  return (
    <main className="menu-main page-shell">
      <section className="hero" aria-labelledby="hero-title">
        <FoodImage
          className="hero-image"
          src="/images/double.webp"
          alt="Hambúrguer com queijo derretido, cebola e pão de gergelim"
          loading="eager"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="hero-kicker">
            <span /> FEITO PARA DAR ÁGUA NA BOCA
          </span>
          <h1 id="hero-title" tabIndex={-1}>
            Seu próximo
            <br />
            favorito está <em>aqui.</em>
          </h1>
          <p>
            Escolha, personalize e aproveite.
            <br className="mobile-only" /> O próximo pedido é seu.
          </p>
          <button
            className="hero-button"
            onClick={() =>
              catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            Explorar cardápio <ArrowDown size={17} />
          </button>
        </div>
        <div className="hero-caption">
          <Sparkles size={15} />
          <span>Combinações que dão vontade.</span>
        </div>
      </section>
      <section className="catalog" ref={catalogRef} aria-labelledby="catalog-title">
        <div className="catalog-intro">
          <div>
            <span className="eyebrow">BOM APETITE, BOAS ESCOLHAS</span>
            <h2 id="catalog-title">
              O que vai ser hoje<span>?</span>
            </h2>
          </div>
          <span className="catalog-note">
            <Utensils size={16} /> Tem sempre um favorito para você.
          </span>
        </div>
        <nav className="category-nav" aria-label="Categorias do cardápio">
          {categories.map((item) => {
            const Icon = categoryIcons[item.id]
            return (
              <button
                key={item.id}
                className={`category-button ${category === item.id && !favoritesOnly && !normalizedQuery ? 'active' : ''}`}
                aria-pressed={category === item.id && !favoritesOnly && !normalizedQuery}
                onClick={() => selectCategory(item.id)}
              >
                <Icon size={20} strokeWidth={1.6} />
                {item.name}
              </button>
            )
          })}
        </nav>
        <div className="products-heading">
          <div className="category-title">
            <h2>{title}</h2>
            <span className="product-count">
              {filtered.length} {filtered.length === 1 ? 'opção' : 'opções'}
            </span>
            <p>
              {normalizedQuery
                ? `Resultados para “${query.trim()}” em todo o cardápio.`
                : favoritesOnly
                  ? 'Guarde os sabores que você quer pedir de novo.'
                  : currentCategory.description}
            </p>
          </div>
          <div className="catalog-tools">
            <label className={`search-field ${searchOpen ? 'search-is-open' : ''}`}>
              <Search size={18} />
              <input
                id="menu-search"
                type="search"
                placeholder="Busque seu próximo favorito"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Buscar produtos"
              />
              {query && (
                <button aria-label="Limpar busca" onClick={() => setQuery('')}>
                  <X size={16} />
                </button>
              )}
            </label>
            <button
              className={`favorites-filter ${favoritesOnly ? 'active' : ''}`}
              aria-label="Filtrar favoritos"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
            >
              <Heart size={17} fill={favoritesOnly ? 'currentColor' : 'none'} />
              <span>Favoritos</span>
            </button>
          </div>
        </div>
        {filtered.length > 0 ? (
          <div className="product-grid">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                favorite={favorites.includes(product.id)}
                onFavorite={onFavorite}
                onAdd={onAdd}
              />
            ))}
          </div>
        ) : (
          <div className="empty-results">
            <div className="empty-icon">
              {favoritesOnly ? <Heart size={30} /> : <Search size={30} />}
            </div>
            <h3>
              {favoritesOnly ? 'Seus favoritos moram aqui' : 'Ainda não encontramos esse sabor'}
            </h3>
            <p>
              {favoritesOnly
                ? 'Toque no coração de um produto para guardar por aqui.'
                : 'Tente outro nome ou ingrediente para encontrar o que procura.'}
            </p>
            <button
              className="text-button"
              onClick={() => {
                setQuery('')
                setFavoritesOnly(false)
              }}
            >
              Voltar às opções <ArrowRight size={16} />
            </button>
          </div>
        )}
        <div className="menu-bottom">
          <Leaf size={17} />
          <p>Seu pedido, do seu jeito. Personalize os produtos na tela de detalhes.</p>
          <SlidersHorizontal size={16} />
        </div>
      </section>
      <footer className="footer">
        <span>
          Cardápio<span className="orange-dot">.</span>
        </span>
        <p>Boas escolhas. Bons momentos.</p>
        <span className="footer-note">Fotografias ilustrativas.</span>
      </footer>
    </main>
  )
}
