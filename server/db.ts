import 'dotenv/config'
import { createClient } from '@libsql/client'
import { mkdirSync } from 'node:fs'

const url = process.env.TURSO_DATABASE_URL || (process.env.VERCEL ? '' : 'file:./data/cardapio.db')
if (!url) throw new Error('Configure TURSO_DATABASE_URL para usar o editor na Vercel.')
if (url.startsWith('file:')) mkdirSync('data', { recursive: true })
export const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })

let ready: Promise<void> | undefined
export function initDb() {
  ready ??= (async () => {
    await db.batch(
      [
        `CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, draft TEXT NOT NULL,
        published TEXT, updated_at TEXT NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS login_attempts (
        client_key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL,
        locked_until INTEGER NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS project_docs (
        template_id TEXT PRIMARY KEY, content TEXT NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS project_captures (
        id TEXT PRIMARY KEY, template_id TEXT NOT NULL, title TEXT NOT NULL,
        description TEXT NOT NULL, screen TEXT NOT NULL, device TEXT NOT NULL,
        mode TEXT NOT NULL, state TEXT NOT NULL, mime TEXT NOT NULL,
        data BLOB NOT NULL, created_at TEXT NOT NULL, position INTEGER NOT NULL
      )`,
        `CREATE TABLE IF NOT EXISTS asset_owners (
        asset_id TEXT NOT NULL, template_id TEXT NOT NULL,
        PRIMARY KEY (asset_id, template_id)
      )`,
      ],
      'write',
    )
  })().catch((error) => {
    ready = undefined
    throw error
  })
  return ready
}
