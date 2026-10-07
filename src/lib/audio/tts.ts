import { execFile } from 'child_process'
import fs from 'fs'
import https from 'https'
import os from 'os'
import path from 'path'

export type VietnameseVoice = 'vi-VN-HoaiMyNeural' | 'vi-VN-NamMinhNeural'

export interface TTSOptions {
  voice?: VietnameseVoice
  rate?: string // e.g. "+12%" or "+15%"
}

/**
 * Generates natural Vietnamese neural speech audio buffer (MP3) from text.
 * Uses Microsoft Edge Neural TTS (HoaiMy / NamMinh) via dedicated helper.
 * Falls back gracefully to Google TTS if edge_tts is unavailable.
 */
export async function generateVietnameseTTS(
  text: string,
  options?: TTSOptions
): Promise<Buffer> {
  const cleanText = text.trim()
  if (!cleanText) {
    throw new Error('Text is required for TTS generation')
  }

  const voice: VietnameseVoice = options?.voice || 'vi-VN-HoaiMyNeural'
  const rate = options?.rate || '+12%'
  const helperScript = path.join(process.cwd(), 'src', 'lib', 'audio', 'tts_helper.py')

  // 1. Try High-Quality Microsoft Edge Neural Voice via python3 tts_helper.py
  if (fs.existsSync(helperScript)) {
    try {
      const tempFile = path.join(
        os.tmpdir(),
        `edge_tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
      )

      await new Promise<void>((resolve, reject) => {
        execFile(
          'python3',
          [helperScript, cleanText, voice, tempFile, rate],
          {
            timeout: 15000,
            env: {
              ...process.env,
              PYTHONIOENCODING: 'utf-8',
              LANG: 'en_US.UTF-8',
              LC_ALL: 'en_US.UTF-8',
            },
          },
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(stderr || error.message))
            } else {
              resolve()
            }
          }
        )
      })

      if (fs.existsSync(tempFile)) {
        const buffer = fs.readFileSync(tempFile)
        try {
          fs.unlinkSync(tempFile)
        } catch {}
        if (buffer.length > 500) {
          return buffer
        }
      }
    } catch (edgeError) {
      console.warn('[TTS] Edge Neural TTS error, falling back to Google TTS:', edgeError)
    }
  }

  // 2. Fallback to Google TTS if Edge TTS fails
  return fetchGoogleTTSFallback(cleanText.slice(0, 200))
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
