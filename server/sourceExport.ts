import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const sourceDirs = ['api', 'server', 'src', 'scripts']
const rootFiles = [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'playwright.config.ts',
  'vercel.json',
  'index.html',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'tsconfig.server.json',
]
const allowed = /\.(?:ts|tsx|css|mjs)$/i

export function sourceExportAvailable() {
  return (
    !process.env.VERCEL &&
    existsSync(join(root, 'src', 'App.tsx')) &&
    existsSync(join(root, 'package.json'))
  )
}

export async function sourceExportFiles() {
  if (!sourceExportAvailable()) throw new Error('Código-fonte indisponível neste servidor.')
  const files: Record<string, Uint8Array> = {}
  let total = 0
  const add = async (relative: string) => {
    const data = await readFile(join(root, ...relative.split('/')))
    total += data.length
    if (data.length > 512_000 || total > 5_000_000)
      throw new Error('O código-fonte ultrapassa o limite seguro de exportação.')
    files[`codigo-fonte/${relative}`] = new Uint8Array(data)
  }
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (depth > 10) return
    for (const item of await readdir(join(root, ...directory.split('/')), {
      withFileTypes: true,
    })) {
      if (item.name.startsWith('.')) continue
      const relative = `${directory}/${item.name}`
      if (item.isDirectory()) await walk(relative, depth + 1)
      else if (item.isFile() && allowed.test(item.name)) await add(relative)
    }
  }
  for (const directory of sourceDirs)
    if (existsSync(join(root, directory))) await walk(directory, 0)
  for (const file of rootFiles) if (existsSync(join(root, file))) await add(file)
  return files
}
