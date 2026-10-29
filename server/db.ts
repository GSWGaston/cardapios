import 'dotenv/config'
import { createClient } from '@libsql/client'
import { mkdirSync } from 'node:fs'
import { demoTemplate } from '../src/data/template'

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
      ],
      'write',
    )
    const result = await db.execute('SELECT COUNT(*) AS total FROM templates')
    if (Number(result.rows[0]?.total) === 0) {
      const id = 'demo'
      const json = JSON.stringify(demoTemplate())
      const tx = await db.transaction('write')
      try {
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO templates VALUES (?, ?, ?, ?, ?)',
          args: [id, 'Cardápio demonstrativo', json, json, new Date().toISOString()],
        })
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO settings VALUES (?, ?)',
          args: ['published_id', id],
        })
        await tx.commit()
      } catch (error) {
        await tx.rollback()
        throw error
      }
    }
  })().catch((error) => {
    ready = undefined
    throw error
  })
  return ready
}
