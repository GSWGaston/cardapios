import { randomBytes, scryptSync } from 'node:crypto'
import readline from 'node:readline'

if (!process.stdin.isTTY) {
  console.error('Execute em um terminal interativo.')
  process.exit(1)
}
const input = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
})
input.stdoutMuted = true
input._writeToOutput = function (chunk) {
  if (!this.stdoutMuted || chunk.includes('\n')) this.output.write(chunk)
}
process.stdout.write('Nova senha administrativa: ')
input.question('', (password) => {
  input.close()
  if (password.length < 12) {
    console.error('Use pelo menos 12 caracteres.')
    process.exitCode = 1
    return
  }
  const salt = randomBytes(24).toString('hex')
  console.log(
    `ADMIN_PASSWORD_HASH=scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
  )
})
