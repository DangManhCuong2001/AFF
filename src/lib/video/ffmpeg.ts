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

  if (process.env.FFMPEG_BIN && fs.existsSync(process.env.FFMPEG_BIN)) {
    return process.env.FFMPEG_BIN
  }

  let sourcePath = ''

  // 1. Try require.resolve('ffmpeg-static')
  try {
    const pkgPath = require.resolve('ffmpeg-static')
    const dir = path.dirname(pkgPath)
    const binCandidate = path.join(dir, 'ffmpeg' + (process.platform === 'win32' ? '.exe' : ''))
    if (fs.existsSync(binCandidate)) {
      sourcePath = binCandidate
    }
  } catch {
    // continue
  }

  // 2. Try require('ffmpeg-static') and unwrap Next.js /ROOT/ prefix
  if (!sourcePath) {
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
    } catch {
      // continue
    }
  }

  // 3. Search common node_modules locations including pnpm and Vercel Lambda /var/task
  if (!sourcePath) {
    const candidates = [
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
      path.join('/var/task', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg',
    ]

    // Also look inside .pnpm directory
    try {
      const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm')
      if (fs.existsSync(pnpmDir)) {
        const entries = fs.readdirSync(pnpmDir)
        for (const e of entries) {
          if (e.startsWith('ffmpeg-static')) {
            candidates.unshift(path.join(pnpmDir, e, 'node_modules', 'ffmpeg-static', 'ffmpeg'))
          }
        }
      }
    } catch {
      // ignore
    }

    for (const candidate of candidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
        sourcePath = candidate
        break
      }
    }
  }

  // 4. On serverless Linux (AWS Lambda / Vercel), copy to /tmp/ffmpeg and chmod 0755
  if (sourcePath && fs.existsSync(/*turbopackIgnore: true*/ sourcePath)) {
    if (process.platform === 'linux') {
      try {
        if (!fs.existsSync(tmpBinary)) {
          fs.copyFileSync(sourcePath, tmpBinary)
        }
        fs.chmodSync(tmpBinary, 0o755)
        fs.accessSync(tmpBinary, fs.constants.X_OK)
        process.env.FFMPEG_BIN = tmpBinary
        return tmpBinary
      } catch (copyErr) {
        console.warn('[ffmpeg] failed to prepare /tmp/ffmpeg:', copyErr)
      }
    }
    return sourcePath
  }

  // 5. Fallback to system ffmpeg command
  return 'ffmpeg'
}

