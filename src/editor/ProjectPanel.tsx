import { useState } from 'react'
import { ArrowDown, ArrowUp, Download, ExternalLink, Trash2, Upload } from 'lucide-react'
import type { MenuTemplateData, ProjectCapture, ProjectDocs } from '../types'

type Props = {
  templateId: string
  draft: MenuTemplateData
  docs: ProjectDocs
  captures: ProjectCapture[]
  hasPublished: boolean
  codeExportAvailable: boolean
  exportVersion: 'draft' | 'published'
  exportCaptures: boolean
  exportAssets: boolean
  onVersionChange: (value: 'draft' | 'published') => void
  onCapturesChange: (value: boolean) => void
  onAssetsChange: (value: boolean) => void
  onDocsChange: (value: ProjectDocs) => void
  onCaptureListChange: (value: ProjectCapture[]) => void
  onSave: () => void
  onError: (value: string) => void
  onNotice: (value: string) => void
}

const fields: { key: keyof ProjectDocs; label: string; multiline?: boolean }[] = [
  { key: 'title', label: 'Título do projeto' },
  { key: 'description', label: 'Descrição e objetivo', multiline: true },
  { key: 'establishment', label: 'Tipo de estabelecimento' },
  { key: 'audience', label: 'Público-alvo' },
  { key: 'technologies', label: 'Tecnologias utilizadas' },
  { key: 'siteUrl', label: 'URL do site' },
  { key: 'repositoryUrl', label: 'URL do repositório' },
  { key: 'codeRef', label: 'Branch, tag ou commit' },
  { key: 'architecture', label: 'Arquitetura, páginas e funcionalidades', multiline: true },
  { key: 'operations', label: 'Execução e implantação', multiline: true },
  { key: 'notes', label: 'Observações e decisões', multiline: true },
  { key: 'aiInstructions', label: 'Instruções para IA', multiline: true },
]

async function request(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok)
    throw new Error((await response.json().catch(() => ({}))).error || 'Falha na operação.')
  return response
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

export function ProjectPanel(props: Props) {
  const [busy, setBusy] = useState(false)
  const [openCapture, setOpenCapture] = useState('')
  const [includeCode, setIncludeCode] = useState(false)
  const [captureVersion, setCaptureVersion] = useState<Record<string, number>>({})
  const base = `/api/templates/${encodeURIComponent(props.templateId)}`
  const change = (key: keyof ProjectDocs, value: string) =>
    props.onDocsChange({ ...props.docs, [key]: value })
  const refresh = async () => {
    const response = await request(`${base}/project`, 'GET')
    const data = await response.json()
    props.onCaptureListChange(data.captures)
  }
  const act = async (action: () => Promise<void>) => {
    setBusy(true)
    props.onError('')
    try {
      await action()
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Falha na operação.')
    } finally {
      setBusy(false)
    }
  }
  const upload = (file: File) =>
    act(async () => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000)
        throw new Error('Envie PNG, JPEG ou WebP de até 5 MB.')
      const data = await readAsDataUrl(file)
      await request(`${base}/captures`, 'POST', {
        title: file.name.replace(/\.[^.]+$/, ''),
        description: '',
        screen: 'cardapio',
        device: 'mobile',
        mode: 'light',
        state: '',
        data,
      })
      await refresh()
      props.onNotice('Captura adicionada ao projeto.')
    })
  const update = (capture: ProjectCapture) =>
    act(async () => {
      await request(`${base}/captures/${capture.id}`, 'PUT', capture)
      props.onNotice('Captura atualizada.')
    })
  const replace = (capture: ProjectCapture, file: File) =>
    act(async () => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000)
        throw new Error('Envie PNG, JPEG ou WebP de até 5 MB.')
      await request(`${base}/captures/${capture.id}/file`, 'PUT', {
        data: await readAsDataUrl(file),
      })
      setCaptureVersion((previous) => ({
        ...previous,
        [capture.id]: (previous[capture.id] || 0) + 1,
      }))
      props.onNotice('Imagem da captura substituída.')
    })
  const remove = (capture: ProjectCapture) => {
    if (!window.confirm(`Excluir a captura "${capture.title}"?`)) return
    act(async () => {
      await request(`${base}/captures/${capture.id}`, 'DELETE')
      await refresh()
      props.onNotice('Captura excluída.')
    })
  }
  const move = (capture: ProjectCapture, direction: number) =>
    act(async () => {
      const sorted = [...props.captures].sort((a, b) => a.position - b.position)
      const index = sorted.findIndex((item) => item.id === capture.id)
      const other = sorted[index + direction]
      if (!other) return
      await request(`${base}/captures/${capture.id}`, 'PUT', {
        ...capture,
        position: other.position,
      })
      await request(`${base}/captures/${other.id}`, 'PUT', { ...other, position: capture.position })
      await refresh()
    })
  const exportZip = () =>
    act(async () => {
      const params = new URLSearchParams({
        version: props.exportVersion,
        captures: props.exportCaptures ? '1' : '0',
        assets: props.exportAssets ? '1' : '0',
        code: includeCode && props.codeExportAvailable ? '1' : '0',
      })
      const response =
        props.exportVersion === 'draft'
          ? await request(`${base}/export?${params}`, 'POST', {
              draft: props.draft,
              docs: props.docs,
            })
          : await request(`${base}/export?${params}`, 'GET')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `projeto-cardapio-${props.templateId}.zip`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      props.onNotice('ZIP pronto para download.')
    })

  return (
    <div className="ed-project-layout">
      <div className="ed-page-intro">
        <div>
          <span className="ed-kicker">DOCUMENTAÇÃO DO TEMA</span>
          <h2>Projeto e Código</h2>
          <p>Registre informações reais deste projeto e exporte um pacote para IA.</p>
        </div>
      </div>
      <section className="ed-panel">
        <h3>Informações do projeto</h3>
        <p>
          Se os temas usam o mesmo aplicativo, informe a referência do código-base compartilhado.
          Campos vazios não serão inventados.
        </p>
        <div className="ed-project-fields">
          {fields.map((field) => (
            <label className="ed-field" key={field.key}>
              <span>{field.label}</span>
              {field.multiline ? (
                <textarea
                  rows={4}
                  value={props.docs[field.key]}
                  onChange={(event) => change(field.key, event.target.value)}
                />
              ) : (
                <input
                  value={props.docs[field.key]}
                  onChange={(event) => change(field.key, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <button className="ed-button ed-primary" onClick={props.onSave}>
          Salvar alterações
        </button>
      </section>
      <section className="ed-panel">
        <h3>Capturas de tela</h3>
        <p>As imagens ficam privadas e vinculadas a este tema. Até 30 capturas de 5 MB.</p>
        <label className="ed-button ed-secondary ed-capture-upload">
          <Upload size={17} /> Adicionar captura{' '}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) upload(file)
              event.target.value = ''
            }}
          />
        </label>
        {props.captures.length ? (
          <div className="ed-capture-grid">
            {[...props.captures]
              .sort((a, b) => a.position - b.position)
              .map((capture) => (
                <article className="ed-capture-card" key={capture.id}>
                  <button
                    type="button"
                    className="ed-capture-image"
                    onClick={() => setOpenCapture(capture.id)}
                  >
                    <img
                      src={`${base}/captures/${capture.id}?v=${captureVersion[capture.id] || 0}`}
                      alt={capture.title || 'Captura do projeto'}
                    />
                  </button>
                  <label className="ed-field">
                    <span>Título</span>
                    <input
                      value={capture.title}
                      onChange={(event) =>
                        props.onCaptureListChange(
                          props.captures.map((item) =>
                            item.id === capture.id ? { ...item, title: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="ed-field">
                    <span>Descrição</span>
                    <input
                      value={capture.description}
                      onChange={(event) =>
                        props.onCaptureListChange(
                          props.captures.map((item) =>
                            item.id === capture.id
                              ? { ...item, description: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="ed-capture-meta">
                    <label className="ed-field">
                      <span>Tela</span>
                      <select
                        value={capture.screen}
                        onChange={(event) =>
                          props.onCaptureListChange(
                            props.captures.map((item) =>
                              item.id === capture.id
                                ? { ...item, screen: event.target.value }
                                : item,
                            ),
                          )
                        }
                      >
                        {['cardapio', 'detalhes', 'carrinho', 'editor', 'outra'].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ed-field">
                      <span>Dispositivo</span>
                      <select
                        value={capture.device}
                        onChange={(event) =>
                          props.onCaptureListChange(
                            props.captures.map((item) =>
                              item.id === capture.id
                                ? { ...item, device: event.target.value }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="mobile">Mobile</option>
                        <option value="desktop">Desktop</option>
                      </select>
                    </label>
                    <label className="ed-field">
                      <span>Modo</span>
                      <select
                        value={capture.mode}
                        onChange={(event) =>
                          props.onCaptureListChange(
                            props.captures.map((item) =>
                              item.id === capture.id ? { ...item, mode: event.target.value } : item,
                            ),
                          )
                        }
                      >
                        <option value="light">Claro</option>
                        <option value="dark">Escuro</option>
                      </select>
                    </label>
                  </div>
                  <label className="ed-field">
                    <span>Estado exibido</span>
                    <input
                      value={capture.state}
                      onChange={(event) =>
                        props.onCaptureListChange(
                          props.captures.map((item) =>
                            item.id === capture.id ? { ...item, state: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="ed-inline-actions">
                    <button
                      className="ed-button ed-secondary"
                      disabled={busy}
                      onClick={() => update(capture)}
                    >
                      Salvar captura
                    </button>
                    <label className="ed-button ed-secondary ed-capture-upload">
                      Substituir
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) replace(capture, file)
                          event.target.value = ''
                        }}
                      />
                    </label>
                    <button
                      className="ed-icon-button"
                      aria-label="Mover captura para cima"
                      disabled={busy}
                      onClick={() => move(capture, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="ed-icon-button"
                      aria-label="Mover captura para baixo"
                      disabled={busy}
                      onClick={() => move(capture, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      className="ed-icon-button ed-danger"
                      aria-label="Excluir captura"
                      disabled={busy}
                      onClick={() => remove(capture)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
          </div>
        ) : (
          <p>Nenhuma captura cadastrada.</p>
        )}
      </section>
      <section className="ed-panel">
        <h3>Exportar para IA (ZIP)</h3>
        <p>
          Inclui configurações do tema, documentação e referências de código.{' '}
          {props.codeExportAvailable
            ? 'O código-base local pode ser incluído mediante sua escolha; arquivos de ambiente, dependências e dados privados são excluídos.'
            : 'O código-fonte não está disponível para inclusão automática nesta hospedagem; o ZIP informa apenas a referência cadastrada.'}
        </p>
        <div className="ed-project-export-controls">
          <label className="ed-field">
            <span>Versão</span>
            <select
              value={props.exportVersion}
              onChange={(event) =>
                props.onVersionChange(event.target.value as 'draft' | 'published')
              }
            >
              <option value="draft">Rascunho atual</option>
              {props.hasPublished && <option value="published">Última publicação</option>}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={props.exportCaptures}
              onChange={(event) => props.onCapturesChange(event.target.checked)}
            />{' '}
            Incluir capturas
          </label>
          <label>
            <input
              type="checkbox"
              checked={props.exportAssets}
              onChange={(event) => props.onAssetsChange(event.target.checked)}
            />{' '}
            Incluir assets disponíveis
          </label>
          {props.codeExportAvailable && (
            <label>
              <input
                type="checkbox"
                checked={includeCode}
                onChange={(event) => setIncludeCode(event.target.checked)}
              />{' '}
              Incluir código-base local
            </label>
          )}
        </div>
        <p className="ed-hint">
          O rascunho inclui alterações ainda não salvas. A exportação não salva nem publica o tema.
        </p>
        <button className="ed-button ed-primary" disabled={busy} onClick={exportZip}>
          <Download size={17} /> {busy ? 'Preparando ZIP…' : 'Exportar para IA (ZIP)'}
        </button>
      </section>
      {openCapture && (
        <div className="ed-modal-backdrop" onClick={() => setOpenCapture('')}>
          <div className="ed-capture-lightbox">
            <button className="ed-button ed-secondary" onClick={() => setOpenCapture('')}>
              Fechar
            </button>
            <img
              src={`${base}/captures/${openCapture}?v=${captureVersion[openCapture] || 0}`}
              alt="Captura ampliada"
            />
            <a href={`${base}/captures/${openCapture}`} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Abrir imagem
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
