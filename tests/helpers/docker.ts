import { execSync } from 'node:child_process'

export function dockerComposeUp(cwd: string): void {
  console.log(`  [docker] starting containers in ${cwd}...`)
  execSync('docker compose up -d --wait', { cwd, stdio: 'inherit', timeout: 120_000 })
  console.log('  [docker] containers ready')
}

export function dockerComposeDown(cwd: string): void {
  console.log(`  [docker] stopping containers in ${cwd}...`)
  try {
    execSync('docker compose down -v', { cwd, stdio: 'inherit', timeout: 60_000 })
  } catch {
    console.warn('  [docker] failed to stop containers (may already be stopped)')
  }
}
