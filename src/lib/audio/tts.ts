import { execFile } from 'child_process'
import fs from 'fs'
import https from 'https'
import os from 'os'
import path from 'path'
import { EdgeTTS } from 'node-edge-tts'

export type VietnameseVoice = 'vi-VN-HoaiMyNeural' | 'vi-VN-NamMinhNeural'

export interface TTSOptions {
  voice?: VietnameseVoice
  rate?: string // e.g. "+10%" or "+12%"
  allowRobotFallback?: boolean
}

/**
 * Expands numbers, percentages, prices, and fractions into full Vietnamese words.
 */
export function normalizeVietnameseNumbers(text: string): string {
  if (!text) return ''
  let result = text
  // 1. Percentages: 100% -> 100 phần trăm
  result = result.replace(/(\d+)\s*%/g, '$1 phần trăm')
  // 2. Fractions: 10/10 -> 10 trên 10
  result = result.replace(/(\d+)\/(\d+)/g, '$1 trên $2')
  // 3. Currency / prices: 99k, 199k, 50k
  result = result.replace(/(\d+)\s*[kK]\b/g, '$1 nghìn')

  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const teens: Record<number, string> = {
    10: 'mười', 11: 'mười một', 12: 'mười hai', 13: 'mười ba', 14: 'mười bốn',
    15: 'mười lăm', 16: 'mười sáu', 17: 'mười bảy', 18: 'mười tám', 19: 'mười chín',
  }
  const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi']

  function numToWord(n: number): string {
    if (n === 0) return 'không'
    if (n >= 1 && n <= 9) return units[n]
    if (n >= 10 && n <= 19) return teens[n]
    if (n >= 20 && n <= 99) {
      const d = Math.floor(n / 10)
      const u = n % 10
      if (u === 0) return tens[d]
      if (u === 1) return tens[d] + ' mốt'
      if (u === 5) return tens[d] + ' lăm'
      return tens[d] + ' ' + units[u]
    }
    if (n === 100) return 'một trăm'
    return String(n)
  }

  return result.replace(/\b([0-9]{1,2}|100)\b/g, (_m, n) => numToWord(parseInt(n, 10)))
}

/**
 * Sanitizes text to ensure 100% compatibility with Microsoft Edge Neural TTS.
 */
export function sanitizeTextForTTS(raw: string): string {
  if (!raw) return ''
  let t = raw.trim()
  t = normalizeVietnameseNumbers(t)
  t = t.replace(/[\*_~`#]+/g, '')
  t = t.replace(/['"«»“”‘’[\](){}]/g, '')
  t = t.replace(/[<>&]/g, '')
  // Strip emojis
  t = t.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
  t = t.replace(/vị\s+thông\s+minh/gi, 'vị rất thông minh')
  t = t.replace(/\s+/g, ' ').trim()
  if (t && !/[.!?]$/.test(t)) {
    t += '.'
  }
  return t
}

/**
 * Generates natural Vietnamese neural speech audio buffer (MP3) from text.
 * Uses pure Node.js EdgeTTS with zero Python dependency for Vercel serverless compatibility.
 */
export async function generateVietnameseTTS(
  text: string,
  options?: TTSOptions
): Promise<Buffer> {
  const cleanText = sanitizeTextForTTS(text)
  if (!cleanText) {
    throw new Error('Text is required for TTS generation')
  }

  const voice: VietnameseVoice = options?.voice || 'vi-VN-HoaiMyNeural'
  const rate = options?.rate || '+10%'

  // 1. Primary Engine: Pure Node.js EdgeTTS (runs everywhere including Vercel serverless without Python)
  try {
    const tempFile = path.join(
      os.tmpdir(),
      `edge_tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
    )
    const tts = new EdgeTTS({ voice, lang: 'vi-VN', rate })
    await tts.ttsPromise(cleanText, tempFile)

    if (fs.existsSync(tempFile)) {
      const buffer = fs.readFileSync(tempFile)
      try {
        fs.unlinkSync(tempFile)
      } catch {}
      if (buffer.length > 300) {
        return buffer
      }
    }
  } catch (nodeError) {
    console.warn('[TTS] Node EdgeTTS primary attempt failed:', nodeError)
  }

  // 2. Retry with standard rate (+0%)
  try {
    const tempFile = path.join(
      os.tmpdir(),
      `edge_tts_retry_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
    )
    const ttsRetry = new EdgeTTS({ voice, lang: 'vi-VN', rate: '+0%' })
    await ttsRetry.ttsPromise(cleanText, tempFile)

    if (fs.existsSync(tempFile)) {
      const buffer = fs.readFileSync(tempFile)
      try {
        fs.unlinkSync(tempFile)
      } catch {}
      if (buffer.length > 300) {
        return buffer
      }
    }
  } catch (retryError) {
    console.warn('[TTS] Node EdgeTTS retry failed:', retryError)
  }

  // 3. Optional local Python fallback (if running on a machine with python3 installed)
  const helperScript = path.join(process.cwd(), 'src', 'lib', 'audio', 'tts_helper.py')
  if (fs.existsSync(helperScript)) {
    try {
      const tempFile = path.join(
        os.tmpdir(),
        `edge_tts_py_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
      )
      await new Promise<void>((resolve, reject) => {
        execFile(
          'python3',
          [helperScript, cleanText, voice, tempFile, rate],
          { timeout: 30000 },
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })
      if (fs.existsSync(tempFile)) {
        const buffer = fs.readFileSync(tempFile)
        try {
          fs.unlinkSync(tempFile)
        } catch {}
        if (buffer.length > 300) {
          return buffer
        }
      }
    } catch {
      // Python not available (e.g. on Vercel), continue
    }
  }

  // 4. Fallback to Google TTS if allowed
  if (options?.allowRobotFallback) {
    return fetchGoogleTTSFallback(cleanText.slice(0, 200))
  }

  throw new Error(`Không thể khởi tạo giọng đọc neural ${voice}. Vui lòng thử lại.`)
}

function fetchGoogleTTSFallback(text: string): Promise<Buffer> {
  const encoded = encodeURIComponent(text)
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`

  return new Promise<Buffer>((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Fallback TTS service returned HTTP ${res.statusCode}`))
          return
        }

        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', (err) => reject(err))
  })
}
