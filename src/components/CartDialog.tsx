import { useEffect, useRef } from 'react'
import { ArrowLeft, ShoppingBag, Trash2, X } from 'lucide-react'
import type { CartItem } from '../types'
import { linePrice, money } from '../lib/order'
import { FoodImage } from './FoodImage'
import { QuantityControl } from './QuantityControl'

interface Props {
  open: boolean
  items: CartItem[]
  onClose: () => void
  onQuantity: (id: string, quantity: number) => void
  onRemove: (id: string) => void
}

export function CartDialog({ open, items, onClose, onQuantity, onRemove }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (open) dialog?.showModal()
    else dialog?.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const count = items.reduce((total, item) => total + item.quantity, 0)
  return (
    <dialog
      ref={ref}
      className="cart-dialog"
      aria-labelledby="cart-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="cart-panel">
        <div className="cart-heading">
          <div>
            <span className="eyebrow">SUAS ESCOLHAS</span>
            <h2 id="cart-title">
              Seu pedido<span>{count}</span>
            </h2>
          </div>
          <button className="icon-button" aria-label="Fechar carrinho" onClick={onClose}>
            <X />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="empty-cart">
            <div className="empty-icon">
              <ShoppingBag size={32} strokeWidth={1.5} />
            </div>
            <h3>Seu pedido começa aqui</h3>
            <p>
              Escolha algo gostoso no cardápio.
              <br />
              Seus favoritos estão esperando.
            </p>
            <button className="primary-button" onClick={onClose}>
              <ArrowLeft size={17} />
              Explorar cardápio
            </button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <article className="cart-item" key={item.id}>
                  <FoodImage
                    src={item.product.image}
                    alt={item.product.name}
                    className="cart-photo"
                  />
                  <div className="cart-item-content">
                    <h3>{item.product.name}</h3>
                    {item.addOns.length > 0 && (
                      <p>+ {item.addOns.map((extra) => extra.name).join(', ')}</p>
                    )}
                    {item.recommendations.length > 0 && (
                      <p>
                        Com {item.recommendations.map((product) => product.name).join(', ')} · por
                        unidade
                      </p>
                    )}
                    {item.notes && <p className="cart-notes">“{item.notes}”</p>}
                    <strong>{money(linePrice(item))}</strong>
                    <div className="cart-item-bottom">
                      <QuantityControl
                        value={item.quantity}
                        label={`Quantidade de ${item.product.name}`}
                        onChange={(value) => onQuantity(item.id, value)}
                      />
                      <button
                        className="icon-button remove-button"
                        aria-label={`Remover ${item.product.name} do carrinho`}
                        onClick={() => onRemove(item.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="cart-summary">
              <div>
                <span>Total do pedido</span>
                <strong>{money(items.reduce((total, item) => total + linePrice(item), 0))}</strong>
              </div>
              <p>Adicionais e acompanhamentos já estão incluídos.</p>
              <button className="primary-button" onClick={onClose}>
                <ArrowLeft size={17} />
                Continuar escolhendo
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
