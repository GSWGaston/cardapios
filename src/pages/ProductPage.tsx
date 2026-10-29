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
import { money, unitPrice } from '../lib/order'
import type { AddOn, CartItem, OptionGroup, Product } from '../types'
import { FoodImage } from '../components/FoodImage'
import { QuantityControl } from '../components/QuantityControl'
import { NutritionSection } from '../components/NutritionSection'

interface Props {
  product: Product
  products: Product[]
  addOns: AddOn[]
  optionGroups: OptionGroup[]
  recommendationIds: string[]
  favorite: boolean
  onFavorite: (id: string) => void
  onAdd: (item: Omit<CartItem, 'id'>) => void
}

export function ProductPage({
  product,
  products,
  addOns,
  optionGroups,
  recommendationIds,
  favorite,
  onFavorite,
  onAdd,
}: Props) {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [selectedRecommendations, setSelectedRecommendations] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([])
  const [added, setAdded] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  useEffect(() => {
    if (!added) return
    const timeout = window.setTimeout(() => setAdded(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [added])
  const availableRecommendations = (product.recommendationIds || recommendationIds)
    .filter((id) => id !== product.id)
    .map((id) => products.find((item) => item.id === id && item.available !== false))
    .filter((item): item is Product => Boolean(item))
  const item = {
    product,
    quantity,
    notes: [notes.trim(), ...removedIngredients.map((ingredient) => `Sem ${ingredient}`)]
      .filter(Boolean)
      .join(' · '),
    addOns: selectedExtras
      .map((id) => addOns.find((extra) => extra.id === id && extra.available !== false))
      .filter((extra): extra is AddOn => Boolean(extra)),
    recommendations: availableRecommendations.filter((recommendation) =>
      selectedRecommendations.includes(recommendation.id),
    ),
  }
  const total = unitPrice(item) * quantity
  const toggle = (id: string, selected: string[], setter: (value: string[]) => void) => {
    setter(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id])
    setAdded(false)
  }
  function changeExtra(extra: AddOn, amount: 1 | -1, group?: OptionGroup) {
    setSelectedExtras((previous) => {
      const count = previous.filter((id) => id === extra.id).length
      if (amount > 0) {
        if (count >= (extra.maxQuantity || 1)) return previous
        if (group?.max === 1)
          return [...previous.filter((id) => !group.optionIds.includes(id)), extra.id]
        if (group && previous.filter((id) => group.optionIds.includes(id)).length >= group.max)
          return previous
        return [...previous, extra.id]
      }
      const index = previous.indexOf(extra.id)
      return index < 0 ? previous : previous.filter((_, position) => position !== index)
    })
    setAdded(false)
    setSelectionError('')
  }

  function addToCart() {
    for (const group of optionGroups.filter((entry) => product.groupIds?.includes(entry.id))) {
      const count = selectedExtras.filter((id) => group.optionIds.includes(id)).length
      if (count < group.min) {
        setSelectionError(`Escolha pelo menos ${group.min} opção(ões) em ${group.name}.`)
        return
      }
    }
    setSelectionError('')
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
            {product.ingredients && (
              <p className="detail-ingredients">
                <strong>Ingredientes:</strong> {product.ingredients}
              </p>
            )}
            {product.allergens && (
              <p className="detail-ingredients">
                <strong>Alérgenos:</strong> {product.allergens}
              </p>
            )}
            <div className="detail-price">
              <span>
                {product.customizable || product.groupIds?.length
                  ? 'A partir de'
                  : 'Preço por unidade'}
              </span>
              <strong>{money(product.price)}</strong>
            </div>
          </div>
          <NutritionSection
            nutrition={product.nutrition}
            estimated={product.nutritionSource !== 'provided'}
          />
          {optionGroups
            .filter((entry) => product.groupIds?.includes(entry.id))
            .map((group) => (
              <section
                className="option-group"
                key={group.id}
                aria-labelledby={`group-${group.id}`}
              >
                <div className="section-heading">
                  <h2 id={`group-${group.id}`}>{group.name}</h2>
                  <span className="optional-tag">
                    {group.min ? `Escolha ${group.min}–${group.max}` : 'Opcional'}
                  </span>
                </div>
                <div className="option-group-grid">
                  {group.optionIds
                    .map((id) =>
                      addOns.find((extra) => extra.id === id && extra.available !== false),
                    )
                    .filter((extra): extra is AddOn => Boolean(extra))
                    .map((extra) => {
                      const count = selectedExtras.filter((id) => id === extra.id).length
                      return (extra.maxQuantity || 1) > 1 ? (
                        <div key={extra.id} className={`option-card ${count ? 'selected' : ''}`}>
                          <span>
                            {extra.name} <strong>+ {money(extra.price)}</strong>
                          </span>
                          <div className="option-quantity">
                            <button
                              aria-label={`Remover ${extra.name}`}
                              disabled={!count}
                              onClick={() => changeExtra(extra, -1, group)}
                            >
                              −
                            </button>
                            <output aria-label={`Quantidade de ${extra.name}`}>{count}</output>
                            <button
                              aria-label={`Adicionar ${extra.name}`}
                              disabled={count >= (extra.maxQuantity || 1)}
                              onClick={() => changeExtra(extra, 1, group)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          key={extra.id}
                          className={`option-card ${count ? 'selected' : ''}`}
                          aria-pressed={Boolean(count)}
                          onClick={() => changeExtra(extra, count ? -1 : 1, group)}
                        >
                          <span>{extra.name}</span>
                          <strong>+ {money(extra.price)}</strong>
                        </button>
                      )
                    })}
                </div>
              </section>
            ))}
          {Boolean(product.removableIngredients?.filter(Boolean).length) && (
            <section className="option-group" aria-labelledby="remove-ingredients-title">
              <div className="section-heading">
                <h2 id="remove-ingredients-title">Retirar ingredientes</h2>
                <span className="optional-tag">Opcional</span>
              </div>
              <div className="removable-list">
                {product.removableIngredients?.filter(Boolean).map((ingredient) => (
                  <label key={ingredient}>
                    <input
                      type="checkbox"
                      checked={removedIngredients.includes(ingredient)}
                      onChange={(event) => {
                        setRemovedIngredients(
                          event.target.checked
                            ? [...removedIngredients, ingredient]
                            : removedIngredients.filter((item) => item !== ingredient),
                        )
                        setAdded(false)
                      }}
                    />
                    Sem {ingredient}
                  </label>
                ))}
              </div>
            </section>
          )}
          {product.customizable &&
            addOns.some(
              (extra) =>
                extra.available !== false &&
                (!product.extraIds || product.extraIds.includes(extra.id)),
            ) && (
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
                    .filter(
                      (extra) =>
                        extra.available !== false &&
                        !optionGroups.some(
                          (group) =>
                            product.groupIds?.includes(group.id) &&
                            group.optionIds.includes(extra.id),
                        ) &&
                        (product.extraIds
                          ? product.extraIds.includes(extra.id)
                          : product.id !== 'vegetariano' || extra.id !== 'bacon-extra'),
                    )
                    .map((extra) => {
                      const count = selectedExtras.filter((id) => id === extra.id).length
                      const selected = count > 0
                      if ((extra.maxQuantity || 1) > 1)
                        return (
                          <div
                            key={extra.id}
                            className={`extra-card ${selected ? 'selected' : ''}`}
                          >
                            <FoodImage
                              src={extra.image}
                              alt={extra.name}
                              fallback="/images/cheddar.webp"
                            />
                            <span className="extra-name">{extra.name}</span>
                            <span className="extra-price">+ {money(extra.price)}</span>
                            <div className="option-quantity extra-quantity">
                              <button
                                aria-label={`Remover ${extra.name}`}
                                disabled={!count}
                                onClick={() => changeExtra(extra, -1)}
                              >
                                −
                              </button>
                              <output aria-label={`Quantidade de ${extra.name}`}>{count}</output>
                              <button
                                aria-label={`Adicionar ${extra.name}`}
                                disabled={count >= (extra.maxQuantity || 1)}
                                onClick={() => changeExtra(extra, 1)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )
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
          {availableRecommendations.length > 0 && (
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
                        toggle(
                          recommendation.id,
                          selectedRecommendations,
                          setSelectedRecommendations,
                        )
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
          )}
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
          {selectionError && (
            <span className="option-error" role="alert">
              {selectionError}
            </span>
          )}
        </div>
      </div>
    </main>
  )
}
