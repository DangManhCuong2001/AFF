import {spawn} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const appPort = process.env.AFF_LOCAL_APP_PORT || '3000'
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const bridge = path.join(root, 'tools', 'google-vids-bridge', 'server.mjs')
const children = new Set()
let stopping = false

// Next.js loads .env.local itself. The standalone bridge only needs this
// non-secret origin allowlist so the production page can call localhost.
const envPath = path.join(root, '.env.local')
if (!process.env.AFF_PRODUCTION_ORIGINS && existsSync(envPath)) {
  const match = readFileSync(envPath, 'utf8').match(/^AFF_PRODUCTION_ORIGINS\s*=\s*(.+)$/m)
  if (match) process.env.AFF_PRODUCTION_ORIGINS = match[1].trim().replace(/^(['"])(.*)\1$/, '$2')
}

function start(label, args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  children.add(child)
  child.once('exit', (code, signal) => {
    children.delete(child)
    if (stopping) return
    stopping = true
    console.error(`\n[video:local] ${label} đã dừng (${signal || code || 0}). Đang dừng phần còn lại...`)
    for (const running of children) running.kill('SIGTERM')
    process.exitCode = code || 1
  })
  child.once('error', error => {
    if (!stopping) console.error(`[video:local] Không khởi động được ${label}:`, error.message)
  })
  return child
}

function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill(signal)
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL')
  }, 5_000).unref()
}

process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))

console.log('\nAFF local video stack')
console.log(`- Video Studio: http://127.0.0.1:${appPort}/create`)
console.log('- Google Vids bridge: http://127.0.0.1:4317')
console.log('- Giữ cửa sổ này, tab Google Vids và extension 0.3.0 mở trong lúc tạo video.')
console.log('- Nhấn Ctrl+C để dừng cả app và bridge.\n')

start('Google Vids bridge', [bridge])
start('Next.js app', [nextBin, 'dev', '--hostname', '127.0.0.1', '--port', appPort])
