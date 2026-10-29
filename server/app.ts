import express from 'express'
import sharp from 'sharp'
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { db, initDb } from './db.ts'
import { templateSchema, validatePublish } from './schema.ts'
import { emptyTemplate } from '../src/data/template.ts'

export const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '3mb' }))
app.use(async (_req, _res, next) => {
  try {
    await initDb()
    next()
  } catch (error) {
    next(error)
  }
})
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin')
    let validOrigin = true
    try {
      if (origin) validOrigin = new URL(origin).host === req.get('host')
    } catch {
      validOrigin = false
    }
    if (!validOrigin) {
      res.status(403).json({ error: 'Origem não permitida.' })
      return
    }
  }
  next()
})

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const cookieName = 'cardapio_admin'
function readCookie(req: express.Request) {
  return req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + '='))
    ?.slice(cookieName.length + 1)
}
function setCookie(res: express.Response, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${value}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`,
  )
}
async function authenticated(req: express.Request) {
  const token = readCookie(req)
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false
  const row = await db.execute({
    sql: 'SELECT expires_at FROM sessions WHERE token_hash = ?',
    args: [hash(token)],
  })
  return Number(row.rows[0]?.expires_at || 0) > Date.now()
}
async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    if (await authenticated(req)) next()
    else res.status(401).json({ error: 'Faça login para acessar o editor.' })
  } catch (error) {
    next(error)
  }
}
function verifyPassword(password: string) {
  const [method, salt, expected] = (process.env.ADMIN_PASSWORD_HASH || '').split(':')
  if (method !== 'scrypt' || !salt || !expected || !/^[a-f0-9]{128}$/.test(expected)) return false
  const actual = scryptSync(password, salt, 64)
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'))
}

app.post('/api/auth/login', async (req, res) => {
  if (!process.env.ADMIN_PASSWORD_HASH) {
    res.status(503).json({ error: 'Credencial administrativa não configurada no servidor.' })
    return
  }
  const password = req.body?.password
  if (typeof password !== 'string' || password.length > 1024) {
    res.status(400).json({ error: 'Informe uma senha válida.' })
    return
  }
  const clientKey = hash(
    process.env.VERCEL ? req.get('x-vercel-forwarded-for') || req.ip || '' : req.ip || 'local',
  )
  const now = Date.now()
  await db.execute({ sql: 'DELETE FROM sessions WHERE expires_at <= ?', args: [now] })
  const attempts = await db.execute({
    sql: 'SELECT * FROM login_attempts WHERE client_key = ?',
    args: [clientKey],
  })
  const record = attempts.rows[0]
  if (record && Number(record.locked_until) > now) {
    res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' })
    return
  }
  if (!verifyPassword(password)) {
    const count =
      record && now - Number(record.window_start) < 900000 ? Number(record.count) + 1 : 1
    await db.execute({
      sql: 'INSERT INTO login_attempts VALUES (?, ?, ?, ?) ON CONFLICT(client_key) DO UPDATE SET count=excluded.count, window_start=excluded.window_start, locked_until=excluded.locked_until',
      args: [
        clientKey,
        count,
        count === 1 ? now : Number(record?.window_start),
        count >= 5 ? now + 900000 : 0,
      ],
    })
    res
      .status(count >= 5 ? 429 : 401)
      .json({ error: count >= 5 ? 'Muitas tentativas. Aguarde 15 minutos.' : 'Senha incorreta.' })
    return
  }
  await db.execute({ sql: 'DELETE FROM login_attempts WHERE client_key = ?', args: [clientKey] })
  const token = randomBytes(32).toString('hex')
  await db.execute({
    sql: 'INSERT INTO sessions VALUES (?, ?)',
    args: [hash(token), now + 7 * 86400000],
  })
  setCookie(res, token, 7 * 86400)
  res.json({ authenticated: true })
})
app.get('/api/auth/session', async (req, res) => {
  res.json({
    authenticated: await authenticated(req),
    configured: Boolean(process.env.ADMIN_PASSWORD_HASH),
  })
})
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const token = readCookie(req)!
  await db.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [hash(token)] })
  setCookie(res, '', 0)
  res.json({ ok: true })
})

app.get('/api/public', async (_req, res) => {
  const result = await db.execute(
    "SELECT t.published FROM templates t JOIN settings s ON s.value=t.id WHERE s.key='published_id'",
  )
  if (!result.rows[0]?.published) {
    res.status(404).json({ error: 'Nenhum cardápio publicado.' })
    return
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json(JSON.parse(String(result.rows[0].published)))
})

app.get('/api/templates', requireAuth, async (_req, res) => {
  const result = await db.execute(
    "SELECT t.*, s.value AS published_id FROM templates t LEFT JOIN settings s ON s.key='published_id' ORDER BY t.updated_at DESC",
  )
  res.json(
    result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      draft: JSON.parse(String(row.draft)),
      updatedAt: row.updated_at,
      published: row.id === row.published_id,
      dirty: row.published !== row.draft,
    })),
  )
})
app.post('/api/templates', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name || name.length > 100) {
    res.status(400).json({ error: 'Informe um nome de até 100 caracteres.' })
    return
  }
  let data = emptyTemplate()
  if (req.body?.sourceId) {
    const source = await db.execute({
      sql: 'SELECT draft FROM templates WHERE id = ?',
      args: [req.body.sourceId],
    })
    if (!source.rows[0]) {
      res.status(404).json({ error: 'Template de origem não encontrado.' })
      return
    }
    data = JSON.parse(String(source.rows[0].draft))
  } else if (req.body?.draft) {
    const parsed = templateSchema.safeParse(req.body.draft)
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() })
      return
    }
    data = parsed.data
  }
  const id = randomUUID()
  await db.execute({
    sql: 'INSERT INTO templates (id, name, draft, updated_at) VALUES (?, ?, ?, ?)',
    args: [id, name, JSON.stringify(data), new Date().toISOString()],
  })
  res.status(201).json({ id })
})
app.put('/api/templates/:id', requireAuth, async (req, res) => {
  const parsed = templateSchema.safeParse(req.body?.draft)
  const name = String(req.body?.name || '').trim()
  if (!parsed.success || !name || name.length > 100) {
    res
      .status(400)
      .json({
        error: 'Revise o nome e os dados do template.',
        details: parsed.success ? undefined : parsed.error.flatten(),
      })
    return
  }
  const result = await db.execute({
    sql: 'UPDATE templates SET name=?, draft=?, updated_at=? WHERE id=?',
    args: [name, JSON.stringify(parsed.data), new Date().toISOString(), String(req.params.id)],
  })
  if (!result.rowsAffected) {
    res.status(404).json({ error: 'Template não encontrado.' })
    return
  }
  res.json({ ok: true })
})
app.delete('/api/templates/:id', requireAuth, async (req, res) => {
  const published = await db.execute("SELECT value FROM settings WHERE key='published_id'")
  if (published.rows[0]?.value === req.params.id) {
    res.status(409).json({ error: 'Publique outro template antes de excluir este.' })
    return
  }
  const result = await db.execute({
    sql: 'DELETE FROM templates WHERE id=?',
    args: [String(req.params.id)],
  })
  if (!result.rowsAffected) {
    res.status(404).json({ error: 'Template não encontrado.' })
    return
  }
  res.json({ ok: true })
})
app.post('/api/templates/:id/publish', requireAuth, async (req, res) => {
  const found = await db.execute({
    sql: 'SELECT draft FROM templates WHERE id=?',
    args: [String(req.params.id)],
  })
  if (!found.rows[0]) {
    res.status(404).json({ error: 'Template não encontrado.' })
    return
  }
  const parsed = templateSchema.safeParse(JSON.parse(String(found.rows[0].draft)))
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados do template inválidos.' })
    return
  }
  const errors = validatePublish(parsed.data)
  if (errors.length) {
    res.status(400).json({ error: errors.join(' ') })
    return
  }
  const tx = await db.transaction('write')
  try {
    await tx.execute({
      sql: 'UPDATE templates SET published=?, updated_at=? WHERE id=?',
      args: [JSON.stringify(parsed.data), new Date().toISOString(), String(req.params.id)],
    })
    await tx.execute({
      sql: "INSERT INTO settings (key,value) VALUES ('published_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      args: [String(req.params.id)],
    })
    await tx.commit()
  } catch (error) {
    await tx.rollback()
    throw error
  }
  res.json({ ok: true })
})

app.post('/api/assets', requireAuth, async (req, res) => {
  const { filename, data } = req.body || {}
  if (
    typeof filename !== 'string' ||
    typeof data !== 'string' ||
    !/^data:image\/(svg\+xml|png|jpeg);base64,/.test(data)
  ) {
    res.status(400).json({ error: 'Envie SVG, PNG ou JPEG.' })
    return
  }
  const bytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64')
  if (bytes.length > 2_000_000) {
    res.status(413).json({ error: 'A imagem deve ter até 2 MB.' })
    return
  }
  if (data.startsWith('data:image/svg+xml')) {
    const svg = bytes.toString('utf8')
    if (
      !/<svg[\s>]/i.test(svg) ||
      /<script|<foreignObject|<iframe|<image|<use|on\w+\s*=|href\s*=|url\s*\(|<!DOCTYPE|<!ENTITY/i.test(
        svg,
      )
    ) {
      res.status(400).json({ error: 'SVG contém elementos não permitidos.' })
      return
    }
  }
  try {
    const optimized = await sharp(bytes, { limitInputPixels: 20_000_000 })
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    const id = randomUUID()
    await db.execute({
      sql: 'INSERT INTO assets VALUES (?, ?, ?, ?)',
      args: [id, 'image/webp', optimized, new Date().toISOString()],
    })
    res.status(201).json({ url: `/api/assets/${id}`, filename })
  } catch {
    res.status(400).json({ error: 'Arquivo de imagem inválido.' })
  }
})
app.get('/api/assets/:id', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT mime, data FROM assets WHERE id=?',
    args: [String(req.params.id)],
  })
  if (!result.rows[0]) {
    res.status(404).end()
    return
  }
  res.setHeader('Content-Type', String(result.rows[0].mime))
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.send(Buffer.from(result.rows[0].data as ArrayBuffer))
})

app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error)
    res.status(500).json({ error: 'Erro interno. Tente novamente.' })
  },
)
