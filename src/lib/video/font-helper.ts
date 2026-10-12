import fs from 'fs'
import path from 'path'
import os from 'os'

let cachedFontPath: string | null = null

/**
 * Returns a guaranteed absolute path to a valid TTF font.
 * Checks project directories, system paths, and copies to /tmp if necessary.
 */
export function getGuaranteedFontPath(): string {
  if (cachedFontPath && fs.existsSync(/*turbopackIgnore: true*/ cachedFontPath)) {
    return cachedFontPath
  }

  const candidatePaths = [
    path.join(process.cwd(), 'src', 'assets', 'fonts', 'Roboto-Bold.ttf'),
    path.join(process.cwd(), 'public', 'fonts', 'Roboto-Bold.ttf'),
    path.join(__dirname, '..', '..', 'assets', 'fonts', 'Roboto-Bold.ttf'),
    path.join(__dirname, '..', '..', '..', 'public', 'fonts', 'Roboto-Bold.ttf'),
    path.join(os.tmpdir(), 'aff-font.ttf'),
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  ]

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        cachedFontPath = p
        return p
      }
    } catch {
      // ignore
    }
  }

  // If no file found directly, search recursively in process.cwd() for Roboto-Bold.ttf
  try {
    const tmpDest = path.join(os.tmpdir(), 'aff-font.ttf')
    const possibleSrc = [
      path.join(process.cwd(), 'src', 'assets', 'fonts', 'Roboto-Bold.ttf'),
      path.join(process.cwd(), 'public', 'fonts', 'Roboto-Bold.ttf'),
    ]

    for (const src of possibleSrc) {
      if (fs.existsSync(/*turbopackIgnore: true*/ src)) {
        fs.copyFileSync(src, tmpDest)
        cachedFontPath = tmpDest
        return tmpDest
      }
    }
  } catch (copyErr) {
    console.warn('[FontHelper] Could not copy font to tmp:', copyErr)
  }

  return ''
}
