import { mkdirSync } from 'node:fs'
import { app } from './app'

mkdirSync('data', { recursive: true })
const port = Number(process.env.API_PORT || 3001)
app.listen(port, '127.0.0.1', () => console.log(`API disponível em http://127.0.0.1:${port}`))
