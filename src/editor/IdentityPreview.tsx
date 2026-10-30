import { useEffect, useMemo, useRef, useState } from 'react'
import { Pin } from 'lucide-react'
import { demoTemplate } from '../data/template'
import type { MenuTemplateData } from '../types'

const MOBILE_WIDTH = 390
const DESKTOP_WIDTH = 1280

export type PreviewGroup =
  'structure' | 'cards' | 'actions' | 'typography' | 'icons' | 'selection' | 'borders'

type Props = {
  draft: MenuTemplateData
  templateId: string
  editedTheme: 'light' | 'dark'
  group: PreviewGroup
  groupRevision: number
}

export function IdentityPreview({ draft, templateId, editedTheme, group, groupRevision }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: MOBILE_WIDTH, height: 590 })
  const [page, setPage] = useState<'menu' | 'product'>('menu')
  const [productId, setProductId] = useState('')
  const [manualViewedTheme, setManualViewedTheme] = useState<'light' | 'dark' | null>(null)
  const viewedTheme = manualViewedTheme ?? editedTheme
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [overviewForRevision, setOverviewForRevision] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const context = pinned || overviewForRevision === groupRevision ? 'overview' : group
  const isDemo = !draft.categories.length || !draft.products.length
  const previewDraft = useMemo(() => {
    if (!isDemo) return draft
    const sample = demoTemplate()
    return {
      ...draft,
      categories: sample.categories,
      products: sample.products,
      addOns: sample.addOns,
      optionGroups: sample.optionGroups,
      recommendationIds: sample.recommendationIds,
    }
  }, [draft, isDemo])
  const products = previewDraft.products.filter((item) => item.available !== false)
  const shownProductId = products.some((item) => item.id === productId)
    ? productId
    : products[0]?.id || ''
  const logicalWidth = context === 'overview' && device === 'desktop' ? DESKTOP_WIDTH : MOBILE_WIDTH
  const scale = Math.min(1, viewport.width / logicalWidth)

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: 'cardapio-preview', draft: previewDraft, context },
      location.origin,
    )
  }, [previewDraft, context])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === frameRef.current?.contentWindow &&
        event.data?.type === 'cardapio-preview-ready'
      ) {
        frameRef.current?.contentWindow?.postMessage(
          { type: 'cardapio-preview', draft: previewDraft, context },
          location.origin,
        )
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [previewDraft, context])

  const source = `/preview?id=${encodeURIComponent(templateId || 'identity')}&theme=${viewedTheme}&embedded=1${page === 'product' && shownProductId ? '#/produto/' + encodeURIComponent(shownProductId) : ''}`

  return (
    <section
      className="ed-panel ed-identity-preview"
      data-context={context}
      aria-label="Pré-visualização do cardápio"
    >
      <div className="ed-identity-preview-head">
        <div>
          <h3>Pré-visualização {context === 'overview' ? 'geral' : 'contextual'}</h3>
          <p>
            Modo em edição: {editedTheme === 'light' ? 'claro' : 'escuro'} · Visualizando:{' '}
            {viewedTheme === 'light' ? 'claro' : 'escuro'}
          </p>
        </div>
        {isDemo && <span className="ed-identity-preview-demo">Exemplo visual</span>}
      </div>
      <div className="ed-identity-preview-view">
        <button
          type="button"
          className="ed-button ed-secondary"
          onClick={() => setOverviewForRevision(groupRevision)}
        >
          Visão geral
        </button>
        <button
          type="button"
          className={`ed-button ed-secondary ${pinned ? 'active' : ''}`}
          aria-pressed={pinned}
          onClick={() => {
            setPinned(!pinned)
            setOverviewForRevision(pinned ? null : groupRevision)
          }}
        >
          <Pin size={15} /> {pinned ? 'Visão geral fixada' : 'Fixar visão geral'}
        </button>
      </div>
      <div className="ed-identity-preview-controls">
        {context === 'overview' && (
          <div className="ed-tabs" aria-label="Dispositivo da pré-visualização">
            <button
              type="button"
              className={device === 'mobile' ? 'active' : ''}
              onClick={() => setDevice('mobile')}
            >
              Mobile
            </button>
            <button
              type="button"
              className={device === 'desktop' ? 'active' : ''}
              onClick={() => setDevice('desktop')}
            >
              Desktop
            </button>
          </div>
        )}
        <div className="ed-tabs" aria-label="Página da pré-visualização">
          <button
            type="button"
            className={page === 'menu' ? 'active' : ''}
            onClick={() => setPage('menu')}
          >
            Cardápio
          </button>
          <button
            type="button"
            className={page === 'product' ? 'active' : ''}
            onClick={() => setPage('product')}
            disabled={!shownProductId}
          >
            Detalhes
          </button>
        </div>
        <div className="ed-tabs" aria-label="Tema da pré-visualização">
          <button
            type="button"
            className={viewedTheme === 'light' ? 'active' : ''}
            onClick={() => setManualViewedTheme('light')}
          >
            Claro
          </button>
          <button
            type="button"
            className={viewedTheme === 'dark' ? 'active' : ''}
            onClick={() => setManualViewedTheme('dark')}
          >
            Escuro
          </button>
        </div>
      </div>
      {page === 'product' && (
        <label className="ed-field ed-identity-preview-product">
          <span>Produto exibido</span>
          <select value={shownProductId} onChange={(event) => setProductId(event.target.value)}>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || 'Produto sem nome'}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="ed-identity-preview-viewport" ref={viewportRef}>
        <iframe
          ref={frameRef}
          key={source}
          title={`Pré-visualização ${page === 'menu' ? 'do cardápio' : 'dos detalhes do produto'} em tema ${viewedTheme === 'light' ? 'claro' : 'escuro'}`}
          src={source}
          style={{
            width: logicalWidth,
            height: Math.ceil(viewport.height / scale),
            transform: `scale(${scale})`,
          }}
          onLoad={(event) =>
            event.currentTarget.contentWindow?.postMessage(
              { type: 'cardapio-preview', draft: previewDraft, context },
              location.origin,
            )
          }
        />
      </div>
      {isDemo && (
        <p className="ed-identity-preview-note">
          Produtos de exemplo apenas nesta prévia. Seu template não será alterado.
        </p>
      )}
    </section>
  )
}
