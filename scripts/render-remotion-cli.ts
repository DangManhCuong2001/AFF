import path from 'path'
import os from 'os'
import fs from 'fs'
import { bundle } from '@remotion/bundler'
import { selectComposition, renderMedia } from '@remotion/renderer'
import { InfographicEngine } from '../src/engines/infographic/InfographicEngine'
import type {StoryboardScene} from '../src/engines/core/types'
import { ProductCategory } from '../src/engines/infographic/types'
import { VipeeVisualDirector } from '../src/engines/visual/VipeeVisualDirector'
import { RemotionVideoProps } from '../src/remotion/types'

let cachedBundleLocation: string | null = null

async function getRemotionBundleLocation(): Promise<string> {
  if (cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
    return cachedBundleLocation
  }

  const bundleLoc = await bundle({
    entryPoint: path.resolve(process.cwd(), 'src/remotion/index.ts'),
    publicDir: path.resolve(process.cwd(), 'public'),
    enableCaching: false,
  })

  cachedBundleLocation = bundleLoc
  return bundleLoc
}

async function main() {
  const args = process.argv.slice(2)
  const inputJsonPath = args[0]
  if (!inputJsonPath || !fs.existsSync(inputJsonPath)) {
    console.error(JSON.stringify({ success: false, error: 'Input JSON file missing' }))
    process.exit(1)
  }

  const data = JSON.parse(fs.readFileSync(inputJsonPath, 'utf-8'))
  const {
    productName = 'Sản phẩm thông minh',
    price,
    category,
    scenes = [],
    sceneVideos,
    introVideo,
    images = [],
    masterAudioBase64 = '',
    bgmAudioBase64 = '',
    outPath,
  } = data

  const fps = 30

  // 1. Prepare valid base64 images
  let validImages: string[] = Array.isArray(images) && images.length > 0 ? images : []
  if (validImages.length === 0) {
    const fallbackPath = path.join(process.cwd(), 'public', 'backgrounds', 'minimal_lifestyle.png')
    if (fs.existsSync(fallbackPath)) {
      validImages = [`data:image/png;base64,${fs.readFileSync(fallbackPath).toString('base64')}`]
    } else {
      validImages = ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==']
    }
  }

  // 2. Prepare Timings
  let cur = 0
  const speechTimings = scenes.map((s: StoryboardScene, idx: number) => {
    const dur = s.duration && s.duration > 0 ? s.duration : 3
    const t = {
      segmentId: s.id || `scene-${idx + 1}`,
      text: s.voice || s.headline || 'Khám phá sản phẩm',
      emotion: s.type || 'demo',
      startSec: cur,
      endSec: cur + dur,
      durationSec: dur,
      emphasis: s.keywords,
    }
    cur += dur
    return t
  })

  // 3. Prepare BGM Audio
  let resolvedBgm = bgmAudioBase64
  if (!resolvedBgm) {
    const bgmPath = path.join(process.cwd(), 'public', 'music', 'lofi-beat.mp3')
    if (fs.existsSync(bgmPath)) {
      resolvedBgm = `data:audio/mp3;base64,${fs.readFileSync(bgmPath).toString('base64')}`
    }
  }

  // 4. Generate Storyplan & Commercial Infographic Deck
  const visualDirector = new VipeeVisualDirector()
  const storyplan = visualDirector.createVisualStoryplan({
    scenes,
    speechTimings,
    productImages: validImages,
    productName,
    category,
  })

  const infographicEngine = new InfographicEngine()
  const deck = infographicEngine.generateDeck({
    productName,
    price,
    primaryImageUrl: validImages[0],
    secondaryImageUrl: validImages[1] || validImages[0],
    galleryImages: validImages,
    customCategory: (category as ProductCategory) || undefined,
    scenes,
  })

  const beatsWithCards = storyplan.beats.map((beat, idx) => ({
    ...beat,
    infographicCard: deck.cards[idx] || deck.cards[deck.cards.length - 1],
    theme: deck.theme,
  }))

  const totalDurationFrames = Math.max(90, Math.ceil(storyplan.totalDurationSec * fps))

  const remotionProps: RemotionVideoProps = {
    beats: beatsWithCards,
    sceneVideos,
    introVideo,
    masterAudioUrl: masterAudioBase64,
    bgmAudioUrl: resolvedBgm,
    bgmVolume: 0.12,
    sfxCues: [],
    productName,
    priceText: price ? `${price.toLocaleString('vi-VN')}đ` : undefined,
    totalDurationFrames,
    fps,
  }

  // 5. Bundle and Render Media
  const bundleLocation = await getRemotionBundleLocation()

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'TikTokCommerceVideo',
    inputProps: remotionProps as unknown as Record<string, unknown>,
  })

  const finalOutPath = outPath || path.join(os.tmpdir(), `remotion_${Date.now()}.mp4`)

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: finalOutPath,
    inputProps: remotionProps as unknown as Record<string, unknown>,
    chromiumOptions: {
      gl: 'angle',
    },
  })

  const stat = fs.statSync(finalOutPath)

  console.log(
    JSON.stringify({
      success: true,
      filePath: finalOutPath,
      fileName: path.basename(finalOutPath),
      duration: composition.durationInFrames / composition.fps,
      fileSizeBytes: stat.size,
    })
  )
}

main().catch((err) => {
  console.error(JSON.stringify({ success: false, error: String(err?.message || err) }))
  process.exit(1)
})
