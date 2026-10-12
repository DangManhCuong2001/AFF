'use client'

import { canRenderMediaOnWeb, renderMediaOnWeb } from '@remotion/web-renderer'
import { TikTokCommerceVideo } from '@/remotion/TikTokCommerceVideo'
import { RemotionVideoProps } from '@/remotion/types'
import { StoryboardScene } from '@/engines/core/types'
import { VipeeVisualDirector } from '@/engines/visual/VipeeVisualDirector'
import { InfographicEngine } from '@/engines/infographic/InfographicEngine'
import { ProductCategory } from '@/engines/infographic/types'

export interface ClientRenderOptions {
  productName: string
  price?: number
  category?: string
  scenes: StoryboardScene[]
  imageUrls: string[]
  voiceAudioUrl?: string
  bgmAudioUrl?: string
  fps?: number
  onProgress?: (percent: number, message: string) => void
}

export interface ClientRenderResult {
  blob: Blob
  blobUrl: string
  file: File
  fileName: string
}

export async function isClientExportSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const res = await canRenderMediaOnWeb({
      container: 'mp4',
      width: 1080,
      height: 1920,
    })
    return res.canRender
  } catch {
    return false
  }
}

export async function renderVideoOnClient(
  opts: ClientRenderOptions
): Promise<ClientRenderResult> {
  const fps = opts.fps || 30
  const validImages = opts.imageUrls.length > 0 ? opts.imageUrls : ['/backgrounds/minimal_lifestyle.png']

  // 1. Build Exact Speech Timings matching RemotionPlayerPreview
  const speechTimings = opts.scenes.reduce<{
    timings: Array<{
      segmentId: string
      text: string
      emotion: string
      startSec: number
      endSec: number
      durationSec: number
      emphasis?: string[]
    }>
    currentStart: number
  }>(
    (acc, s, idx) => {
      const dur = s.duration && s.duration > 0 ? s.duration : 3
      const timing = {
        segmentId: s.id || `scene-${idx + 1}`,
        text: s.voice || s.headline || 'Khám phá sản phẩm chất lượng',
        emotion: s.type || 'demo',
        startSec: acc.currentStart,
        endSec: acc.currentStart + dur,
        durationSec: dur,
        emphasis: s.keywords,
      }
      return {
        timings: [...acc.timings, timing],
        currentStart: acc.currentStart + dur,
      }
    },
    { timings: [], currentStart: 0 }
  ).timings

  // 2. Build Storyplan
  const visualDirector = new VipeeVisualDirector()
  const storyplan = visualDirector.createVisualStoryplan({
    speechTimings,
    productImages: validImages,
    productName: opts.productName || 'Sản phẩm thông minh',
    category: opts.category || 'home',
  })

  // 3. Generate Commercial Infographic Deck
  const infographicEngine = new InfographicEngine()
  const deck = infographicEngine.generateDeck({
    productName: opts.productName || 'Sản phẩm thông minh',
    price: opts.price,
    primaryImageUrl: validImages[0] || '',
    secondaryImageUrl: validImages[1],
    galleryImages: validImages,
    customCategory: (opts.category as ProductCategory) || undefined,
    scenes: opts.scenes,
  })

  // 4. Attach Infographic Cards & Theme
  const beatsWithCards = storyplan.beats.map((beat, idx) => ({
    ...beat,
    infographicCard: deck.cards[idx] || deck.cards[deck.cards.length - 1],
    theme: deck.theme,
  }))

  const totalDurationFrames = Math.max(90, Math.round(storyplan.totalDurationSec * fps))

  const remotionProps: RemotionVideoProps = {
    beats: beatsWithCards,
    masterAudioUrl: opts.voiceAudioUrl || '',
    bgmAudioUrl: opts.bgmAudioUrl || '/music/lofi-beat.mp3',
    bgmVolume: 0.12,
    sfxCues: [],
    productName: opts.productName || 'Sản phẩm thông minh',
    priceText: opts.price ? `${opts.price.toLocaleString('vi-VN')}đ` : undefined,
    totalDurationFrames,
    fps,
  }

  opts.onProgress?.(5, 'Đang chuẩn bị Render WebCodecs 1080x1920 (Khớp 100% Live)...')

  // 5. Render directly in the browser via WebCodecs & Mediabunny
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      component: TikTokCommerceVideo as React.ComponentType<any>,
      durationInFrames: totalDurationFrames,
      fps,
      width: 1080,
      height: 1920,
      id: 'TikTokCommerceVideo',
      defaultProps: remotionProps as any,
    },
    inputProps: remotionProps as any,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    onProgress: ({ progress }) => {
      const pct = Math.min(99, Math.max(5, Math.round(progress * 95)))
      opts.onProgress?.(pct, `Đang kết xuất khung hình Remotion: ${pct}%`)
    },
  })

  opts.onProgress?.(98, 'Đang đóng gói tệp MP4...')
  const blob = await getBlob()

  const fileName = `remotion_${Date.now()}.mp4`
  const file = new File([blob], fileName, { type: 'video/mp4' })
  const blobUrl = URL.createObjectURL(blob)

  return {
    blob,
    blobUrl,
    file,
    fileName,
  }
}
