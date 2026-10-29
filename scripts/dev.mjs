import { spawn } from 'node:child_process'

const processes = [
  spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/local.ts'], {
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
]
for (const child of processes)
  child.on('exit', (code) => {
    if (code && !process.exitCode) process.exitCode = code
    processes.forEach((item) => {
      if (!item.killed) item.kill()
    })
  })
process.on('SIGINT', () => processes.forEach((item) => item.kill('SIGINT')))
