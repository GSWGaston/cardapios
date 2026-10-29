import { useEffect, useRef, useState } from 'react'
import { Check, Search, ShoppingBag, X } from 'lucide-react'
import type { MenuTemplateData } from './types'
import { sameConfiguration } from './lib/order'
import type { CartItem, CategoryId, Product } from './types'
import { MenuPage } from './pages/MenuPage'
import { ProductPage } from './pages/ProductPage'
import { CartDialog } from './components/CartDialog'

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('cardapio:favorites:v1') || '[]')
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string'))]
      : []
  } catch {
    return []
  }
}

export default function App() {
  const previewId =
    window.location.pathname === '/preview' ? new URLSearchParams(location.search).get('id') : null
  const [menu, setMenu] = useState<MenuTemplateData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const previewReceived = useRef(false)
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(() => {
    const forced = new URLSearchParams(location.search).get('theme')
    return forced === 'dark' || (!forced && matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light'
  })
  const [route, setRoute] = useState(window.location.hash)
  const [category, setCategory] = useState<CategoryId>('')
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(readFavorites)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null)
  const menuScroll = useRef(0)
  const productId = route.startsWith('#/produto/') ? route.slice('#/produto/'.length) : null
  const products = menu?.products || []
  const brandSrc =
    menu?.themes[colorMode][menu.restaurant.display === 'logo' ? 'logo' : 'nameImage']
  const product = products.find((item) => item.id === productId && item.available !== false)
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch(previewId ? '/api/templates' : '/api/public', {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Não foi possível carregar o cardápio.')
        const payload = await response.json()
        const data: MenuTemplateData = previewId
          ? payload.find((item: { id: string }) => item.id === previewId)?.draft
          : payload
        if (!data) throw new Error('Prévia indisponível.')
        if (!cancelled && !(previewId && previewReceived.current)) {
          setMenu(data)
          setLoadError('')
          setCategory(data.categories.find((item) => item.visible !== false)?.id || '')
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Erro ao carregar.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [previewId, reloadKey])

  useEffect(() => {
    if (!previewId) return
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.data?.type !== 'cardapio-preview') return
      const data = event.data.draft as MenuTemplateData
      if (!data?.categories || !data.products || !data.themes) return
      previewReceived.current = true
      setMenu(data)
      setCategory((previous) =>
        data.categories.some((item) => item.id === previous)
          ? previous
          : data.categories[0]?.id || '',
      )
    }
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: 'cardapio-preview-ready' }, location.origin)
    return () => window.removeEventListener('message', receive)
  }, [previewId])

  useEffect(() => {
    if (new URLSearchParams(location.search).has('theme')) return
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setColorMode(media.matches ? 'dark' : 'light')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!menu) return
    const colors = menu.themes[colorMode]
    const root = document.documentElement
    root.dataset.menuTheme = colorMode
    root.style.setProperty('--orange', colors.primary)
    root.style.setProperty('--menu-background', colors.background)
    root.style.setProperty('--menu-card', colors.card)
    root.style.setProperty('--menu-text', colors.text)
    root.style.setProperty('--menu-muted', colors.muted)
    root.style.setProperty('--menu-border', colors.border)
    root.style.setProperty('--menu-button', colors.button)
    root.style.setProperty('--menu-selected', colors.selected)
    root.style.setProperty('--menu-secondary', colors.secondary)
    root.style.setProperty('--menu-icon', colors.icon)
    root.style.setProperty(
      '--menu-font',
      menu.font === 'manrope' ? "'Manrope Variable', sans-serif" : "'DM Sans Variable', sans-serif",
    )
  }, [menu, colorMode])

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

  if (loadError)
    return (
      <main className="not-found page-shell">
        <h1>{loadError}</h1>
        <button className="primary-button" onClick={() => setReloadKey((value) => value + 1)}>
          Tentar novamente
        </button>
      </main>
    )
  if (!menu)
    return (
      <main className="not-found page-shell" aria-live="polite">
        <h1>Carregando cardápio…</h1>
      </main>
    )

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
            {menu.restaurant.display === 'text' || !brandSrc ? (
              menu.restaurant.name || 'Cardápio'
            ) : (
              <img
                className="brand-image"
                src={brandSrc}
                alt={menu.restaurant.name || 'Cardápio'}
              />
            )}
            <span aria-hidden="true">.</span>
          </a>
          <span className="header-note">
            {menu.restaurant.subtitle || 'A fome passa. A vontade de repetir fica.'}
          </span>
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
            products={products}
            addOns={menu.addOns}
            optionGroups={menu.optionGroups || []}
            recommendationIds={menu.recommendationIds}
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
            categories={menu.categories}
            products={products}
            optionGroups={menu.optionGroups || []}
            restaurant={menu.restaurant}
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
