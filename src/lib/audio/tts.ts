import { execFile } from 'child_process'
import fs from 'fs'
import https from 'https'
import os from 'os'
import path from 'path'

export type VietnameseVoice = 'vi-VN-HoaiMyNeural' | 'vi-VN-NamMinhNeural'

export interface TTSOptions {
  voice?: VietnameseVoice
  rate?: string // e.g. "+10%" or "+12%"
  allowRobotFallback?: boolean
}

/**
 * Generates natural Vietnamese neural speech audio buffer (MP3) from text.
 * Uses Microsoft Edge Neural TTS (HoaiMy / NamMinh) via multi-tier robust helper.
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
  const rate = options?.rate || '+10%'
  const helperScript = path.join(process.cwd(), 'src', 'lib', 'audio', 'tts_helper.py')

  // 1. High-Quality Microsoft Edge Neural Voice via multi-tier python3 tts_helper.py
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
            timeout: 45000,
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
        if (buffer.length > 300) {
          return buffer
        }
      }
    } catch (edgeError) {
      console.warn('[TTS] Edge Neural TTS primary attempt failed:', edgeError)
      // Retry once more with safe default parameters (+0% rate)
      try {
        const tempFile2 = path.join(
          os.tmpdir(),
          `edge_tts_retry_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
        )
        await new Promise<void>((resolve, reject) => {
          execFile(
            'python3',
            [helperScript, cleanText, voice, tempFile2, '+0%'],
            {
              timeout: 30000,
              env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                LANG: 'en_US.UTF-8',
                LC_ALL: 'en_US.UTF-8',
              },
            },
            (error, stdout, stderr) => {
              if (error) reject(new Error(stderr || error.message))
              else resolve()
            }
          )
        })
        if (fs.existsSync(tempFile2)) {
          const buffer = fs.readFileSync(tempFile2)
          try {
            fs.unlinkSync(tempFile2)
          } catch {}
          if (buffer.length > 300) {
            return buffer
          }
        }
      } catch (retryError) {
        console.warn('[TTS] Edge Neural TTS retry failed:', retryError)
      }
    }
  }

  // 2. Only fallback to Google TTS if caller explicitly allows robot voice
  if (options?.allowRobotFallback) {
    return fetchGoogleTTSFallback(cleanText.slice(0, 200))
  }

  // If robot fallback is not allowed, throw error to maintain voice integrity
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
