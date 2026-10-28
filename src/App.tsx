import { useEffect, useRef, useState } from 'react'
import { Check, Search, ShoppingBag, X } from 'lucide-react'
import { products } from './data/menu'
import { sameConfiguration } from './lib/order'
import type { CartItem, CategoryId, Product } from './types'
import { MenuPage } from './pages/MenuPage'
import { ProductPage } from './pages/ProductPage'
import { CartDialog } from './components/CartDialog'

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('cardapio:favorites:v1') || '[]')
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string =>
                typeof id === 'string' && products.some((product) => product.id === id),
            ),
          ),
        ]
      : []
  } catch {
    return []
  }
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash)
  const [category, setCategory] = useState<CategoryId>('hamburgueres')
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(readFavorites)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null)
  const menuScroll = useRef(0)
  const productId = route.startsWith('#/produto/') ? route.slice('#/produto/'.length) : null
  const product = products.find((item) => item.id === productId)
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash)
    const onClick = (event: MouseEvent) => {
      if (
        !window.location.hash.startsWith('#/produto/') &&
        (event.target as Element).closest('a[href^="#/produto/"]')
      )
        menuScroll.current = window.scrollY
    }
    window.addEventListener('hashchange', onHashChange)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      document.removeEventListener('click', onClick)
    }
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: productId ? 0 : menuScroll.current, behavior: 'instant' })
      document
        .getElementById(productId ? 'product-main-heading' : 'hero-title')
        ?.focus({ preventScroll: true })
    })
    document.title = product
      ? `${product.name} — Cardápio`
      : 'Cardápio — Escolha seu próximo favorito'
    return () => cancelAnimationFrame(frame)
  }, [productId, product])

  useEffect(() => {
    try {
      localStorage.setItem('cardapio:favorites:v1', JSON.stringify(favorites))
    } catch {
      /* Keep favorites in memory when storage is unavailable. */
    }
  }, [favorites])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(timeout)
  }, [toast])

  function toggleFavorite(id: string) {
    setFavorites((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    )
  }

  function addItem(item: Omit<CartItem, 'id'>) {
    setCart((previous) => {
      const existing = previous.find(
        (line) => sameConfiguration(line, item) && line.quantity + item.quantity <= 99,
      )
      return existing
        ? previous.map((line) =>
            line.id === existing.id ? { ...line, quantity: line.quantity + item.quantity } : line,
          )
        : [...previous, { ...item, id: crypto.randomUUID() }]
    })
    setToast({ message: `${item.product.name} adicionado ao pedido.`, key: Date.now() })
  }

  function directAdd(selected: Product) {
    addItem({ product: selected, quantity: 1, addOns: [], recommendations: [], notes: '' })
  }

  function openSearch() {
    setSearchOpen(true)
    if (productId) window.location.hash = '#/'
    window.setTimeout(() => {
      const input = document.getElementById('menu-search')
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      input?.focus({ preventScroll: true })
    }, 100)
  }

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="header-inner page-shell">
          <a className="site-title" id="site-title" href="#/">
            Cardápio<span aria-hidden="true">.</span>
          </a>
          <span className="header-note">A fome passa. A vontade de repetir fica.</span>
          <div className="header-actions">
            <button
              className="icon-button header-search"
              aria-label="Abrir busca de produtos"
              onClick={openSearch}
            >
              <Search size={23} strokeWidth={1.7} />
            </button>
            <span className="header-divider" />
            <button
              className="cart-button"
              aria-label={`Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={21} strokeWidth={1.7} />
              <span className="cart-button-text">Meu pedido</span>
              <span className="cart-count">{count}</span>
            </button>
          </div>
        </div>
      </header>
      <div id="main-content" tabIndex={-1}>
        {product ? (
          <ProductPage
            key={product.id}
            product={product}
            favorite={favorites.includes(product.id)}
            onFavorite={toggleFavorite}
            onAdd={addItem}
          />
        ) : productId ? (
          <main className="not-found page-shell">
            <h1>Esse produto não está no cardápio.</h1>
            <a className="primary-button" href="#/">
              Voltar ao cardápio
            </a>
          </main>
        ) : (
          <MenuPage
            category={category}
            setCategory={setCategory}
            query={query}
            setQuery={setQuery}
            favoritesOnly={favoritesOnly}
            setFavoritesOnly={setFavoritesOnly}
            favorites={favorites}
            onFavorite={toggleFavorite}
            onAdd={directAdd}
            searchOpen={searchOpen}
          />
        )}
      </div>
      <CartDialog
        open={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onQuantity={(id, quantity) =>
          setCart((previous) =>
            previous.map((item) => (item.id === id ? { ...item, quantity } : item)),
          )
        }
        onRemove={(id) => setCart((previous) => previous.filter((item) => item.id !== id))}
      />
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className={`toast ${product ? 'detail-toast' : ''}`} key={toast.key}>
            <span className="toast-check">
              <Check size={17} />
            </span>
            <p>{toast.message}</p>
            <button
              className="toast-view"
              onClick={() => {
                setCartOpen(true)
                setToast(null)
              }}
            >
              Ver pedido
            </button>
            <button
              className="toast-close"
              aria-label="Fechar aviso"
              onClick={() => setToast(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
