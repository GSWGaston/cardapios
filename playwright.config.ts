import { defineConfig } from '@playwright/test'
import { randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@libsql/client'
import { demoTemplate } from './src/data/template'

mkdirSync('data', { recursive: true })
const passwordFile = resolve('data/editor-test-password')
if (!existsSync(passwordFile))
  writeFileSync(passwordFile, randomBytes(18).toString('base64url'), { flag: 'wx' })
const testPassword = readFileSync(passwordFile, 'utf8')
const salt = randomBytes(24).toString('hex')
process.env.EDITOR_TEST_PASSWORD = testPassword
const passwordHash = `scrypt:${salt}:${scryptSync(testPassword, salt, 64).toString('hex')}`
const testDb = createClient({ url: 'file:./data/test-cardapio-v2.db' })
await testDb.batch(
  [
    'CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, draft TEXT NOT NULL, published TEXT, updated_at TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  ],
  'write',
)
const existing = await testDb.execute("SELECT value FROM settings WHERE key='published_id'")
if (!existing.rows[0]) {
  const json = JSON.stringify(demoTemplate())
  await testDb.execute({
    sql: 'INSERT OR IGNORE INTO templates VALUES (?,?,?,?,?)',
    args: ['demo', 'Cardápio demonstrativo', json, json, new Date().toISOString()],
  })
  await testDb.execute({
    sql: "INSERT INTO settings (key,value) VALUES ('published_id',?)",
    args: ['demo'],
  })
}
testDb.close()

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    launchOptions: process.platform === 'win32' ? { channel: 'msedge' } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node node_modules/tsx/dist/cli.mjs server/local.ts',
      url: 'http://127.0.0.1:3001/api/auth/session',
      env: {
        ADMIN_PASSWORD_HASH: passwordHash,
        TURSO_DATABASE_URL: 'file:./data/test-cardapio-v2.db',
      },
      reuseExistingServer: false,
    },
    {
      command:
        'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
