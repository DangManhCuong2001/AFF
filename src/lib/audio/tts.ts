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

  // 0. Ultra-realistic Human Speech Engine: ElevenLabs (if configured)
  const elevenKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (elevenKey) {
    try {
      const fallbackVoice = voice.includes('NamMinh') ? 'JBFqnCBsd6RMkjVDRZzb' : 'cgSgspJ2msm6clMCkdW9'
      const voiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim() || fallbackVoice
      let res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        if (errText.includes('cannot use library voices') || res.status === 402) {
          res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${fallbackVoice}`, {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: cleanText,
              model_id: 'eleven_flash_v2_5',
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          })
        }
      }

      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length > 500) return buf
      }
    } catch (elevenErr) {
      console.warn('[TTS] ElevenLabs primary attempt failed:', elevenErr)
    }
  }

  // 1. Primary Engine: Pure Node.js EdgeTTS (runs everywhere including Vercel serverless without Python)
  try {
    const tempFile = path.join(
      os.tmpdir(),
      `edge_tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
    )
    const tts = new EdgeTTS({ voice, lang: 'vi-VN', rate, timeout: 25000 })
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
    const ttsRetry = new EdgeTTS({ voice, lang: 'vi-VN', rate: '+0%', timeout: 25000 })
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

  // 4. Resilient Fallback: Google Translate Vietnamese TTS (Guaranteed to work in cloud environments)
  try {
    return await fetchGoogleTTSFallback(cleanText)
  } catch (err) {
    console.error('[TTS] Fallback Google TTS failed:', err)
    throw new Error(`Không thể khởi tạo giọng đọc cho nội dung này. Vui lòng thử lại.`)
  }
}

async function fetchGoogleTTSFallback(text: string): Promise<Buffer> {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 150) {
      if (cur) chunks.push(cur.trim())
      cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
  }
  if (cur) chunks.push(cur.trim())

  const buffers: Buffer[] = []
  for (const chunk of chunks) {
    if (!chunk) continue
    const encoded = encodeURIComponent(chunk)
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`

    const buf = await new Promise<Buffer>((resolve, reject) => {
      https
        .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Fallback TTS service returned HTTP ${res.statusCode}`))
            return
          }

          const data: Buffer[] = []
          res.on('data', (d) => data.push(Buffer.from(d)))
          res.on('end', () => resolve(Buffer.concat(data)))
        })
        .on('error', (err) => reject(err))
    })
    if (buf.length > 50) {
      buffers.push(buf)
    }
  }

  if (buffers.length === 0) {
    throw new Error('Google TTS produced empty buffer')
  }

  return Buffer.concat(buffers)
}
