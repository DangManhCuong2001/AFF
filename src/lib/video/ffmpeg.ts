import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Resolves the absolute path to the ffmpeg binary, fixing Next.js Turbopack /ROOT/ virtual path issues
 * and ensuring execute permissions on serverless environments (Linux / Vercel Lambda).
 */
export function getFfmpegBinaryPath(): string {
  // If we already cached a working executable in /tmp/ffmpeg, use it
  const tmpBinary = path.join(os.tmpdir(), 'ffmpeg')
  if (fs.existsSync(tmpBinary)) {
    try {
      fs.accessSync(tmpBinary, fs.constants.X_OK)
      return tmpBinary
    } catch {
      // not executable yet, re-copy below
    }
  }

  let sourcePath = ''

  // 1. Try require('ffmpeg-static') and unwrap Next.js /ROOT/ prefix
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let staticPath = require('ffmpeg-static')
    if (typeof staticPath === 'string') {
      if (staticPath.startsWith('/ROOT/')) {
        staticPath = path.join(/*turbopackIgnore: true*/ process.cwd(), staticPath.replace(/^\/ROOT\//, ''))
      }
      if (fs.existsSync(/*turbopackIgnore: true*/ staticPath)) {
        sourcePath = staticPath
      }
    }
  } catch (err) {
    console.warn('[ffmpeg] require ffmpeg-static failed:', err)
  }

  // 2. Direct filesystem candidates in node_modules
  if (!sourcePath) {
    const candidates = [
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'node_modules/.pnpm/ffmpeg-static@5.3.0_supports-color@7.2.0/node_modules/ffmpeg-static/ffmpeg'),
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'node_modules/ffmpeg-static/ffmpeg'),
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
    ]

    for (const candidate of candidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
        sourcePath = candidate
        break
      }
    }
  }

  // 3. On serverless Linux (AWS Lambda / Vercel), copy to /tmp/ffmpeg and chmod 0755
  if (sourcePath && fs.existsSync(/*turbopackIgnore: true*/ sourcePath)) {
    if (process.platform === 'linux') {
      try {
        if (!fs.existsSync(tmpBinary)) {
          fs.copyFileSync(sourcePath, tmpBinary)
        }
        fs.chmodSync(tmpBinary, 0o755)
        return tmpBinary
      } catch (copyErr) {
        console.warn('[ffmpeg] failed to prepare /tmp/ffmpeg:', copyErr)
      }
    }
    return sourcePath
  }

  // 4. Fallback to system ffmpeg command
  return 'ffmpeg'
}

