import path from 'path'
import fs from 'fs'
import os from 'os'
import { bundle } from '@remotion/bundler'
import { selectComposition, renderMedia } from '@remotion/renderer'
import { VipeeVisualDirector } from '@/engines/visual/VipeeVisualDirector'
import { VipeeSpeechDirector, VipeeTTSProvider } from '@/engines/speech/VipeeSpeechDirector'
import { StoryboardScene } from '@/engines/core/types'
import { VoicePersonality } from '@/engines/speech/types'
import { RemotionVideoProps } from '@/remotion/types'
import { getFfmpegBinaryPath } from '@/lib/video/ffmpeg'
import { InfographicEngine } from '@/engines/infographic/InfographicEngine'

export interface RenderRemotionParams {
  productName: string
  price?: number
  category?: string
  scenes: StoryboardScene[]
  imageBuffers?: Buffer[]
  imageUrls?: string[]
  voicePreset?: VoicePersonality
  masterAudioBuffer?: Buffer
  fps?: number
  onProgress?: (progress: number) => void
}

export interface RenderRemotionResult {
  filePath: string
  fileName: string
  duration: number
  fileSizeBytes: number
}

// In-memory bundle cache across server requests to speed up subsequent renders
let cachedBundleLocation: string | null = null
let bundlingPromise: Promise<string> | null = null

async function getOrCreateBundle(): Promise<string> {
  if (cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
    return cachedBundleLocation
  }

  if (bundlingPromise) {
    return bundlingPromise
  }

  bundlingPromise = (async () => {
    try {
      const entryPoint = path.join(process.cwd(), 'src', 'remotion', 'index.ts')
      const publicDir = path.join(process.cwd(), 'public')
      console.log('[RemotionRenderer] Bundling Remotion composition from:', entryPoint)
      const bundleLocation = await bundle({
        entryPoint,
        publicDir,
        enableCaching: true,
      })
      cachedBundleLocation = bundleLocation
      console.log('[RemotionRenderer] Bundling complete:', bundleLocation)
      return bundleLocation
    } finally {
      bundlingPromise = null
    }
  })()

  return bundlingPromise
}

function fileToDataUri(filePath: string, mimeType: string): string {
  try {
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath)
      return `data:${mimeType};base64,${buf.toString('base64')}`
    }
  } catch (err) {
    console.warn(`[RemotionRenderer] Failed to convert ${filePath} to data URI:`, err)
  }
  return ''
}

export async function renderRemotionVideo(
  params: RenderRemotionParams
): Promise<RenderRemotionResult> {
  const fps = params.fps || 30
  const outputDir = path.join(os.tmpdir(), 'remotion-renders')
  fs.mkdirSync(outputDir, { recursive: true })

  // 1. Prepare Product Images
  const validImages: string[] = []
  if (params.imageBuffers && params.imageBuffers.length > 0) {
    for (const buf of params.imageBuffers) {
      validImages.push(`data:image/png;base64,${buf.toString('base64')}`)
    }
  } else if (params.imageUrls && params.imageUrls.length > 0) {
    for (const u of params.imageUrls) {
      if (u) validImages.push(u)
    }
  }

  if (validImages.length === 0) {
    // Fallback minimal lifestyle image
    const fallbackPath = path.join(process.cwd(), 'public', 'backgrounds', 'minimal_lifestyle.png')
    const fallbackUri = fileToDataUri(fallbackPath, 'image/png')
    validImages.push(fallbackUri || '/backgrounds/minimal_lifestyle.png')
  }

  // 2. Synthesize Master Speech Audio if not provided
  let masterAudioBuffer = params.masterAudioBuffer
  let speechTimings: Array<{
    segmentId: string
    text: string
    emotion: string
    startSec: number
    endSec: number
    durationSec: number
    emphasis?: string[]
  }> = []

  if (!masterAudioBuffer) {
    try {
      console.log('[RemotionRenderer] Generating Vietnamese voiceover TTS...')
      const speechDirector = new VipeeSpeechDirector()
      const speechPlan = speechDirector.createSpeechPlan(
        {
          scenes: params.scenes.map((s) => ({
            id: s.id,
            voice: s.voice || s.headline,
            storyBeat: s.type || 'demo',
            emphasisWords: s.keywords,
          })),
        },
        {
          voicePreset: params.voicePreset || 'Natural Friend',
        }
      )

      const ttsProvider = new VipeeTTSProvider()
      const speechResult = await ttsProvider.generateSpeech(speechPlan)
      masterAudioBuffer = speechResult.audioBuffer

      let curStart = 0
      speechTimings = params.scenes.map((s, idx) => {
        const segTiming = speechResult.segmentTimings.find((t) => t.segmentId === s.id)
        const dur = segTiming?.durationSec || (s.duration && s.duration > 0 ? s.duration : 3)
        const timing = {
          segmentId: s.id || `scene-${idx + 1}`,
          text: s.voice || s.headline || 'Khám phá sản phẩm chất lượng',
          emotion: s.type || 'demo',
          startSec: curStart,
          endSec: curStart + dur,
          durationSec: dur,
          emphasis: s.keywords,
        }
        curStart += dur
        return timing
      })
    } catch (speechErr) {
      console.warn('[RemotionRenderer] Speech synthesis warning, using fallback timings:', speechErr)
    }
  }

  // Fallback speech timings if TTS failed or custom buffer was passed
  if (speechTimings.length === 0) {
    let cur = 0
    speechTimings = params.scenes.map((s, idx) => {
      const dur = s.duration && s.duration > 0 ? s.duration : 3
      const t = {
        segmentId: s.id || `scene-${idx + 1}`,
        text: s.voice || s.headline || 'Khám phá sản phẩm chất lượng',
        emotion: s.type || 'demo',
        startSec: cur,
        endSec: cur + dur,
        durationSec: dur,
        emphasis: s.keywords,
      }
      cur += dur
      return t
    })
  }

  // 3. Build Visual Storyplan with VipeeVisualDirector (identical to Preview)
  const visualDirector = new VipeeVisualDirector()
  const storyplan = visualDirector.createVisualStoryplan({
    speechTimings,
    productImages: validImages,
    productName: params.productName || 'Sản phẩm thông minh',
    category: params.category || 'home',
  })

  // 4. Generate Commercial Infographic Deck matching Part 1
  const infographicEngine = new InfographicEngine()
  const deck = infographicEngine.generateDeck({
    productName: params.productName || 'Sản phẩm thông minh',
    price: params.price,
    primaryImageUrl: validImages[0] || '',
    secondaryImageUrl: validImages[1],
    galleryImages: validImages,
    scenes: params.scenes,
  })

  // 5. Convert Backgrounds and Product Assets to Base64 to ensure 100% reliable rendering in Chromium
  const beatsWithInlineAssets = storyplan.beats.map((beat, idx) => {
    let bgDataUri: string | undefined = undefined
    const bgUrl = beat.layers.background.url
    if (bgUrl && bgUrl.startsWith('/backgrounds/')) {
      const filename = path.basename(bgUrl)
      const localBgPath = path.join(process.cwd(), 'public', 'backgrounds', filename)
      bgDataUri = fileToDataUri(localBgPath, 'image/png')
    }

    const card = deck.cards[idx] || deck.cards[deck.cards.length - 1]
    const cardWithInlineAsset = card
      ? {
          ...card,
          productImageUrl: beat.layers.product.url || card.productImageUrl,
        }
      : undefined

    return {
      ...beat,
      infographicCard: cardWithInlineAsset,
      theme: deck.theme,
      layers: {
        ...beat.layers,
        background: {
          ...beat.layers.background,
          url: bgDataUri || beat.layers.background.url,
        },
      },
    }
  })

  // 5. Convert Audio Tracks to Inlined Base64 Data URIs
  const masterAudioDataUri = masterAudioBuffer
    ? `data:audio/mp3;base64,${masterAudioBuffer.toString('base64')}`
    : ''

  // Background Music
  const bgmPath = path.join(process.cwd(), 'public', 'music', 'lofi-beat.mp3')
  const bgmDataUri = fileToDataUri(bgmPath, 'audio/mp3')

  // Sound Effects
  const whooshPath = path.join(process.cwd(), 'public', 'sfx', 'whoosh.mp3')
  const whooshDataUri = fileToDataUri(whooshPath, 'audio/mp3')
  const popPath = path.join(process.cwd(), 'public', 'sfx', 'pop.mp3')
  const popDataUri = fileToDataUri(popPath, 'audio/mp3')
  const snapPath = path.join(process.cwd(), 'public', 'sfx', 'snap.mp3')
  const snapDataUri = fileToDataUri(snapPath, 'audio/mp3')

  const totalDurationFrames = Math.max(90, Math.round(storyplan.totalDurationSec * fps))

  // 6. Build Remotion Video Props
  const inputProps: RemotionVideoProps = {
    beats: beatsWithInlineAssets,
    masterAudioUrl: masterAudioDataUri,
    bgmAudioUrl: bgmDataUri || '/music/lofi-beat.mp3',
    bgmVolume: 0.12,
    sfxCues: [],
    productName: params.productName || 'Sản phẩm thông minh',
    priceText: params.price ? `${params.price.toLocaleString('vi-VN')}đ` : undefined,
    totalDurationFrames,
    fps,
  }

  // 7. Render with Remotion
  const bundleLocation = await getOrCreateBundle()
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'TikTokCommerceVideo',
    inputProps: inputProps as unknown as Record<string, unknown>,
  })

  const safeFileName = `tiktok_${(params.productName || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30)}_${Date.now()}.mp4`

  const outputLocation = path.join(outputDir, safeFileName)

  console.log(`[RemotionRenderer] Rendering ${totalDurationFrames} frames at 1080x1920 30fps to ${outputLocation}...`)

  const ffmpegBinary = getFfmpegBinaryPath()

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    inputProps: inputProps as unknown as Record<string, unknown>,
    imageFormat: 'jpeg',
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    onProgress: ({ progress }) => {
      if (params.onProgress) {
        params.onProgress(progress)
      }
    },
  })

  const stats = fs.statSync(outputLocation)
  const durationSec = Number((totalDurationFrames / fps).toFixed(2))

  console.log(`[RemotionRenderer] Render successful! Size: ${(stats.size / 1024).toFixed(1)} KB, Duration: ${durationSec}s`)

  return {
    filePath: outputLocation,
    fileName: safeFileName,
    duration: durationSec,
    fileSizeBytes: stats.size,
  }
}
