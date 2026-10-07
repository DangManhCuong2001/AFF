import fs from 'fs'
import path from 'path'

/**
 * Resolves the absolute path to the ffmpeg binary, fixing Next.js Turbopack /ROOT/ virtual path issues
 */
export function getFfmpegBinaryPath(): string {
  // 1. Try require('ffmpeg-static') and unwrap Next.js /ROOT/ prefix
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let staticPath = require('ffmpeg-static')
    if (typeof staticPath === 'string') {
      if (staticPath.startsWith('/ROOT/')) {
        staticPath = path.join(/*turbopackIgnore: true*/ process.cwd(), staticPath.replace(/^\/ROOT\//, ''))
      }
      if (fs.existsSync(/*turbopackIgnore: true*/ staticPath)) {
        return staticPath
      }
    }
  } catch (err) {
    console.warn('[ffmpeg] require ffmpeg-static failed:', err)
  }

  // 2. Direct filesystem candidates in node_modules
  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'node_modules/.pnpm/ffmpeg-static@5.3.0_supports-color@7.2.0/node_modules/ffmpeg-static/ffmpeg'),
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'node_modules/ffmpeg-static/ffmpeg'),
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      return candidate
    }
  }

  // 3. Fallback to system ffmpeg command
  return 'ffmpeg'
}
