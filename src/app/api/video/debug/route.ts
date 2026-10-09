import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function GET() {
  const info: Record<string, unknown> = {}

  // Environment
  info.platform = process.platform
  info.arch = process.arch
  info.node = process.version
  info.isVercel = Boolean(process.env.VERCEL)
  info.isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
  info.cwd = process.cwd()
  info.tmpDir = os.tmpdir()
  info.FFMPEG_BIN = process.env.FFMPEG_BIN || null

  // Check ffmpeg-static package
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require('ffmpeg-static')
    info.ffmpegStatic = staticPath
    info.ffmpegStaticExists = staticPath ? fs.existsSync(staticPath) : false
  } catch (e) {
    info.ffmpegStatic = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  // Try require.resolve
  try {
    const resolved = require.resolve('ffmpeg-static')
    info.ffmpegStaticResolved = resolved
    const dir = path.dirname(resolved)
    const bin = path.join(dir, 'ffmpeg')
    info.ffmpegBinFromResolve = bin
    info.ffmpegBinFromResolveExists = fs.existsSync(bin)
  } catch (e) {
    info.ffmpegResolveError = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  // Check node_modules/ffmpeg-static
  const nmPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg')
  info.nodeModulesPath = nmPath
  info.nodeModulesExists = fs.existsSync(nmPath)

  // Check /var/task
  const varTaskPath = path.join('/var/task', 'node_modules', 'ffmpeg-static', 'ffmpeg')
  info.varTaskPath = varTaskPath
  info.varTaskExists = fs.existsSync(varTaskPath)

  // Check /tmp/ffmpeg
  const tmpBin = path.join(os.tmpdir(), 'ffmpeg')
  info.tmpBinPath = tmpBin
  info.tmpBinExists = fs.existsSync(tmpBin)
  if (fs.existsSync(tmpBin)) {
    try {
      fs.accessSync(tmpBin, fs.constants.X_OK)
      info.tmpBinExecutable = true
    } catch {
      info.tmpBinExecutable = false
    }
  }

  // Check which directories exist
  const dirsToCheck = [
    path.join(process.cwd(), 'node_modules'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static'),
    path.join(process.cwd(), 'node_modules', '.pnpm'),
    '/var/task',
    '/var/task/node_modules',
    '/opt',
    '/usr/bin',
    '/usr/local/bin',
  ]
  info.directories = dirsToCheck.reduce<Record<string, boolean>>((acc, d) => {
    acc[d] = fs.existsSync(d)
    return acc
  }, {})

  // Try listing node_modules if it exists
  try {
    const nm = path.join(process.cwd(), 'node_modules')
    if (fs.existsSync(nm)) {
      const entries = fs.readdirSync(nm).slice(0, 20)
      info.nodeModulesSample = entries
    }
  } catch (e) {
    info.nodeModulesListError = String(e)
  }

  // Try running ffmpeg to see what happens
  try {
    const output = execSync('which ffmpeg 2>&1 || echo not_found', { timeout: 3000 }).toString().trim()
    info.whichFfmpeg = output
  } catch (e) {
    info.whichFfmpegError = String(e)
  }

  try {
    const output = execSync('ffmpeg -version 2>&1 | head -1', { timeout: 3000 }).toString().trim()
    info.ffmpegVersion = output
  } catch (e) {
    info.ffmpegVersionError = String(e)
  }

  return NextResponse.json(info, { status: 200 })
}
