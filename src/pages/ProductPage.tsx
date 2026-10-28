import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  MessageSquare,
  Plus,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { addOns, products, recommendationIds } from '../data/menu'
import { money, unitPrice } from '../lib/order'
import type { CartItem, Product } from '../types'
import { FoodImage } from '../components/FoodImage'
import { QuantityControl } from '../components/QuantityControl'
import { NutritionSection } from '../components/NutritionSection'

interface Props {
  product: Product
  favorite: boolean
  onFavorite: (id: string) => void
  onAdd: (item: Omit<CartItem, 'id'>) => void
}

export function ProductPage({ product, favorite, onFavorite, onAdd }: Props) {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [selectedRecommendations, setSelectedRecommendations] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [added, setAdded] = useState(false)
  useEffect(() => {
    if (!added) return
    const timeout = window.setTimeout(() => setAdded(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [added])
  const availableRecommendations = recommendationIds
    .filter((id) => id !== product.id)
    .map((id) => products.find((item) => item.id === id)!)
  const item = {
    product,
    quantity,
    notes: notes.trim(),
    addOns: addOns.filter((extra) => selectedExtras.includes(extra.id)),
    recommendations: availableRecommendations.filter((recommendation) =>
      selectedRecommendations.includes(recommendation.id),
    ),
  }
  const total = unitPrice(item) * quantity
  const toggle = (id: string, selected: string[], setter: (value: string[]) => void) => {
    setter(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id])
    setAdded(false)
  }

  function addToCart() {
    onAdd(item)
    setAdded(true)
  }

  return (
    <main className="detail-main page-shell">
      <nav className="breadcrumb" aria-label="Navegação do produto">
        <a href="#/">
          <ArrowLeft size={17} />
          Voltar ao cardápio
        </a>
        <span>
          <ChevronRight size={14} />
          {product.name}
        </span>
      </nav>
      <div className="detail-layout">
        <div className="detail-visual">
          <div className="detail-photo">
            <FoodImage
              src={product.image}
              alt={product.name}
              style={{ objectPosition: product.imagePosition }}
              loading="eager"
            />
            {product.badge && (
              <span className="detail-badge">
                <Sparkles size={14} />
                {product.badge}
              </span>
            )}
            <button
              className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
              aria-pressed={favorite}
              aria-label={`${favorite ? 'Remover' : 'Adicionar'} ${product.name} ${favorite ? 'dos' : 'aos'} favoritos`}
              onClick={() => onFavorite(product.id)}
            >
              <Heart size={22} fill={favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="detail-photo-caption">
            <span>O sabor está nos detalhes.</span>
            <span>
              Monte a sua combinação <Sparkles size={15} />
            </span>
          </div>
        </div>
        <div className="detail-content">
          <div className="detail-title">
            <span className="eyebrow">UMA BOA ESCOLHA</span>
            <h1 id="product-main-heading" tabIndex={-1}>
              {product.name}
            </h1>
            <div className="detail-meta">
              {product.time && (
                <span>
                  <Clock3 size={15} />
                  {product.time}
                </span>
              )}
              <span>{product.portion}</span>
            </div>
            <p>{product.fullDescription}</p>
            <div className="detail-price">
              <span>{product.customizable ? 'A partir de' : 'Preço por unidade'}</span>
              <strong>{money(product.price)}</strong>
            </div>
          </div>
          <NutritionSection nutrition={product.nutrition} />
          {product.customizable && (
            <section className="extras-section" aria-labelledby="extras-title">
              <div className="extras-heading">
                <div>
                  <span className="eyebrow">DEIXE COM A SUA CARA</span>
                  <h2 id="extras-title">
                    Um toque a mais<span>.</span>
                  </h2>
                </div>
                <span className="optional-tag">Opcional</span>
              </div>
              <p>Escolha os adicionais que combinam com você.</p>
              <div className="extras-grid">
                {addOns
                  .filter((extra) => product.id !== 'vegetariano' || extra.id !== 'bacon-extra')
                  .map((extra) => {
                    const selected = selectedExtras.includes(extra.id)
                    return (
                      <button
                        key={extra.id}
                        className={`extra-card ${selected ? 'selected' : ''}`}
                        aria-pressed={selected}
                        aria-label={`${selected ? 'Remover' : 'Adicionar'} ${extra.name}, ${money(extra.price)}`}
                        onClick={() => toggle(extra.id, selectedExtras, setSelectedExtras)}
                      >
                        <span className="extra-toggle">
                          {selected ? <Check size={14} /> : <Plus size={14} />}
                        </span>
                        <FoodImage
                          src={extra.image}
                          alt={extra.name}
                          fallback="/images/cheddar.webp"
                        />
                        <span className="extra-name">{extra.name}</span>
                        <span className="extra-price">+ {money(extra.price)}</span>
                      </button>
                    )
                  })}
              </div>
            </section>
          )}
          <section className="recommendations" aria-labelledby="recommendations-title">
            <div className="section-heading">
              <h2 id="recommendations-title">
                Fica ainda melhor com<span>...</span>
              </h2>
              <span className="optional-tag">Opcional</span>
            </div>
            <p>Uma porção de cada item por unidade do pedido.</p>
            <div className="recommendation-grid">
              {availableRecommendations.map((recommendation) => {
                const selected = selectedRecommendations.includes(recommendation.id)
                return (
                  <button
                    key={recommendation.id}
                    className={`recommendation-card ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Remover' : 'Adicionar'} ${recommendation.name}, ${money(recommendation.price)}`}
                    onClick={() =>
                      toggle(recommendation.id, selectedRecommendations, setSelectedRecommendations)
                    }
                  >
                    <div className="recommendation-photo">
                      <FoodImage src={recommendation.image} alt={recommendation.name} />
                      <span className="recommendation-toggle">
                        {selected ? <Check size={15} /> : <Plus size={15} />}
                      </span>
                    </div>
                    <span className="recommendation-name">{recommendation.name}</span>
                    <span className="recommendation-size">{recommendation.portion}</span>
                    <strong>+ {money(recommendation.price)}</strong>
                  </button>
                )
              })}
            </div>
          </section>
          <section className="notes-section">
            <div className="section-heading">
              <label htmlFor="order-notes">
                <MessageSquare size={18} />
                Alguma observação?
              </label>
              <span className="optional-tag">Opcional</span>
            </div>
            <textarea
              id="order-notes"
              maxLength={300}
              placeholder="Ex.: sem cebola, molho à parte…"
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value)
                setAdded(false)
              }}
            />
            <span className="notes-count">{notes.length}/300</span>
          </section>
        </div>
      </div>
      <div className="order-bar">
        <div className="order-bar-inner">
          <div className="order-product">
            <FoodImage src={product.image} alt="" />
            <div>
              <span>Seu pedido, do seu jeito</span>
              <strong>{product.name}</strong>
            </div>
          </div>
          <QuantityControl
            value={quantity}
            onChange={(value) => {
              setQuantity(value)
              setAdded(false)
            }}
          />
          <div className="order-total">
            <span>Total</span>
            <strong aria-live="polite" aria-label={`Total: ${money(total)}`}>
              {money(total)}
            </strong>
          </div>
          <button
            className={`primary-button order-add ${added ? 'added' : ''}`}
            onClick={addToCart}
          >
            {added ? <Check size={19} /> : <ShoppingBag size={19} />}
            <span>{added ? 'Adicionado ao carrinho' : 'Adicionar ao carrinho'}</span>
            <span className="mobile-total">{money(total)}</span>
          </button>
        </div>
      </div>
    </main>
  )
}
