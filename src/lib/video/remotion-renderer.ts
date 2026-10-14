import type { VoiceProvider } from '@/lib/audio/provider'
import { applySceneAudioTimings } from '@/lib/video/scene-timing'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { StoryboardScene } from '@/engines/core/types'
import { VipeeSpeechDirector, VipeeTTSProvider } from '@/engines/speech/VipeeSpeechDirector'

const execFilePromise = promisify(execFile)

export interface RenderRemotionOptions {
  productName: string
  price?: number
  category?: string
  scenes: StoryboardScene[]
  imageBuffers?: Buffer[]
  imageUrls?: string[]
  masterAudioBuffer?: Buffer
  voiceProvider?: VoiceProvider
  voicePreset?: 'Natural Friend' | 'Warm Reviewer' | 'Curious Tester' | 'Energetic Seller' | 'Calm Explainer'
}

export interface RenderRemotionResult {
  filePath: string
  fileName: string
  duration: number
  fileSizeBytes: number
}

async function toBase64Image(input: Buffer | string): Promise<string> {
  if (Buffer.isBuffer(input)) {
    return `data:image/png;base64,${input.toString('base64')}`
  }

  if (typeof input === 'string') {
    if (input.startsWith('data:')) return input

    if (input.startsWith('http://') || input.startsWith('https://')) {
      try {
        const res = await fetch(input, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        })
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          const contentType = res.headers.get('content-type') || 'image/jpeg'
          return `data:${contentType};base64,${buf.toString('base64')}`
        }
      } catch (e) {
        console.warn('[RemotionRenderer] Failed to fetch remote image:', input, e)
      }
    }

    const cleanPath = input.startsWith('/') ? input.slice(1) : input
    const fullPath = path.join(process.cwd(), 'public', cleanPath)
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(fullPath).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
      const buf = fs.readFileSync(fullPath)
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  }

  const fallbackPath = path.join(process.cwd(), 'public', 'backgrounds', 'minimal_lifestyle.png')
  if (fs.existsSync(fallbackPath)) {
    return `data:image/png;base64,${fs.readFileSync(fallbackPath).toString('base64')}`
  }

  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
}

export async function renderWithRemotion(
  opts: RenderRemotionOptions
): Promise<RenderRemotionResult> {
  const tempDir = path.join(os.tmpdir(), 'aff-remotion-' + Date.now())
  fs.mkdirSync(tempDir, { recursive: true })

  // 1. Prepare base64 images
  const base64Images: string[] = []
  if (opts.imageBuffers && opts.imageBuffers.length > 0) {
    for (const b of opts.imageBuffers) {
      base64Images.push(await toBase64Image(b))
    }
  } else if (opts.imageUrls && opts.imageUrls.length > 0) {
    for (const u of opts.imageUrls) {
      base64Images.push(await toBase64Image(u))
    }
  }

  if (base64Images.length === 0) {
    base64Images.push(await toBase64Image('/backgrounds/minimal_lifestyle.png'))
  }

  // 2. Prepare master audio
  let renderedScenes = opts.scenes
  let masterAudioBase64 = ''
  if (opts.masterAudioBuffer && opts.masterAudioBuffer.length > 0) {
    masterAudioBase64 = `data:audio/mp3;base64,${opts.masterAudioBuffer.toString('base64')}`
  } else {
    try {
      const speechDirector = new VipeeSpeechDirector()
      const speechPlan = speechDirector.createSpeechPlan(
        {
          scenes: opts.scenes.map((s) => ({
            id: s.id,
            voice: s.voice || s.headline,
            storyBeat: s.type || 'demo',
            emphasisWords: s.keywords,
          })),
        },
        {
          voicePreset: opts.voicePreset || 'Natural Friend',
        }
      )
      const ttsProvider = new VipeeTTSProvider()
      const speechAudioResult = await ttsProvider.generateSpeech(speechPlan, { provider: opts.voiceProvider })
      masterAudioBase64 = `data:audio/mp3;base64,${speechAudioResult.audioBuffer.toString('base64')}`
      renderedScenes = applySceneAudioTimings(opts.scenes, speechAudioResult.segmentTimings)
    } catch (ttsErr) {
      console.warn('[RemotionRenderer] Speech synthesis warning:', ttsErr)
    }
  }

  // 3. Prepare background music
  let bgmAudioBase64 = ''
  const bgmPath = path.join(process.cwd(), 'public', 'music', 'lofi-beat.mp3')
  if (fs.existsSync(bgmPath)) {
    bgmAudioBase64 = `data:audio/mp3;base64,${fs.readFileSync(bgmPath).toString('base64')}`
  }

  const fileName = `remotion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`
  const outPath = path.join(tempDir, fileName)

  const payload = {
    productName: opts.productName,
    price: opts.price,
    category: opts.category,
    scenes: renderedScenes,
    images: base64Images,
    masterAudioBase64,
    bgmAudioBase64,
    outPath,
  }

  const payloadPath = path.join(tempDir, 'remotion_payload.json')
  fs.writeFileSync(payloadPath, JSON.stringify(payload))

  const cliScriptPath = path.resolve(process.cwd(), 'scripts', 'render-remotion-worker.cjs')

  // Use installed TypeScript in an isolated worker; no npx dependency download.
  const { stdout } = await execFilePromise(
    process.execPath,
    [cliScriptPath, payloadPath],
    {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024,
    }
  )

  // Parse result from stdout
  const lines = stdout.trim().split('\n')
  let resultJson: any = null

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i])
      if (parsed.success) {
        resultJson = parsed
        break
      }
    } catch {
      // ignore non-JSON log line
    }
  }

  if (!resultJson || !resultJson.filePath || !fs.existsSync(resultJson.filePath)) {
    throw new Error('Remotion worker finished without valid MP4 output')
  }

  return {
    filePath: resultJson.filePath,
    fileName: path.basename(resultJson.filePath),
    duration: resultJson.duration || 15,
    fileSizeBytes: resultJson.fileSizeBytes || fs.statSync(resultJson.filePath).size,
  }
}
