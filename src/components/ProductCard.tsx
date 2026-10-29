import { Clock3, Heart, Plus } from 'lucide-react'
import type { Product } from '../types'
import { money } from '../lib/order'
import { FoodImage } from './FoodImage'

interface Props {
  product: Product
  favorite: boolean
  onFavorite: (id: string) => void
  onAdd: (product: Product) => void
  requiresSelection?: boolean
}

export function ProductCard({
  product,
  favorite,
  onFavorite,
  onAdd,
  requiresSelection = false,
}: Props) {
  return (
    <article className="product-card">
      <a
        href={`#/produto/${product.id}`}
        className="product-link"
        aria-label={`Ver detalhes de ${product.name}`}
      >
        <div className="product-photo">
          <FoodImage
            src={product.image}
            alt={product.name}
            loading="lazy"
            style={{ objectPosition: product.imagePosition }}
          />
          {product.badge && (
            <span
              className={`product-badge ${product.badge === 'Vegetariano' ? 'badge-green' : ''}`}
            >
              {product.badge}
            </span>
          )}
        </div>
        <div className="product-info">
          <div className="product-meta">
            <span>
              {product.time ? (
                <>
                  <Clock3 size={13} />
                  {product.time}
                </>
              ) : (
                'Pronto para servir'
              )}
            </span>
            <span>{product.portion}</span>
          </div>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
        </div>
      </a>
      <button
        type="button"
        className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
        aria-label={`${favorite ? 'Remover' : 'Adicionar'} ${product.name} ${favorite ? 'dos' : 'aos'} favoritos`}
        aria-pressed={favorite}
        onClick={() => onFavorite(product.id)}
      >
        <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
      </button>
      <div className="product-action">
        <span className="product-price">{money(product.price)}</span>
        {requiresSelection ? (
          <a
            className="add-button"
            href={`#/produto/${product.id}`}
            aria-label={`Personalizar ${product.name}`}
          >
            <Plus size={17} />
            <span>Personalizar</span>
          </a>
        ) : (
          <button
            type="button"
            className="add-button"
            onClick={() => onAdd(product)}
            aria-label={`Adicionar ${product.name} ao carrinho`}
          >
            <Plus size={17} />
            <span>Adicionar</span>
          </button>
        )}
      </div>
    </article>
  )
}
