import type express from 'express'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { db } from './db.ts'
import { buildProjectZip } from './exportProject.ts'
import { captureMetaSchema, emptyProjectDocs, projectDocsSchema } from './projectSchema.ts'
import { templateSchema } from './schema.ts'
import { assetsBelongTo } from './assetOwnership.ts'
import { sourceExportAvailable } from './sourceExport.ts'

type Auth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => Promise<void>

export function registerProjectRoutes(app: express.Express, requireAuth: Auth) {
  app.get('/api/templates/:id/project', requireAuth, async (req, res) => {
    const id = String(req.params.id)
    const template = await db.execute({
      sql: 'SELECT id,published FROM templates WHERE id=?',
      args: [id],
    })
    if (!template.rows[0]) {
      res.status(404).json({ error: 'Tema não encontrado.' })
      return
    }
    const docs = await db.execute({
      sql: 'SELECT content FROM project_docs WHERE template_id=?',
      args: [id],
    })
    const captures = await db.execute({
      sql: 'SELECT id,title,description,screen,device,mode,state,created_at,position FROM project_captures WHERE template_id=? ORDER BY position,created_at',
      args: [id],
    })
    res.json({
      docs: docs.rows[0] ? JSON.parse(String(docs.rows[0].content)) : emptyProjectDocs(),
      hasPublishedVersion: Boolean(template.rows[0].published),
      codeExportAvailable: sourceExportAvailable(),
      captures: captures.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        screen: row.screen,
        device: row.device,
        mode: row.mode,
        state: row.state,
        createdAt: row.created_at,
        position: row.position,
      })),
    })
  })
  app.put('/api/templates/:id/project', requireAuth, async (req, res) => {
    const parsed = projectDocsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Revise as informações do projeto.' })
      return
    }
    const template = await db.execute({
      sql: 'SELECT id FROM templates WHERE id=?',
      args: [String(req.params.id)],
    })
    if (!template.rows[0]) {
      res.status(404).json({ error: 'Tema não encontrado.' })
      return
    }
    await db.execute({
      sql: 'INSERT INTO project_docs (template_id,content) VALUES (?,?) ON CONFLICT(template_id) DO UPDATE SET content=excluded.content',
      args: [String(req.params.id), JSON.stringify(parsed.data)],
    })
    res.json({ ok: true })
  })
  app.post('/api/templates/:id/captures', requireAuth, async (req, res) => {
    const templateId = String(req.params.id)
    const template = await db.execute({
      sql: 'SELECT id FROM templates WHERE id=?',
      args: [templateId],
    })
    if (!template.rows[0]) {
      res.status(404).json({ error: 'Tema não encontrado.' })
      return
    }
    const parsed = captureMetaSchema.safeParse(req.body)
    const data = req.body?.data
    if (
      !parsed.success ||
      typeof data !== 'string' ||
      !/^data:image\/(png|jpeg|webp);base64,/.test(data)
    ) {
      res.status(400).json({ error: 'Envie PNG, JPEG ou WebP com dados válidos.' })
      return
    }
    const bytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64')
    if (bytes.length > 5_000_000) {
      res.status(413).json({ error: 'A captura deve ter até 5 MB.' })
      return
    }
    const count = await db.execute({
      sql: 'SELECT COUNT(*) AS total FROM project_captures WHERE template_id=?',
      args: [templateId],
    })
    if (Number(count.rows[0]?.total) >= 30) {
      res.status(400).json({ error: 'Limite de 30 capturas por tema.' })
      return
    }
    try {
      const meta = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata()
      if (!['png', 'jpeg', 'webp'].includes(meta.format || '')) throw new Error('Formato inválido')
      const output = await sharp(bytes, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      const id = randomUUID()
      await db.execute({
        sql: 'INSERT INTO project_captures VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        args: [
          id,
          templateId,
          parsed.data.title,
          parsed.data.description,
          parsed.data.screen,
          parsed.data.device,
          parsed.data.mode,
          parsed.data.state,
          'image/webp',
          output,
          new Date().toISOString(),
          Number(count.rows[0]?.total),
        ],
      })
      res.status(201).json({ id })
    } catch {
      res.status(400).json({ error: 'Imagem inválida ou incompatível.' })
    }
  })
  app.get('/api/templates/:id/captures/:captureId', requireAuth, async (req, res) => {
    const image = await db.execute({
      sql: 'SELECT mime,data FROM project_captures WHERE template_id=? AND id=?',
      args: [String(req.params.id), String(req.params.captureId)],
    })
    if (!image.rows[0]) {
      res.status(404).end()
      return
    }
    res.setHeader('Content-Type', String(image.rows[0].mime))
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(Buffer.from(image.rows[0].data as ArrayBuffer))
  })
  app.put('/api/templates/:id/captures/:captureId', requireAuth, async (req, res) => {
    const parsed = captureMetaSchema.safeParse(req.body)
    const position = Number(req.body?.position)
    if (!parsed.success || !Number.isInteger(position) || position < 0 || position > 100) {
      res.status(400).json({ error: 'Dados da captura inválidos.' })
      return
    }
    const result = await db.execute({
      sql: 'UPDATE project_captures SET title=?, description=?, screen=?, device=?, mode=?, state=?, position=? WHERE template_id=? AND id=?',
      args: [
        parsed.data.title,
        parsed.data.description,
        parsed.data.screen,
        parsed.data.device,
        parsed.data.mode,
        parsed.data.state,
        position,
        String(req.params.id),
        String(req.params.captureId),
      ],
    })
    if (!result.rowsAffected) {
      res.status(404).json({ error: 'Captura não encontrada.' })
      return
    }
    res.json({ ok: true })
  })
  app.put('/api/templates/:id/captures/:captureId/file', requireAuth, async (req, res) => {
    const data = req.body?.data
    if (typeof data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(data)) {
      res.status(400).json({ error: 'Envie PNG, JPEG ou WebP.' })
      return
    }
    const bytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64')
    if (bytes.length > 5_000_000) {
      res.status(413).json({ error: 'A captura deve ter até 5 MB.' })
      return
    }
    try {
      const meta = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata()
      if (!['png', 'jpeg', 'webp'].includes(meta.format || '')) throw new Error('Formato inválido')
      const output = await sharp(bytes, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      const result = await db.execute({
        sql: 'UPDATE project_captures SET data=?,mime=? WHERE template_id=? AND id=?',
        args: [output, 'image/webp', String(req.params.id), String(req.params.captureId)],
      })
      if (!result.rowsAffected) {
        res.status(404).json({ error: 'Captura não encontrada.' })
        return
      }
      res.json({ ok: true })
    } catch {
      res.status(400).json({ error: 'Imagem inválida ou incompatível.' })
    }
  })
  app.delete('/api/templates/:id/captures/:captureId', requireAuth, async (req, res) => {
    const result = await db.execute({
      sql: 'DELETE FROM project_captures WHERE template_id=? AND id=?',
      args: [String(req.params.id), String(req.params.captureId)],
    })
    if (!result.rowsAffected) {
      res.status(404).json({ error: 'Captura não encontrada.' })
      return
    }
    res.json({ ok: true })
  })
  app.get('/api/templates/:id/export', requireAuth, async (req, res) => {
    const version = req.query.version === 'published' ? 'published' : 'draft'
    try {
      const zip = await buildProjectZip(
        String(req.params.id),
        version,
        req.query.captures !== '0',
        req.query.assets !== '0',
        undefined,
        undefined,
        req.query.code === '1',
      )
      if (!zip) {
        res.status(404).json({ error: 'Tema não encontrado.' })
        return
      }
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="projeto-cardapio-${String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '')}.zip"`,
      )
      res.setHeader('Cache-Control', 'private, no-store')
      res.send(zip)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao exportar.' })
    }
  })
  app.post('/api/templates/:id/export', requireAuth, async (req, res) => {
    const draft = templateSchema.safeParse(req.body?.draft)
    const docs = projectDocsSchema.safeParse(req.body?.docs)
    if (!draft.success || !docs.success) {
      res.status(400).json({ error: 'Revise o rascunho e a documentação antes de exportar.' })
      return
    }
    if (!(await assetsBelongTo(draft.data, String(req.params.id)))) {
      res.status(403).json({ error: 'Uma imagem pertence a outro tema.' })
      return
    }
    try {
      const zip = await buildProjectZip(
        String(req.params.id),
        'draft',
        req.query.captures !== '0',
        req.query.assets !== '0',
        draft.data,
        docs.data,
        req.query.code === '1',
      )
      if (!zip) {
        res.status(404).json({ error: 'Tema não encontrado.' })
        return
      }
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="projeto-cardapio-${String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '')}.zip"`,
      )
      res.setHeader('Cache-Control', 'private, no-store')
      res.send(zip)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao exportar.' })
    }
  })
}
