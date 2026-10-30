import {normalizeVietnameseNumbers} from './speech-normalization'
export {normalizeVietnameseNumbers} from './speech-normalization'
import https from 'https'
import { parseVoiceProvider, VoiceProvider } from './provider'
import {splitTTSText} from './text-chunks'
import {joinVoiceChunks} from './voice-processing'
import {generateVibiTTS} from './vibi'

export type VietnameseVoice = 'vi-VN-HoaiMyNeural' | 'vi-VN-NamMinhNeural'

export interface TTSOptions {
  provider?: VoiceProvider
  voice?: VietnameseVoice
  rate?: string // e.g. "+10%" or "+12%"
  allowRobotFallback?: boolean
}

/**
 * Sanitizes Vietnamese text before speech synthesis.
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
  t = t.replace(/\s+/g, ' ').trim()
  if (t && !/[.!?]$/.test(t)) {
    t += '.'
  }
  return t
}

/**
 * Generates natural Vietnamese neural speech audio buffer (MP3) from text.
 * Uses the explicitly selected provider; defaults to Google for testing.
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
  const provider = parseVoiceProvider(options?.provider)
  if (provider === 'google') return fetchGoogleTTSFallback(cleanText)
  if (provider === 'vibi') return generateVibiTTS(cleanText)

  // 0. Ultra-realistic Human Speech Engine: ElevenLabs (if configured)
  const elevenKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!elevenKey) throw new Error('Chưa cấu hình ELEVENLABS_API_KEY')
  if (elevenKey) {
    try {
      const fallbackVoice = voice.includes('NamMinh') ? 'JBFqnCBsd6RMkjVDRZzb' : 'cgSgspJ2msm6clMCkdW9'
      const configuredVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim()
      const voiceId = configuredVoiceId || fallbackVoice
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
        if (!configuredVoiceId && (errText.includes('cannot use library voices') || res.status === 402)) {
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

  throw new Error('Không thể tạo giọng ElevenLabs. Vui lòng thử lại hoặc chọn Google.')
}

async function fetchGoogleTTSFallback(text: string): Promise<Buffer> {
  const chunks = splitTTSText(text)

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
    if (buf.length <= 50) throw new Error('Google chưa trả đủ một đoạn lời đọc. Vui lòng thử lại.')
    buffers.push(buf)
  }

  if (buffers.length === 0) {
    throw new Error('Google TTS produced empty buffer')
  }

  return joinVoiceChunks(buffers)
}
