import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  FileArchive,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Plus,
  Save,
  Settings,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { emptyTemplate, defaultDark, defaultLight } from '../data/template'
import { money } from '../lib/order'
import type {
  AddOn,
  MenuCategory,
  MenuTemplate,
  MenuTemplateData,
  OptionGroup,
  Product,
  ThemeColors,
  ProjectDocs,
  ProjectCapture,
} from '../types'
import { IdentityPreview } from './IdentityPreview'
import type { PreviewGroup } from './IdentityPreview'
import { ProjectPanel } from './ProjectPanel'
import './editor.css'

type Section =
  | 'overview'
  | 'templates'
  | 'identity'
  | 'categories'
  | 'products'
  | 'addons'
  | 'recommendations'
  | 'preview'
  | 'project'
  | 'settings'
const sections: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'templates', label: 'Meus temas', icon: FolderOpen },
  { id: 'identity', label: 'Identidade visual', icon: Palette },
  { id: 'categories', label: 'Categorias', icon: Tag },
  { id: 'products', label: 'Produtos', icon: ShoppingBag },
  { id: 'addons', label: 'Adicionais', icon: Plus },
  { id: 'recommendations', label: 'Recomendações', icon: Sparkles },
  { id: 'preview', label: 'Pré-visualização', icon: Eye },
  { id: 'project', label: 'Projeto e Código', icon: FileArchive },
  { id: 'settings', label: 'Configurações', icon: Settings },
]
type Modal = { kind: 'create' | 'saveAs' | 'rename' | 'delete' | 'publish'; id?: string } | null
type ColorKey = Exclude<keyof ThemeColors, 'logo' | 'nameImage'>
const blankProjectDocs: ProjectDocs = {
  title: '',
  description: '',
  establishment: '',
  audience: '',
  technologies: '',
  siteUrl: '',
  repositoryUrl: '',
  codeRef: '',
  architecture: '',
  operations: '',
  notes: '',
  aiInstructions: '',
}
const colorGroups: { id: PreviewGroup; label: string; fields: [ColorKey, string][] }[] = [
  {
    id: 'structure',
    label: 'Estrutura e fundos',
    fields: [
      ['background', 'Fundo'],
      ['secondary', 'Secundária'],
    ],
  },
  { id: 'cards', label: 'Cards de produtos', fields: [['card', 'Cards']] },
  {
    id: 'actions',
    label: 'Botões e ações',
    fields: [
      ['button', 'Botões'],
      ['primary', 'Principal'],
    ],
  },
  {
    id: 'typography',
    label: 'Textos e tipografia',
    fields: [
      ['text', 'Textos'],
      ['muted', 'Textos secundários'],
    ],
  },
  { id: 'icons', label: 'Ícones e indicadores', fields: [['icon', 'Ícones']] },
  { id: 'selection', label: 'Seleção e navegação', fields: [['selected', 'Selecionados']] },
  { id: 'borders', label: 'Bordas e detalhes', fields: [['border', 'Bordas']] },
]

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.')
  return data as T
}
const send = <T,>(path: string, method: string, body?: unknown) =>
  api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })

function contrastRatio(first: string, second: string) {
  function luminance(hex: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return NaN
    const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    const [red, green, blue] = channels.map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const a = luminance(first),
    b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  min,
  step,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  min?: number
  step?: number
}) {
  return (
    <label className="ed-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        step={step}
      />
    </label>
  )
}
function Textarea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="ed-field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </label>
  )
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="ed-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
function ImageField({
  label,
  value,
  onChange,
  templateId,
}: {
  label: string
  value?: string
  onChange: (url: string) => void
  templateId: string
}) {
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  async function upload(file: File) {
    setError('')
    if (
      !['image/svg+xml', 'image/png', 'image/jpeg'].includes(file.type) ||
      file.size > 2_000_000
    ) {
      setError('Use SVG, PNG ou JPG de até 2 MB.')
      return
    }
    setBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const data = String(reader.result)
      setPreview(data)
      try {
        const result = await send<{ url: string }>('/assets', 'POST', {
          filename: file.name,
          data,
          templateId,
        })
        onChange(result.url)
        setPreview('')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Falha no upload.')
      } finally {
        setBusy(false)
      }
    }
    reader.onerror = () => {
      setError('Não foi possível ler o arquivo.')
      setBusy(false)
    }
    reader.readAsDataURL(file)
  }
  return (
    <div className="ed-field">
      <span>{label}</span>
      <div className="ed-image-field">
        {preview || value ? (
          <img src={preview || value} alt="Prévia da imagem" />
        ) : (
          <div className="ed-image-empty">
            <ImagePlus size={28} />
            <span>Sem imagem</span>
          </div>
        )}
        <div>
          <label className="ed-button ed-secondary ed-upload">
            <Upload size={16} />
            {busy ? 'Enviando…' : value ? 'Substituir imagem' : 'Enviar imagem'}
            <input
              type="file"
              accept="image/svg+xml,image/png,image/jpeg"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) upload(file)
                event.target.value = ''
              }}
            />
          </label>
          {value && (
            <button className="ed-text-button" type="button" onClick={() => onChange('')}>
              Remover imagem
            </button>
          )}
          <small>SVG, PNG ou JPG · até 2 MB</small>
        </div>
      </div>
      {error && <small className="ed-error">{error}</small>}
    </div>
  )
}

export function EditorApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [configured, setConfigured] = useState(true)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [templates, setTemplates] = useState<MenuTemplate[]>([])
  const [currentId, setCurrentId] = useState('')
  const [draft, setDraft] = useState<MenuTemplateData>(emptyTemplate)
  const [templateName, setTemplateName] = useState('')
  const [unsaved, setUnsaved] = useState(false)
  const [section, setSection] = useState<Section>('templates')
  const [modal, setModal] = useState<Modal>(null)
  const [modalName, setModalName] = useState('')
  const [createSourceId, setCreateSourceId] = useState('')
  const [themeSearch, setThemeSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light')
  const [colorGroup, setColorGroup] = useState<PreviewGroup>('structure')
  const [colorGroupRevision, setColorGroupRevision] = useState(0)
  const [hexDrafts, setHexDrafts] = useState<Record<string, string>>({})
  const [projectDocs, setProjectDocs] = useState<ProjectDocs>(blankProjectDocs)
  const [savedProjectDocs, setSavedProjectDocs] = useState<ProjectDocs>(blankProjectDocs)
  const [projectCaptures, setProjectCaptures] = useState<ProjectCapture[]>([])
  const [projectDirty, setProjectDirty] = useState(false)
  const [projectPublished, setProjectPublished] = useState(false)
  const [codeExportAvailable, setCodeExportAvailable] = useState(false)
  const [exportVersion, setExportVersion] = useState<'draft' | 'published'>('draft')
  const [exportCaptures, setExportCaptures] = useState(true)
  const [exportAssets, setExportAssets] = useState(true)
  const [productId, setProductId] = useState('')
  const [addonId, setAddonId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [search, setSearch] = useState('')
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [previewPage, setPreviewPage] = useState('')
  const [previewVersion, setPreviewVersion] = useState(0)
  const current = templates.find((item) => item.id === currentId)
  const visibleTemplates = templates.filter((item) =>
    `${item.name} ${item.draft.restaurant.name}`
      .toLocaleLowerCase('pt-BR')
      .includes(themeSearch.toLocaleLowerCase('pt-BR')),
  )
  const selectedProduct = draft.products.find((item) => item.id === productId)
  const selectedAddon = draft.addOns.find((item) => item.id === addonId)
  const selectedCategory = draft.categories.find((item) => item.id === categoryId)
  const selectedGroup = draft.optionGroups.find((item) => item.id === groupId)
  const theme = draft.themes[themeMode]
  const contrastWarnings = [
    ['texto e fundo', theme.text, theme.background],
    ['texto secundário e cards', theme.muted, theme.card],
    ['botões e texto branco', theme.button, '#ffffff'],
  ]
    .filter(([, first, second]) => contrastRatio(first, second) < 4.5)
    .map(([label]) => label)

  useEffect(() => {
    api<{ authenticated: boolean; configured: boolean }>('/auth/session')
      .then((result) => {
        setAuthenticated(result.authenticated)
        setConfigured(result.configured)
      })
      .catch(() => {
        setAuthenticated(false)
        setError('API indisponível. Inicie o servidor local.')
      })
  }, [])
  useEffect(() => {
    if (!authenticated) return
    api<MenuTemplate[]>('/templates')
      .then((list) => {
        setTemplates(list)
        const selected = list.find((item) => item.published) || list[0]
        if (selected) {
          setCurrentId(selected.id)
          setDraft(structuredClone(selected.draft))
          setTemplateName(selected.name)
          setUnsaved(false)
        }
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Falha ao carregar templates.'),
      )
  }, [authenticated])
  useEffect(() => {
    if (!authenticated || !currentId) return
    let cancelled = false
    api<{
      docs: ProjectDocs
      captures: ProjectCapture[]
      hasPublishedVersion: boolean
      codeExportAvailable: boolean
    }>(`/templates/${currentId}/project`)
      .then((value) => {
        if (!cancelled) {
          setProjectDocs(value.docs)
          setSavedProjectDocs(value.docs)
          setProjectCaptures(value.captures)
          setProjectPublished(value.hasPublishedVersion)
          setCodeExportAvailable(value.codeExportAvailable)
          setProjectDirty(false)
        }
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : 'Falha ao carregar projeto.')
      })
    return () => {
      cancelled = true
    }
  }, [authenticated, currentId])
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved || projectDirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [unsaved, projectDirty])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (section !== 'preview') return
    const frame = document.querySelector<HTMLIFrameElement>('.ed-preview-frame iframe')
    frame?.contentWindow?.postMessage({ type: 'cardapio-preview', draft }, location.origin)
  }, [section, draft, previewVersion, previewDevice, themeMode, previewPage])
  useEffect(() => {
    if (section !== 'preview') return
    const receive = (event: MessageEvent) => {
      const frame = document.querySelector<HTMLIFrameElement>('.ed-preview-frame iframe')
      if (
        event.origin === location.origin &&
        event.source === frame?.contentWindow &&
        event.data?.type === 'cardapio-preview-ready'
      ) {
        frame.contentWindow?.postMessage({ type: 'cardapio-preview', draft }, location.origin)
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [section, draft])

  async function refresh(preferId?: string) {
    try {
      const list = await api<MenuTemplate[]>('/templates')
      setTemplates(list)
      const selected =
        list.find((item) => item.id === (preferId || currentId)) ||
        list.find((item) => item.published) ||
        list[0]
      if (selected) {
        setCurrentId(selected.id)
        setDraft(structuredClone(selected.draft))
        setTemplateName(selected.name)
        setUnsaved(false)
      } else {
        setCurrentId('')
        setDraft(emptyTemplate())
        setTemplateName('')
        setUnsaved(false)
        setProjectDocs(blankProjectDocs)
        setSavedProjectDocs(blankProjectDocs)
        setProjectCaptures([])
        setProjectPublished(false)
        setCodeExportAvailable(false)
        setProjectDirty(false)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar templates.')
    }
  }
  function edit(fn: (value: MenuTemplateData) => void) {
    setDraft((previous) => {
      const next = structuredClone(previous)
      fn(next)
      return next
    })
    setUnsaved(true)
  }
  function switchTemplate(item: MenuTemplate) {
    if ((unsaved || projectDirty) && !window.confirm('Descartar alterações não salvas?')) return
    setCurrentId(item.id)
    setDraft(structuredClone(item.draft))
    setTemplateName(item.name)
    setUnsaved(false)
    if (item.id === currentId) {
      setProjectDocs(savedProjectDocs)
      setProjectDirty(false)
    }
    setProductId('')
    setAddonId('')
    setCategoryId('')
    setGroupId('')
    setSection('identity')
  }
  function openLibrary() {
    if (
      (unsaved || projectDirty) &&
      !window.confirm('Descartar alterações não salvas e voltar aos temas?')
    )
      return
    if ((unsaved || projectDirty) && current) {
      setDraft(structuredClone(current.draft))
      setTemplateName(current.name)
      setUnsaved(false)
      setProjectDirty(false)
      setProjectDocs(savedProjectDocs)
    }
    setSection('templates')
    setMobileNav(false)
  }
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha na operação.')
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    if (!currentId) throw new Error('Crie um template antes de salvar.')
    await send(`/templates/${currentId}`, 'PUT', { name: templateName, draft })
    if (projectDirty) await send(`/templates/${currentId}/project`, 'PUT', projectDocs)
    await refresh(currentId)
    setProjectDirty(false)
    setSavedProjectDocs(projectDocs)
    setNotice('Alterações salvas com sucesso.')
  }
  async function login(event: React.FormEvent) {
    event.preventDefault()
    await run(async () => {
      await send('/auth/login', 'POST', { password })
      setPassword('')
      setAuthenticated(true)
    })
  }
  async function submitModal(event: React.FormEvent) {
    event.preventDefault()
    if (!modal) return
    await run(async () => {
      if (modal.kind === 'create' || modal.kind === 'saveAs') {
        const result = await send<{ id: string }>(
          '/templates',
          'POST',
          modal.kind === 'create'
            ? { name: modalName, sourceId: createSourceId || undefined }
            : { name: modalName, draft, copyProjectFrom: currentId },
        )
        if (modal.kind === 'saveAs')
          await send(`/templates/${result.id}/project`, 'PUT', projectDocs)
        setModal(null)
        await refresh(result.id)
        setSection('identity')
        setNotice('Template criado.')
      } else if (modal.kind === 'rename') {
        const target = templates.find((item) => item.id === modal.id)!
        await send(`/templates/${target.id}`, 'PUT', {
          name: modalName,
          draft: target.id === currentId ? draft : target.draft,
        })
        setModal(null)
        await refresh(currentId)
        setNotice('Template renomeado.')
      } else if (modal.kind === 'delete') {
        await send(`/templates/${modal.id}`, 'DELETE')
        setModal(null)
        await refresh()
        setNotice('Template excluído.')
      } else {
        if (modal.id === currentId && unsaved)
          await send(`/templates/${currentId}`, 'PUT', { name: templateName, draft })
        if (modal.id === currentId && projectDirty) {
          await send(`/templates/${currentId}/project`, 'PUT', projectDocs)
          setSavedProjectDocs(projectDocs)
          setProjectDirty(false)
        }
        await send(`/templates/${modal.id}/publish`, 'POST')
        setModal(null)
        await refresh(modal.id)
        setProjectPublished(true)
        setNotice('Cardápio publicado.')
      }
    })
  }
  function openModal(kind: NonNullable<Modal>['kind'], id?: string) {
    if (
      (unsaved || projectDirty) &&
      (kind === 'create' ||
        kind === 'delete' ||
        (id !== currentId && (kind === 'rename' || kind === 'publish'))) &&
      !window.confirm('Descartar alterações não salvas antes de continuar?')
    )
      return
    setError('')
    if (kind === 'create') setCreateSourceId('')
    setModalName(kind === 'rename' ? templates.find((item) => item.id === id)?.name || '' : '')
    setModal({ kind, id })
  }
  function updateProduct(fn: (item: Product) => void) {
    edit((data) => {
      const item = data.products.find((entry) => entry.id === productId)
      if (item) fn(item)
    })
  }
  function updateAddon(fn: (item: AddOn) => void) {
    edit((data) => {
      const item = data.addOns.find((entry) => entry.id === addonId)
      if (item) fn(item)
    })
  }
  function updateCategory(fn: (item: MenuCategory) => void) {
    edit((data) => {
      const item = data.categories.find((entry) => entry.id === categoryId)
      if (item) fn(item)
    })
  }
  function updateGroup(fn: (item: OptionGroup) => void) {
    edit((data) => {
      const item = data.optionGroups.find((entry) => entry.id === groupId)
      if (item) fn(item)
    })
  }
  function updateColor(key: keyof ThemeColors, value: string) {
    edit((data) => {
      data.themes[themeMode][key] = value
    })
  }
  function addCategory() {
    const id = crypto.randomUUID()
    edit((data) =>
      data.categories.push({
        id,
        name: '',
        description: '',
        visible: true,
        order: data.categories.length,
      }),
    )
    setCategoryId(id)
  }
  function addProduct() {
    const id = crypto.randomUUID()
    edit((data) =>
      data.products.push({
        id,
        name: '',
        category: data.categories[0]?.id || '',
        description: '',
        fullDescription: '',
        price: 0,
        image: '',
        portion: '',
        available: true,
        order: data.products.length,
        extraIds: [],
        groupIds: [],
        recommendationIds: [],
      }),
    )
    setProductId(id)
  }
  function addAddon() {
    const id = crypto.randomUUID()
    edit((data) => data.addOns.push({ id, name: '', price: 0, image: '', available: true }))
    setAddonId(id)
  }
  function addGroup() {
    const id = crypto.randomUUID()
    edit((data) => data.optionGroups.push({ id, name: '', optionIds: [], min: 0, max: 1 }))
    setGroupId(id)
  }
  const productRows = useMemo(
    () =>
      draft.products.filter((item) =>
        `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [draft.products, search],
  )

  if (authenticated === null)
    return (
      <div className="ed-login-shell">
        <div className="ed-login-card">Carregando editor…</div>
      </div>
    )
  if (!authenticated)
    return (
      <div className="ed-login-shell">
        <form className="ed-login-card" onSubmit={login}>
          <div className="ed-login-mark">
            <Palette size={27} />
          </div>
          <span className="ed-kicker">ACESSO ADMINISTRATIVO</span>
          <h1>Central de edição</h1>
          <p>Entre para gerenciar seus templates e publicar alterações no cardápio.</p>
          <label className="ed-field">
            <span>Senha</span>
            <span className="ed-password">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          {error && (
            <div role="alert" className="ed-alert">
              {error}
            </div>
          )}
          {!configured && (
            <div className="ed-alert">
              Configure ADMIN_PASSWORD_HASH no servidor para ativar o acesso.
            </div>
          )}
          <button className="ed-button ed-primary ed-wide" disabled={busy || !configured}>
            {busy ? 'Entrando…' : 'Entrar no editor'}
            <ChevronRight size={17} />
          </button>
          <a href="/">Voltar ao cardápio</a>
        </form>
      </div>
    )

  return (
    <div className="ed-app">
      <aside className={`ed-sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="ed-sidebar-head">
          <div className="ed-mark">
            <Palette size={23} />
          </div>
          <div>
            <strong>Cardápio</strong>
            <small>Central de edição</small>
          </div>
          <button
            className="ed-mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Navegação do editor">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? 'active' : ''}
              onClick={() => {
                if (id === 'templates') openLibrary()
                else setSection(id)
                setMobileNav(false)
              }}
            >
              <Icon size={19} strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </nav>
        <div className="ed-sidebar-foot">
          <a href="/" target="_blank" rel="noreferrer">
            <Eye size={18} />
            Ver cardápio público
          </a>
          <button
            onClick={() =>
              run(async () => {
                await send('/auth/logout', 'POST')
                setAuthenticated(false)
                setCurrentId('')
                setProjectDocs(blankProjectDocs)
                setSavedProjectDocs(blankProjectDocs)
                setProjectCaptures([])
                setProjectPublished(false)
                setCodeExportAvailable(false)
                setProjectDirty(false)
              })
            }
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="ed-mobile-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Fechar navegação"
        />
      )}
      <main className="ed-main">
        <header className="ed-topbar">
          <button
            className="ed-menu-button"
            onClick={() => setMobileNav(true)}
            aria-label="Abrir menu"
          >
            <Menu size={23} />
          </button>
          {current && section !== 'templates' && draft.themes[themeMode].logo && (
            <img
              className="ed-top-logo"
              src={draft.themes[themeMode].logo}
              alt="Logotipo do tema em edição"
            />
          )}
          <div>
            <span className="ed-breadcrumb">
              {current && section !== 'templates' ? templateName : 'Central de edição'}{' '}
              <ChevronRight size={14} /> {sections.find((item) => item.id === section)?.label}
            </span>
            <h1>{sections.find((item) => item.id === section)?.label}</h1>
          </div>
          <div className="ed-top-actions">
            {current && section !== 'templates' && (
              <span className="ed-editor-theme-status">
                {current.published ? 'Em destaque' : 'Rascunho'}
              </span>
            )}
            {(unsaved || projectDirty) && <span className="ed-unsaved">Alterações não salvas</span>}
            <button
              className="ed-button ed-primary"
              onClick={() => run(save)}
              disabled={busy || !currentId || section === 'templates'}
            >
              <Save size={17} />
              Salvar
            </button>
          </div>
        </header>
        <div className="ed-content">
          {error && (
            <div className="ed-alert" role="alert">
              {error}
              <button onClick={() => setError('')} aria-label="Fechar erro">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="ed-success" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {section === 'overview' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">SEU ESPAÇO DE TRABALHO</span>
                  <h2>{current ? templateName : 'Comece com seu primeiro template'}</h2>
                  <p>Edite o rascunho com tranquilidade e publique quando estiver pronto.</p>
                </div>
                <button className="ed-button ed-secondary" onClick={() => setSection('preview')}>
                  <Eye size={17} />
                  Ver prévia
                </button>
              </div>
              {current ? (
                <>
                  <div className="ed-stats">
                    <div>
                      <small>Produtos</small>
                      <strong>{draft.products.length}</strong>
                    </div>
                    <div>
                      <small>Categorias</small>
                      <strong>{draft.categories.length}</strong>
                    </div>
                    <div>
                      <small>Adicionais</small>
                      <strong>{draft.addOns.length}</strong>
                    </div>
                    <div>
                      <small>Status</small>
                      <strong className="ed-status">
                        {unsaved
                          ? 'Rascunho'
                          : current.published
                            ? current.dirty
                              ? 'Salvo'
                              : 'Publicado'
                            : 'Salvo'}
                      </strong>
                    </div>
                  </div>
                  <div className="ed-panel">
                    <div className="ed-overview-row">
                      <div>
                        {draft.themes.light.logo ? (
                          <img
                            className="ed-overview-logo"
                            src={draft.themes.light.logo}
                            alt="Logotipo"
                          />
                        ) : (
                          <div className="ed-overview-logo ed-placeholder">
                            <ImagePlus size={24} />
                          </div>
                        )}
                        <div>
                          <small>RESTAURANTE</small>
                          <h3>{draft.restaurant.name || 'Nome não configurado'}</h3>
                          <p>
                            {draft.restaurant.subtitle ||
                              'Adicione um nome e uma identidade visual.'}
                          </p>
                        </div>
                      </div>
                      <span className="ed-pill">
                        {current.published ? 'Publicado' : 'Rascunho'}
                      </span>
                    </div>
                    <div className="ed-overview-actions">
                      <span>
                        Última alteração: {new Date(current.updatedAt).toLocaleString('pt-BR')}
                      </span>
                      <div>
                        <button
                          className="ed-button ed-secondary"
                          onClick={() => setSection('identity')}
                        >
                          Editar
                        </button>
                        <button
                          className="ed-button ed-primary"
                          onClick={() => openModal('publish', currentId)}
                        >
                          Publicar {current.published ? 'alterações' : 'template'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="ed-empty">
                  <FolderOpen size={35} />
                  <h3>Nenhum template ainda</h3>
                  <p>Crie um cardápio vazio para começar.</p>
                  <button className="ed-button ed-primary" onClick={() => openModal('create')}>
                    Criar primeiro template
                  </button>
                </div>
              )}
            </>
          )}
          {section === 'templates' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">BIBLIOTECA</span>
                  <h2>Meus temas</h2>
                  <p>Cada tema guarda um restaurante completo e independente.</p>
                </div>
                <button className="ed-button ed-primary" onClick={() => openModal('create')}>
                  <Plus size={18} />
                  Criar novo tema
                </button>
              </div>
              {templates.length > 3 && (
                <label className="ed-field ed-theme-search">
                  <span>Pesquisar temas</span>
                  <input
                    value={themeSearch}
                    onChange={(event) => setThemeSearch(event.target.value)}
                    placeholder="Nome do tema ou restaurante"
                  />
                </label>
              )}
              {templates.length ? (
                visibleTemplates.length ? (
                  <div className="ed-template-grid">
                    {visibleTemplates.map((item) => (
                      <article className="ed-template-card" key={item.id}>
                        <div
                          className="ed-template-preview"
                          style={{ background: item.draft.themes.light.background }}
                        >
                          <div
                            className="ed-template-preview-bar"
                            style={{ background: item.draft.themes.light.card }}
                          />
                          {item.draft.themes.light.logo ? (
                            <img src={item.draft.themes.light.logo} alt="" />
                          ) : (
                            <Palette size={36} color={item.draft.themes.light.primary} />
                          )}
                        </div>
                        <div className="ed-template-body">
                          <div className="ed-template-title">
                            <div>
                              <small>{item.draft.restaurant.name || 'Restaurante sem nome'}</small>
                              <h3>{item.name}</h3>
                            </div>
                            {item.published && (
                              <span className="ed-pill">Em destaque · publicado</span>
                            )}
                          </div>
                          <p>Alterado em {new Date(item.updatedAt).toLocaleDateString('pt-BR')}</p>
                          <div className="ed-template-actions">
                            <button
                              className="ed-button ed-primary"
                              onClick={() => switchTemplate(item)}
                            >
                              Abrir e editar
                            </button>
                            <button
                              className="ed-icon-button"
                              title="Duplicar"
                              aria-label={`Duplicar ${item.name}`}
                              onClick={() => {
                                if (
                                  (unsaved || projectDirty) &&
                                  !window.confirm(
                                    'Descartar alterações não salvas antes de duplicar?',
                                  )
                                )
                                  return
                                run(async () => {
                                  const result = await send<{ id: string }>('/templates', 'POST', {
                                    name: `${item.name} — cópia`,
                                    sourceId: item.id,
                                  })
                                  await refresh(result.id)
                                  setNotice('Template duplicado.')
                                })
                              }}
                            >
                              <Copy size={17} />
                            </button>
                            <button
                              className="ed-icon-button"
                              title="Renomear"
                              aria-label={`Renomear ${item.name}`}
                              onClick={() => openModal('rename', item.id)}
                            >
                              <Tag size={17} />
                            </button>
                            <button
                              className="ed-button ed-secondary"
                              aria-label={`${item.published ? 'Publicar alterações de' : 'Selecionar como tema em destaque'} ${item.name}`}
                              onClick={() => openModal('publish', item.id)}
                            >
                              <Upload size={17} />{' '}
                              {item.published ? 'Publicar alterações' : 'Selecionar destaque'}
                            </button>
                            <button
                              className="ed-icon-button ed-danger"
                              title="Excluir"
                              aria-label={`Excluir ${item.name}`}
                              disabled={item.published}
                              onClick={() => openModal('delete', item.id)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="ed-empty">Nenhum tema encontrado para esta pesquisa.</div>
                )
              ) : (
                <div className="ed-empty">
                  <FolderOpen size={35} />
                  <h3>Nenhum tema criado</h3>
                  <p>
                    Crie um tema vazio para começar. Nenhum restaurante será criado automaticamente.
                  </p>
                  <button className="ed-button ed-primary" onClick={() => openModal('create')}>
                    Criar primeiro tema
                  </button>
                </div>
              )}
            </>
          )}
          {section === 'identity' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">APARÊNCIA DO CARDÁPIO</span>
                  <h2>Uma identidade só sua.</h2>
                  <p>As mudanças ficam no rascunho até você publicar.</p>
                </div>
              </div>
              <div className="ed-two-col">
                <div className="ed-identity-column">
                  <section className="ed-panel">
                    <h3>Dados do restaurante</h3>
                    <div className="ed-form-grid">
                      <Input
                        label="Nome do restaurante"
                        value={draft.restaurant.name}
                        onChange={(value) =>
                          edit((data) => {
                            data.restaurant.name = value
                          })
                        }
                      />
                      <Input
                        label="Subtítulo"
                        value={draft.restaurant.subtitle}
                        onChange={(value) =>
                          edit((data) => {
                            data.restaurant.subtitle = value
                          })
                        }
                      />
                    </div>
                    <Textarea
                      label="Descrição curta"
                      value={draft.restaurant.description}
                      onChange={(value) =>
                        edit((data) => {
                          data.restaurant.description = value
                        })
                      }
                    />
                    <label className="ed-field">
                      <span>Apresentação do nome</span>
                      <select
                        value={draft.restaurant.display}
                        onChange={(event) =>
                          edit((data) => {
                            data.restaurant.display = event.target.value as
                              'text' | 'logo' | 'image'
                          })
                        }
                      >
                        <option value="text">Texto</option>
                        <option value="logo">Logotipo</option>
                        <option value="image">Imagem com nome estilizado</option>
                      </select>
                    </label>
                  </section>
                  <section className="ed-panel">
                    <h3>Modos visuais</h3>
                    <div className="ed-tabs">
                      <button
                        className={themeMode === 'light' ? 'active' : ''}
                        onClick={() => setThemeMode('light')}
                      >
                        Modo claro
                      </button>
                      <button
                        className={themeMode === 'dark' ? 'active' : ''}
                        onClick={() => setThemeMode('dark')}
                      >
                        Modo escuro
                      </button>
                    </div>
                    <ImageField
                      templateId={currentId}
                      label="Logotipo"
                      value={theme.logo}
                      onChange={(value) => updateColor('logo', value)}
                    />
                    <ImageField
                      templateId={currentId}
                      label="Imagem com nome"
                      value={theme.nameImage}
                      onChange={(value) => updateColor('nameImage', value)}
                    />
                    <div className="ed-palette-groups" aria-label="Grupos de aparência">
                      {colorGroups.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          className={colorGroup === group.id ? 'active' : ''}
                          onClick={() => {
                            setColorGroup(group.id)
                            setColorGroupRevision((revision) => revision + 1)
                          }}
                        >
                          {group.label}
                        </button>
                      ))}
                    </div>
                    <h4>{colorGroups.find((group) => group.id === colorGroup)?.label}</h4>
                    {colorGroup === 'typography' && (
                      <label className="ed-field">
                        <span>Fonte</span>
                        <select
                          value={draft.font}
                          onChange={(event) =>
                            edit((data) => {
                              data.font = event.target.value as 'dm-sans' | 'manrope'
                            })
                          }
                        >
                          <option value="dm-sans">DM Sans</option>
                          <option value="manrope">Manrope</option>
                        </select>
                      </label>
                    )}
                    <div className="ed-color-grid">
                      {colorGroups
                        .find((group) => group.id === colorGroup)!
                        .fields.map(([key, label]) => (
                          <label className="ed-color" key={key}>
                            <span>{label}</span>
                            <span>
                              <input
                                type="color"
                                value={theme[key] || '#000000'}
                                onChange={(event) => {
                                  setHexDrafts((previous) => {
                                    const next = { ...previous }
                                    delete next[`${themeMode}:${key}`]
                                    return next
                                  })
                                  updateColor(key, event.target.value)
                                }}
                              />
                              <input
                                aria-label={`${label} HEX`}
                                aria-invalid={
                                  hexDrafts[`${themeMode}:${key}`] !== undefined &&
                                  !/^#[0-9a-fA-F]{6}$/.test(hexDrafts[`${themeMode}:${key}`])
                                }
                                aria-describedby={
                                  hexDrafts[`${themeMode}:${key}`] !== undefined &&
                                  !/^#[0-9a-fA-F]{6}$/.test(hexDrafts[`${themeMode}:${key}`])
                                    ? `ed-hex-${themeMode}-${key}`
                                    : undefined
                                }
                                value={hexDrafts[`${themeMode}:${key}`] ?? theme[key] ?? ''}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setHexDrafts((previous) => ({
                                    ...previous,
                                    [`${themeMode}:${key}`]: value,
                                  }))
                                  if (/^#[0-9a-fA-F]{6}$/.test(value)) updateColor(key, value)
                                }}
                                onBlur={() =>
                                  setHexDrafts((previous) => {
                                    const next = { ...previous }
                                    delete next[`${themeMode}:${key}`]
                                    return next
                                  })
                                }
                                maxLength={7}
                              />
                            </span>
                            {hexDrafts[`${themeMode}:${key}`] !== undefined &&
                              !/^#[0-9a-fA-F]{6}$/.test(hexDrafts[`${themeMode}:${key}`]) && (
                                <small className="ed-color-error" id={`ed-hex-${themeMode}-${key}`}>
                                  Complete o código HEX para atualizar a prévia.
                                </small>
                              )}
                          </label>
                        ))}
                    </div>
                    <div className="ed-inline-actions">
                      <button
                        className="ed-button ed-secondary"
                        onClick={() =>
                          edit((data) => {
                            data.themes[themeMode] = {
                              ...(themeMode === 'light' ? defaultLight : defaultDark),
                            }
                          })
                        }
                      >
                        Restaurar cores
                      </button>
                      {themeMode === 'dark' && (
                        <button
                          className="ed-button ed-secondary"
                          onClick={() =>
                            edit((data) => {
                              data.themes.dark = { ...data.themes.light }
                            })
                          }
                        >
                          Copiar tema claro
                        </button>
                      )}
                    </div>
                    {contrastWarnings.length > 0 ? (
                      <p className="ed-contrast-warning" role="status">
                        Contraste abaixo de 4,5:1 em: {contrastWarnings.join(', ')}. Ajuste as cores
                        antes de publicar.
                      </p>
                    ) : (
                      <p className="ed-hint">
                        Contraste principal de texto aprovado (mínimo 4,5:1).
                      </p>
                    )}
                  </section>
                </div>
                <IdentityPreview
                  key={currentId}
                  draft={draft}
                  templateId={currentId}
                  editedTheme={themeMode}
                  group={colorGroup}
                  groupRevision={colorGroupRevision}
                />
              </div>
            </>
          )}
          {section === 'categories' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">ORGANIZAÇÃO</span>
                  <h2>Categorias do cardápio</h2>
                  <p>Use as setas para definir a ordem de exibição.</p>
                </div>
                <button className="ed-button ed-primary" onClick={addCategory}>
                  <Plus size={18} />
                  Nova categoria
                </button>
              </div>
              <div className="ed-editor-layout">
                <div className="ed-list">
                  {[...draft.categories]
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((item, index) => (
                      <div
                        className={`ed-list-row ${categoryId === item.id ? 'active' : ''}`}
                        key={item.id}
                      >
                        <button onClick={() => setCategoryId(item.id)}>
                          <Tag size={18} />
                          <span>
                            <strong>{item.name || 'Nova categoria'}</strong>
                            <small>
                              {
                                draft.products.filter((product) => product.category === item.id)
                                  .length
                              }{' '}
                              produtos · {item.visible === false ? 'Oculta' : 'Visível'}
                            </small>
                          </span>
                        </button>
                        <div>
                          <button
                            title="Subir"
                            disabled={index === 0}
                            onClick={() =>
                              edit((data) => {
                                const rows = [...data.categories].sort(
                                  (a, b) => (a.order ?? 0) - (b.order ?? 0),
                                )
                                ;[rows[index - 1], rows[index]] = [rows[index], rows[index - 1]]
                                rows.forEach((row, order) => {
                                  row.order = order
                                })
                              })
                            }
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            title="Descer"
                            disabled={index === draft.categories.length - 1}
                            onClick={() =>
                              edit((data) => {
                                const rows = [...data.categories].sort(
                                  (a, b) => (a.order ?? 0) - (b.order ?? 0),
                                )
                                ;[rows[index], rows[index + 1]] = [rows[index + 1], rows[index]]
                                rows.forEach((row, order) => {
                                  row.order = order
                                })
                              })
                            }
                          >
                            <ArrowDown size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  {!draft.categories.length && (
                    <div className="ed-list-empty">
                      Crie uma categoria para organizar os produtos.
                    </div>
                  )}
                </div>
                {selectedCategory && (
                  <div className="ed-panel ed-edit-panel">
                    <div className="ed-panel-head">
                      <h3>Editar categoria</h3>
                      <button
                        className="ed-icon-button ed-danger"
                        title="Excluir categoria"
                        onClick={() => {
                          const count = draft.products.filter(
                            (item) => item.category === categoryId,
                          ).length
                          if (count) {
                            setError(
                              'Mova ou exclua os produtos desta categoria antes de excluí-la.',
                            )
                            return
                          }
                          if (window.confirm('Excluir esta categoria?')) {
                            edit((data) => {
                              data.categories = data.categories.filter(
                                (item) => item.id !== categoryId,
                              )
                            })
                            setCategoryId('')
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <Input
                      label="Nome"
                      value={selectedCategory.name}
                      onChange={(value) =>
                        updateCategory((item) => {
                          item.name = value
                        })
                      }
                    />
                    <Textarea
                      label="Descrição"
                      value={selectedCategory.description}
                      onChange={(value) =>
                        updateCategory((item) => {
                          item.description = value
                        })
                      }
                    />
                    <ImageField
                      templateId={currentId}
                      label="Imagem opcional"
                      value={selectedCategory.image}
                      onChange={(value) =>
                        updateCategory((item) => {
                          item.image = value
                        })
                      }
                    />
                    <Toggle
                      label="Exibir no cardápio"
                      checked={selectedCategory.visible !== false}
                      onChange={(value) =>
                        updateCategory((item) => {
                          item.visible = value
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </>
          )}
          {section === 'products' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">CATÁLOGO</span>
                  <h2>Produtos</h2>
                  <p>Edite preços, fotos, composição e informações nutricionais.</p>
                </div>
                <button
                  className="ed-button ed-primary"
                  onClick={addProduct}
                  disabled={!draft.categories.length}
                >
                  <Plus size={18} />
                  Novo produto
                </button>
              </div>
              {!draft.categories.length && (
                <div className="ed-alert">Crie uma categoria antes de adicionar produtos.</div>
              )}
              <div className="ed-editor-layout">
                <div className="ed-list">
                  <label className="ed-field ed-list-search">
                    <span>Buscar produto</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Nome ou descrição"
                    />
                  </label>
                  {productRows.map((item) => (
                    <button
                      className={`ed-list-row ed-product-row ${productId === item.id ? 'active' : ''}`}
                      key={item.id}
                      onClick={() => setProductId(item.id)}
                    >
                      {item.image ? (
                        <img src={item.image} alt="" />
                      ) : (
                        <div className="ed-row-image">
                          <ImagePlus size={20} />
                        </div>
                      )}
                      <span>
                        <strong>{item.name || 'Novo produto'}</strong>
                        <small>
                          {draft.categories.find((category) => category.id === item.category)
                            ?.name || 'Sem categoria'}{' '}
                          · {money(item.price)} ·{' '}
                          {item.available === false ? 'Indisponível' : 'Disponível'}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {!productRows.length && (
                    <div className="ed-list-empty">Nenhum produto encontrado.</div>
                  )}
                </div>
                {selectedProduct && (
                  <div className="ed-panel ed-edit-panel">
                    <div className="ed-panel-head">
                      <h3>Editar produto</h3>
                      <div>
                        <button
                          className="ed-icon-button"
                          title="Duplicar"
                          onClick={() => {
                            const id = crypto.randomUUID()
                            edit((data) =>
                              data.products.push({
                                ...structuredClone(selectedProduct),
                                id,
                                name: `${selectedProduct.name} — cópia`,
                              }),
                            )
                            setProductId(id)
                          }}
                        >
                          <Copy size={17} />
                        </button>
                        <button
                          className="ed-icon-button ed-danger"
                          title="Excluir"
                          onClick={() => {
                            if (window.confirm('Excluir este produto?')) {
                              edit((data) => {
                                data.products = data.products.filter(
                                  (item) => item.id !== productId,
                                )
                                data.recommendationIds = data.recommendationIds.filter(
                                  (id) => id !== productId,
                                )
                                data.products.forEach((item) => {
                                  item.recommendationIds = item.recommendationIds?.filter(
                                    (id) => id !== productId,
                                  )
                                })
                              })
                              setProductId('')
                            }
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    <div className="ed-form-grid">
                      <Input
                        label="Nome"
                        value={selectedProduct.name}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.name = value
                          })
                        }
                      />
                      <label className="ed-field">
                        <span>Categoria</span>
                        <select
                          value={selectedProduct.category}
                          onChange={(event) =>
                            updateProduct((item) => {
                              item.category = event.target.value
                            })
                          }
                        >
                          {draft.categories.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name || 'Sem nome'}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <Input
                      label="Descrição curta"
                      value={selectedProduct.description}
                      onChange={(value) =>
                        updateProduct((item) => {
                          item.description = value
                        })
                      }
                    />
                    <Textarea
                      label="Descrição completa"
                      value={selectedProduct.fullDescription}
                      onChange={(value) =>
                        updateProduct((item) => {
                          item.fullDescription = value
                        })
                      }
                    />
                    <div className="ed-form-grid">
                      <Input
                        label="Preço (R$)"
                        type="number"
                        min={0}
                        step={0.01}
                        value={(selectedProduct.price / 100).toFixed(2)}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.price = Math.round(Number(value) * 100) || 0
                          })
                        }
                      />
                      <Input
                        label="Porção / volume"
                        value={selectedProduct.portion}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.portion = value
                          })
                        }
                      />
                      <Input
                        label="Tempo de preparo"
                        value={selectedProduct.time || ''}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.time = value
                          })
                        }
                      />
                      <Input
                        label="Selo de destaque"
                        value={selectedProduct.badge || ''}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.badge = value
                          })
                        }
                      />
                      <Input
                        label="Ordem"
                        type="number"
                        min={0}
                        value={selectedProduct.order ?? 0}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.order = Number(value) || 0
                          })
                        }
                      />
                    </div>
                    <ImageField
                      templateId={currentId}
                      label="Foto principal"
                      value={selectedProduct.image}
                      onChange={(value) =>
                        updateProduct((item) => {
                          item.image = value
                        })
                      }
                    />
                    <div className="ed-inline-actions">
                      <Toggle
                        label="Disponível"
                        checked={selectedProduct.available !== false}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.available = value
                          })
                        }
                      />
                      <Toggle
                        label="Permitir personalização"
                        checked={Boolean(selectedProduct.customizable)}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.customizable = value
                          })
                        }
                      />
                      <Toggle
                        label="Destaque"
                        checked={Boolean(selectedProduct.featured)}
                        onChange={(value) =>
                          updateProduct((item) => {
                            item.featured = value
                          })
                        }
                      />
                    </div>
                    <Textarea
                      label="Ingredientes"
                      value={selectedProduct.ingredients || ''}
                      onChange={(value) =>
                        updateProduct((item) => {
                          item.ingredients = value
                        })
                      }
                    />
                    <Textarea
                      label="Ingredientes removíveis (um por linha)"
                      value={(selectedProduct.removableIngredients || []).join('\n')}
                      onChange={(value) =>
                        updateProduct((item) => {
                          item.removableIngredients = value.split('\n')
                        })
                      }
                    />
                    <Textarea
                      label="Alergênicos"
                      value={selectedProduct.allergens || ''}
                      onChange={(value) =>
                        updateProduct((item) => {
                          item.allergens = value
                        })
                      }
                    />
                    <h4>Informações nutricionais</h4>
                    <Toggle
                      label="Dados nutricionais disponíveis"
                      checked={Boolean(selectedProduct.nutrition)}
                      onChange={(value) =>
                        updateProduct((item) => {
                          item.nutrition = value
                            ? { calories: 0, protein: 0, carbohydrates: 0, fat: 0, servingSize: '' }
                            : undefined
                          if (value) item.nutritionSource = 'provided'
                        })
                      }
                    />
                    {selectedProduct.nutrition && (
                      <div className="ed-form-grid">
                        {(
                          [
                            ['calories', 'Calorias (kcal)'],
                            ['protein', 'Proteínas (g)'],
                            ['carbohydrates', 'Carboidratos (g)'],
                            ['fat', 'Gorduras totais (g)'],
                          ] as const
                        ).map(([key, label]) => (
                          <Input
                            key={key}
                            label={label}
                            type="number"
                            min={0}
                            value={selectedProduct.nutrition![key]}
                            onChange={(value) =>
                              updateProduct((item) => {
                                if (item.nutrition) {
                                  item.nutrition[key] = Number(value) || 0
                                  item.nutritionSource = 'provided'
                                }
                              })
                            }
                          />
                        ))}
                        <Input
                          label="Referência da porção"
                          value={selectedProduct.nutrition.servingSize}
                          onChange={(value) =>
                            updateProduct((item) => {
                              if (item.nutrition) {
                                item.nutrition.servingSize = value
                                item.nutritionSource = 'provided'
                              }
                            })
                          }
                        />
                      </div>
                    )}
                    <h4>Adicionais e grupos</h4>
                    <div className="ed-check-grid">
                      {draft.addOns.map((addon) => (
                        <Toggle
                          key={addon.id}
                          label={addon.name || 'Novo adicional'}
                          checked={selectedProduct.extraIds?.includes(addon.id) ?? false}
                          onChange={(checked) =>
                            updateProduct((item) => {
                              item.extraIds = checked
                                ? [...(item.extraIds || []), addon.id]
                                : (item.extraIds || []).filter((id) => id !== addon.id)
                            })
                          }
                        />
                      ))}
                    </div>
                    <div className="ed-check-grid">
                      {draft.optionGroups.map((group) => (
                        <Toggle
                          key={group.id}
                          label={`Grupo: ${group.name || 'Novo grupo'}`}
                          checked={selectedProduct.groupIds?.includes(group.id) ?? false}
                          onChange={(checked) =>
                            updateProduct((item) => {
                              item.groupIds = checked
                                ? [...(item.groupIds || []), group.id]
                                : (item.groupIds || []).filter((id) => id !== group.id)
                            })
                          }
                        />
                      ))}
                    </div>
                    <h4>Recomendações</h4>
                    <div className="ed-order-list">
                      {(selectedProduct.recommendationIds || []).map((id, index) => (
                        <div key={id}>
                          <span>
                            {draft.products.find((product) => product.id === id)?.name || 'Produto'}
                          </span>
                          <button
                            aria-label="Mover recomendação para cima"
                            disabled={index === 0}
                            onClick={() =>
                              updateProduct((item) => {
                                const ids = item.recommendationIds || []
                                ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
                              })
                            }
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            aria-label="Mover recomendação para baixo"
                            disabled={
                              index === (selectedProduct.recommendationIds?.length || 0) - 1
                            }
                            onClick={() =>
                              updateProduct((item) => {
                                const ids = item.recommendationIds || []
                                ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
                              })
                            }
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="ed-check-grid">
                      {draft.products
                        .filter((item) => item.id !== selectedProduct.id)
                        .map((product) => (
                          <Toggle
                            key={product.id}
                            label={product.name || 'Novo produto'}
                            checked={
                              selectedProduct.recommendationIds?.includes(product.id) ?? false
                            }
                            onChange={(checked) =>
                              updateProduct((item) => {
                                item.recommendationIds = checked
                                  ? [...(item.recommendationIds || []), product.id]
                                  : (item.recommendationIds || []).filter((id) => id !== product.id)
                              })
                            }
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {section === 'addons' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">PERSONALIZAÇÃO</span>
                  <h2>Adicionais reutilizáveis</h2>
                  <p>Crie opções uma vez e use em vários produtos.</p>
                </div>
                <button className="ed-button ed-primary" onClick={addAddon}>
                  <Plus size={18} />
                  Novo adicional
                </button>
              </div>
              <div className="ed-editor-layout">
                <div className="ed-list">
                  {draft.addOns.map((item) => (
                    <button
                      className={`ed-list-row ed-product-row ${addonId === item.id ? 'active' : ''}`}
                      key={item.id}
                      onClick={() => setAddonId(item.id)}
                    >
                      {item.image ? (
                        <img src={item.image} alt="" />
                      ) : (
                        <div className="ed-row-image">
                          <ImagePlus size={20} />
                        </div>
                      )}
                      <span>
                        <strong>{item.name || 'Novo adicional'}</strong>
                        <small>
                          {money(item.price)} ·{' '}
                          {item.available === false ? 'Indisponível' : 'Disponível'}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {!draft.addOns.length && (
                    <div className="ed-list-empty">Nenhum adicional criado.</div>
                  )}
                </div>
                {selectedAddon && (
                  <div className="ed-panel ed-edit-panel">
                    <div className="ed-panel-head">
                      <h3>Editar adicional</h3>
                      <button
                        className="ed-icon-button ed-danger"
                        title="Excluir"
                        onClick={() => {
                          if (
                            window.confirm('Excluir este adicional de todos os produtos e grupos?')
                          ) {
                            edit((data) => {
                              data.addOns = data.addOns.filter((item) => item.id !== addonId)
                              data.products.forEach((item) => {
                                item.extraIds = item.extraIds?.filter((id) => id !== addonId)
                              })
                              data.optionGroups.forEach((item) => {
                                item.optionIds = item.optionIds.filter((id) => id !== addonId)
                              })
                            })
                            setAddonId('')
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <Input
                      label="Nome"
                      value={selectedAddon.name}
                      onChange={(value) =>
                        updateAddon((item) => {
                          item.name = value
                        })
                      }
                    />
                    <Textarea
                      label="Descrição"
                      value={selectedAddon.description || ''}
                      onChange={(value) =>
                        updateAddon((item) => {
                          item.description = value
                        })
                      }
                    />
                    <Input
                      label="Preço (R$)"
                      type="number"
                      min={0}
                      step={0.01}
                      value={(selectedAddon.price / 100).toFixed(2)}
                      onChange={(value) =>
                        updateAddon((item) => {
                          item.price = Math.round(Number(value) * 100) || 0
                        })
                      }
                    />
                    <Input
                      label="Máximo por opção"
                      type="number"
                      min={1}
                      value={selectedAddon.maxQuantity ?? 1}
                      onChange={(value) =>
                        updateAddon((item) => {
                          item.maxQuantity = Math.min(20, Math.max(1, Number(value) || 1))
                        })
                      }
                    />
                    <ImageField
                      templateId={currentId}
                      label="Fotografia"
                      value={selectedAddon.image}
                      onChange={(value) =>
                        updateAddon((item) => {
                          item.image = value
                        })
                      }
                    />
                    <Toggle
                      label="Disponível"
                      checked={selectedAddon.available !== false}
                      onChange={(value) =>
                        updateAddon((item) => {
                          item.available = value
                        })
                      }
                    />
                    <Toggle
                      label="Dados nutricionais disponíveis"
                      checked={Boolean(selectedAddon.nutrition)}
                      onChange={(value) =>
                        updateAddon((item) => {
                          item.nutrition = value
                            ? { calories: 0, protein: 0, carbohydrates: 0, fat: 0, servingSize: '' }
                            : undefined
                          if (value) item.nutritionSource = 'provided'
                        })
                      }
                    />
                    {selectedAddon.nutrition && (
                      <div className="ed-form-grid">
                        {(
                          [
                            ['calories', 'Calorias (kcal)'],
                            ['protein', 'Proteínas (g)'],
                            ['carbohydrates', 'Carboidratos (g)'],
                            ['fat', 'Gorduras (g)'],
                          ] as const
                        ).map(([key, label]) => (
                          <Input
                            key={key}
                            label={label}
                            type="number"
                            min={0}
                            value={selectedAddon.nutrition![key]}
                            onChange={(value) =>
                              updateAddon((item) => {
                                if (item.nutrition) {
                                  item.nutrition[key] = Number(value) || 0
                                  item.nutritionSource = 'provided'
                                }
                              })
                            }
                          />
                        ))}
                        <Input
                          label="Porção"
                          value={selectedAddon.nutrition.servingSize}
                          onChange={(value) =>
                            updateAddon((item) => {
                              if (item.nutrition) {
                                item.nutrition.servingSize = value
                                item.nutritionSource = 'provided'
                              }
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="ed-page-intro ed-subsection">
                <div>
                  <h2>Grupos de opções</h2>
                  <p>Configure escolhas obrigatórias, únicas ou múltiplas por produto.</p>
                </div>
                <button className="ed-button ed-secondary" onClick={addGroup}>
                  <Plus size={18} />
                  Novo grupo
                </button>
              </div>
              <div className="ed-editor-layout">
                <div className="ed-list">
                  {draft.optionGroups.map((group) => (
                    <button
                      className={`ed-list-row ${groupId === group.id ? 'active' : ''}`}
                      key={group.id}
                      onClick={() => setGroupId(group.id)}
                    >
                      <Tag size={18} />
                      <span>
                        <strong>{group.name || 'Novo grupo'}</strong>
                        <small>
                          {group.optionIds.length} opções ·{' '}
                          {group.min > 0 ? 'Obrigatório' : 'Opcional'}
                        </small>
                      </span>
                    </button>
                  ))}
                  {!draft.optionGroups.length && (
                    <div className="ed-list-empty">Nenhum grupo criado.</div>
                  )}
                </div>
                {selectedGroup && (
                  <div className="ed-panel ed-edit-panel">
                    <div className="ed-panel-head">
                      <h3>Editar grupo</h3>
                      <button
                        className="ed-icon-button ed-danger"
                        title="Excluir"
                        onClick={() => {
                          if (window.confirm('Excluir este grupo?')) {
                            edit((data) => {
                              data.optionGroups = data.optionGroups.filter(
                                (item) => item.id !== groupId,
                              )
                              data.products.forEach((item) => {
                                item.groupIds = item.groupIds?.filter((id) => id !== groupId)
                              })
                            })
                            setGroupId('')
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <Input
                      label="Título do grupo"
                      value={selectedGroup.name}
                      onChange={(value) =>
                        updateGroup((item) => {
                          item.name = value
                        })
                      }
                    />
                    <div className="ed-form-grid">
                      <Input
                        label="Mínimo de escolhas"
                        type="number"
                        min={0}
                        value={selectedGroup.min}
                        onChange={(value) =>
                          updateGroup((item) => {
                            item.min = Number(value) || 0
                          })
                        }
                      />
                      <Input
                        label="Máximo de escolhas"
                        type="number"
                        min={1}
                        value={selectedGroup.max}
                        onChange={(value) =>
                          updateGroup((item) => {
                            item.max = Number(value) || 1
                          })
                        }
                      />
                    </div>
                    <p className="ed-hint">
                      Máximo 1 cria escolha única. Mínimo maior que zero torna o grupo obrigatório.
                    </p>
                    <div className="ed-check-grid">
                      {draft.addOns.map((addon) => (
                        <Toggle
                          key={addon.id}
                          label={addon.name || 'Novo adicional'}
                          checked={selectedGroup.optionIds.includes(addon.id)}
                          onChange={(checked) =>
                            updateGroup((item) => {
                              item.optionIds = checked
                                ? [...item.optionIds, addon.id]
                                : item.optionIds.filter((id) => id !== addon.id)
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {section === 'recommendations' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">VENDA COM CONTEXTO</span>
                  <h2>Fica melhor com…</h2>
                  <p>
                    Escolha os produtos recomendados por padrão. Cada produto pode ter uma seleção
                    própria no seu editor.
                  </p>
                </div>
              </div>
              <div className="ed-panel">
                <h3>Recomendações gerais</h3>
                <div className="ed-check-grid">
                  {draft.products.map((item) => (
                    <Toggle
                      key={item.id}
                      label={item.name || 'Novo produto'}
                      checked={draft.recommendationIds.includes(item.id)}
                      onChange={(checked) =>
                        edit((data) => {
                          data.recommendationIds = checked
                            ? [...data.recommendationIds, item.id]
                            : data.recommendationIds.filter((id) => id !== item.id)
                        })
                      }
                    />
                  ))}
                </div>
                {!draft.products.length && (
                  <p className="ed-hint">Cadastre produtos para criar recomendações.</p>
                )}
                <div className="ed-order-list">
                  {draft.recommendationIds.map((id, index) => (
                    <div key={id}>
                      <span>{draft.products.find((item) => item.id === id)?.name}</span>
                      <button
                        disabled={index === 0}
                        onClick={() =>
                          edit((data) => {
                            ;[data.recommendationIds[index - 1], data.recommendationIds[index]] = [
                              data.recommendationIds[index],
                              data.recommendationIds[index - 1],
                            ]
                          })
                        }
                        aria-label="Mover para cima"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        disabled={index === draft.recommendationIds.length - 1}
                        onClick={() =>
                          edit((data) => {
                            ;[data.recommendationIds[index], data.recommendationIds[index + 1]] = [
                              data.recommendationIds[index + 1],
                              data.recommendationIds[index],
                            ]
                          })
                        }
                        aria-label="Mover para baixo"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {section === 'preview' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">ANTES DE PUBLICAR</span>
                  <h2>Confira seu cardápio</h2>
                  <p>
                    A prévia usa a tela pública e acompanha as mudanças do rascunho em tempo real.
                  </p>
                </div>
                <div className="ed-inline-actions">
                  <button
                    className="ed-button ed-secondary"
                    onClick={() =>
                      run(async () => {
                        await save()
                        setPreviewVersion((value) => value + 1)
                      })
                    }
                  >
                    Salvar e atualizar prévia
                  </button>
                  <button
                    className="ed-button ed-primary"
                    onClick={() => openModal('publish', currentId)}
                    disabled={!currentId}
                  >
                    Publicar
                  </button>
                </div>
              </div>
              <div className="ed-preview-tools">
                <div className="ed-tabs">
                  <button
                    className={previewDevice === 'mobile' ? 'active' : ''}
                    onClick={() => setPreviewDevice('mobile')}
                  >
                    Mobile
                  </button>
                  <button
                    className={previewDevice === 'desktop' ? 'active' : ''}
                    onClick={() => setPreviewDevice('desktop')}
                  >
                    Desktop
                  </button>
                </div>
                <div className="ed-tabs">
                  <button
                    className={themeMode === 'light' ? 'active' : ''}
                    onClick={() => setThemeMode('light')}
                  >
                    Claro
                  </button>
                  <button
                    className={themeMode === 'dark' ? 'active' : ''}
                    onClick={() => setThemeMode('dark')}
                  >
                    Escuro
                  </button>
                </div>
                <label className="ed-field">
                  <span>Visualizar</span>
                  <select
                    value={previewPage}
                    onChange={(event) => setPreviewPage(event.target.value)}
                  >
                    <option value="">Página inicial</option>
                    {draft.products.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name || 'Novo produto'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {currentId ? (
                <div className={`ed-preview-frame ${previewDevice}`}>
                  <iframe
                    key={`${currentId}-${themeMode}-${previewPage}-${previewVersion}`}
                    title="Pré-visualização do cardápio"
                    onLoad={(event) =>
                      event.currentTarget.contentWindow?.postMessage(
                        { type: 'cardapio-preview', draft },
                        location.origin,
                      )
                    }
                    src={`/preview?id=${encodeURIComponent(currentId)}&theme=${themeMode}${previewPage ? '#/produto/' + encodeURIComponent(previewPage) : ''}`}
                  />
                </div>
              ) : (
                <div className="ed-empty">Crie um template para visualizar.</div>
              )}
            </>
          )}
          {section === 'project' && currentId && (
            <ProjectPanel
              templateId={currentId}
              draft={draft}
              docs={projectDocs}
              captures={projectCaptures}
              hasPublished={projectPublished}
              codeExportAvailable={codeExportAvailable}
              exportVersion={exportVersion}
              exportCaptures={exportCaptures}
              exportAssets={exportAssets}
              onVersionChange={setExportVersion}
              onCapturesChange={setExportCaptures}
              onAssetsChange={setExportAssets}
              onDocsChange={(value) => {
                setProjectDocs(value)
                setProjectDirty(true)
              }}
              onCaptureListChange={setProjectCaptures}
              onSave={() => run(save)}
              onError={setError}
              onNotice={setNotice}
            />
          )}
          {section === 'settings' && (
            <>
              <div className="ed-page-intro">
                <div>
                  <span className="ed-kicker">CONFIGURAÇÕES</span>
                  <h2>Controle do template</h2>
                  <p>Salve uma cópia ou publique a versão pronta.</p>
                </div>
              </div>
              <div className="ed-panel">
                <Input
                  label="Nome do template"
                  value={templateName}
                  onChange={(value) => {
                    setTemplateName(value)
                    setUnsaved(true)
                  }}
                />
                <div className="ed-inline-actions">
                  <button
                    className="ed-button ed-primary"
                    onClick={() => run(save)}
                    disabled={!currentId}
                  >
                    Salvar alterações
                  </button>
                  <button
                    className="ed-button ed-secondary"
                    onClick={() => openModal('saveAs')}
                    disabled={!currentId}
                  >
                    Salvar como novo template
                  </button>
                  <button
                    className="ed-button ed-secondary"
                    onClick={() => openModal('publish', currentId)}
                    disabled={!currentId}
                  >
                    Publicar alterações
                  </button>
                </div>
                <p className="ed-hint">
                  O cardápio público só muda após a publicação. O template publicado não pode ser
                  excluído até que outro seja publicado.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
      {modal && (
        <div
          className="ed-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null)
          }}
        >
          <form
            className="ed-modal"
            onSubmit={submitModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ed-modal-title"
          >
            <button
              className="ed-modal-close"
              type="button"
              onClick={() => setModal(null)}
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
            <div className="ed-modal-icon">
              {modal.kind === 'delete' ? (
                <Trash2 size={23} />
              ) : modal.kind === 'publish' ? (
                <Upload size={23} />
              ) : (
                <FolderOpen size={23} />
              )}
            </div>
            <h2 id="ed-modal-title">
              {
                {
                  create: 'Novo tema',
                  saveAs: 'Salvar como novo tema',
                  rename: 'Renomear tema',
                  delete: 'Excluir tema?',
                  publish: 'Publicar cardápio?',
                }[modal.kind]
              }
            </h2>
            <p>
              {modal.kind === 'publish'
                ? `Publicar ${templates.find((item) => item.id === modal.id)?.name || 'este tema'} no cardápio público? Os outros temas serão preservados.`
                : modal.kind === 'delete'
                  ? `Excluir ${templates.find((item) => item.id === modal.id)?.name || 'este tema'}? Esta ação não pode ser desfeita.`
                  : 'Escolha um nome para identificar este cardápio na biblioteca.'}
            </p>
            {['create', 'saveAs', 'rename'].includes(modal.kind) && (
              <Input
                label="Nome do tema"
                value={modalName}
                onChange={setModalName}
                placeholder="Ex.: Cardápio principal"
              />
            )}
            {modal.kind === 'create' && templates.length > 0 && (
              <label className="ed-field">
                <span>Criar a partir de</span>
                <select
                  value={createSourceId}
                  onChange={(event) => setCreateSourceId(event.target.value)}
                >
                  <option value="">Tema vazio</option>
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="ed-modal-actions">
              <button
                type="button"
                className="ed-button ed-secondary"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                className={`ed-button ${modal.kind === 'delete' ? 'ed-delete' : 'ed-primary'}`}
                disabled={
                  busy || (['create', 'saveAs', 'rename'].includes(modal.kind) && !modalName.trim())
                }
              >
                {busy
                  ? 'Aguarde…'
                  : modal.kind === 'delete'
                    ? 'Excluir'
                    : modal.kind === 'publish'
                      ? 'Publicar'
                      : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
