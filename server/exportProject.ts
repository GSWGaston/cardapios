import { zipSync, strToU8 } from 'fflate'
import { db } from './db.ts'
import { emptyProjectDocs } from './projectSchema.ts'
import type { MenuTemplateData, ProjectDocs } from '../src/types.ts'
import { sourceExportAvailable, sourceExportFiles } from './sourceExport.ts'

const encoder = (value: unknown) =>
  strToU8(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
const secret =
  /((?:ADMIN_PASSWORD_HASH|TURSO_AUTH_TOKEN|VERCEL_OIDC_TOKEN|API_KEY|ACCESS_TOKEN|SECRET_KEY|PASSWORD)\s*[:=]\s*)[^\s,;"']+/gi
const redact = (value: string) =>
  value.replace(secret, '$1[REDACTED]').replace(/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
const safe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === 'string' ? redact(item) : item)),
  ) as T
const mediaName = (id: string) => `assets/${id}.webp`

export async function buildProjectZip(
  templateId: string,
  version: 'draft' | 'published',
  includeCaptures: boolean,
  includeAssets: boolean,
  draftOverride?: MenuTemplateData,
  docsOverride?: ProjectDocs,
  includeCode = false,
) {
  const row = await db.execute({
    sql: 'SELECT id,name,draft,published FROM templates WHERE id=?',
    args: [templateId],
  })
  const template = row.rows[0]
  if (!template) return null
  if (version === 'published' && !template.published)
    throw new Error('Este tema ainda não possui versão publicada.')
  const data = structuredClone(
    draftOverride ||
      JSON.parse(String(version === 'published' ? template.published : template.draft)),
  ) as MenuTemplateData
  const docRow = await db.execute({
    sql: 'SELECT content FROM project_docs WHERE template_id=?',
    args: [templateId],
  })
  const docs: ProjectDocs =
    docsOverride ||
    (docRow.rows[0] ? JSON.parse(String(docRow.rows[0].content)) : emptyProjectDocs())
  const withCode = includeCode && sourceExportAvailable()
  const files: Record<string, Uint8Array> = {}
  const put = (path: string, value: unknown) => {
    files[`projeto-cardapio/${path}`] = encoder(value)
  }
  const missing: string[] = []
  if (includeAssets) {
    const refs = new Set<string>()
    for (const color of [data.themes.light, data.themes.dark])
      for (const value of [color.logo, color.nameImage]) if (value) refs.add(value)
    for (const category of data.categories) if (category.image) refs.add(category.image)
    for (const product of data.products) if (product.image) refs.add(product.image)
    for (const addon of data.addOns) if (addon.image) refs.add(addon.image)
    const replacement = new Map<string, string>()
    for (const ref of refs) {
      const match = /^\/api\/assets\/([a-f0-9-]{36})$/.exec(ref)
      if (!match) {
        missing.push(ref)
        continue
      }
      const image = await db.execute({
        sql: 'SELECT mime,data FROM assets WHERE id=?',
        args: [match[1]],
      })
      if (!image.rows[0]) {
        missing.push(ref)
        continue
      }
      const path = mediaName(match[1])
      files[`projeto-cardapio/${path}`] = new Uint8Array(image.rows[0].data as ArrayBuffer)
      replacement.set(ref, path)
    }
    const rewrite = (value: string | undefined) => (value ? replacement.get(value) || value : value)
    for (const mode of [data.themes.light, data.themes.dark]) {
      mode.logo = rewrite(mode.logo)
      mode.nameImage = rewrite(mode.nameImage)
    }
    data.categories.forEach((item) => {
      item.image = rewrite(item.image)
    })
    data.products.forEach((item) => {
      item.image = rewrite(item.image) || ''
    })
    data.addOns.forEach((item) => {
      item.image = rewrite(item.image) || ''
    })
  }
  if (includeCaptures) {
    const captures = await db.execute({
      sql: 'SELECT id,title,description,screen,device,mode,state,mime,data FROM project_captures WHERE template_id=? ORDER BY position,created_at',
      args: [templateId],
    })
    const metadata = []
    for (const capture of captures.rows) {
      const path = `capturas/${String(capture.id)}.webp`
      files[`projeto-cardapio/${path}`] = new Uint8Array(capture.data as ArrayBuffer)
      metadata.push({
        path,
        title: capture.title,
        description: capture.description,
        screen: capture.screen,
        device: capture.device,
        mode: capture.mode,
        state: capture.state,
      })
    }
    if (metadata.length) put('capturas/indice.json', safe(metadata))
  }
  if (withCode) {
    const source = await sourceExportFiles()
    for (const [path, content] of Object.entries(source))
      files[`projeto-cardapio/${path}`] = content
  }
  put(
    'configuracoes.json',
    safe({
      name: template.name,
      restaurant: data.restaurant,
      themes: data.themes,
      font: data.font,
      categories: data.categories,
      products: data.products,
      addOns: data.addOns,
      optionGroups: data.optionGroups,
      recommendationIds: data.recommendationIds,
    }),
  )
  const project = safe(docs)
  put(
    'documentacao.md',
    `# ${project.title || template.name}\n\n${project.description}\n\n## Estabelecimento e público\n${project.establishment}\n${project.audience}\n\n## Tecnologias informadas\n${project.technologies}\n\n## Arquitetura e funcionalidades\n${project.architecture}\n\n## Execução e implantação\n${project.operations}\n\n## Observações\n${project.notes}\n`,
  )
  put(
    'estrutura-e-funcionalidades.md',
    `# Estrutura e funcionalidades\n\nEste pacote descreve o tema "${redact(String(template.name))}" na versão ${version === 'draft' ? 'rascunho' : 'publicada'}. As configurações completas estão em configuracoes.json.\n\n## Conteúdo deste tema\n- ${data.categories.length} categorias\n- ${data.products.length} produtos\n- ${data.addOns.length} adicionais\n- ${data.optionGroups.length} grupos de opções\n- ${data.recommendationIds.length} recomendações cadastradas\n\n## Telas e interações implementadas\n- Cardápio público com categorias, busca, favoritos e cards de produtos.\n- Detalhes do produto com descrição, informações nutricionais quando cadastradas, adicionais permitidos e recomendações.\n- Carrinho local com quantidades e preços das seleções. O aplicativo não processa pedidos ou pagamentos.\n- Identidade visual em modos claro e escuro, incluindo fonte, cores e imagens cadastradas.\n\n## Publicação e edição\nO editor mantém rascunho e última publicação separados. Apenas o tema selecionado como destaque alimenta o site público. Dados deste pacote não alteram o site ao serem exportados.\n\n## Observações do projeto\n${project.architecture}\n${project.notes}\n`,
  )
  put(
    'codigo-referencia.md',
    `# Referência de código\n\n${withCode ? 'O código-base compartilhado está incluído em codigo-fonte/.' : 'O código-fonte não está incluído.'} Os temas desta instalação utilizam o mesmo código-base, salvo indicação contrária abaixo.\n\nRepositório informado: ${project.repositoryUrl || 'não informado'}\nReferência informada: ${project.codeRef || 'não informada'}\nSite informado: ${project.siteUrl || 'não informado'}\n`,
  )
  put(
    'instrucoes-para-ia.md',
    `# Instruções para IA\n\nRecrie ou adapte o cardápio usando configuracoes.json e as mídias presentes. Respeite categorias, produtos, preços, adicionais, recomendações, informações nutricionais e temas claro/escuro. Dados ausentes devem permanecer ausentes; não invente marcas ou informações nutricionais. Preserve navegação, carrinho e personalização descritos na documentação. Este pacote não garante reprodução exata do código.\n\n${project.aiInstructions}\n`,
  )
  put(
    'README.md',
    `# Exportação do tema ${redact(String(template.name))}\n\nVersão: ${version === 'draft' ? 'rascunho atual' : 'última publicação'}\nCódigo-fonte: ${withCode ? 'incluído em codigo-fonte/' : 'não incluído'}; consulte codigo-referencia.md.\n${missing.length ? `\nMídias referenciadas não incluídas: ${missing.map(redact).join(', ')}.\n` : ''}`,
  )
  put('manifesto.json', {
    schemaVersion: 1,
    templateId,
    name: redact(String(template.name)),
    exportedAt: new Date().toISOString(),
    version,
    files: Object.keys(files)
      .map((path) => path.replace(/^projeto-cardapio\//, ''))
      .concat('manifesto.json')
      .sort(),
  })
  return Buffer.from(zipSync(files, { level: 0 }))
}
