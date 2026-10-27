'use client'

import { canRenderMediaOnWeb, renderMediaOnWeb, type WebRendererAudioCodec, type WebRendererVideoCodec } from '@remotion/web-renderer'
import {assertNarrationDuration} from './narration-sync'
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

export async function getWebExportConfig(): Promise<{
  supported: boolean
  container: 'mp4' | 'webm'
  videoCodec?: WebRendererVideoCodec
  audioCodec?: WebRendererAudioCodec
}> {
  if (typeof window === 'undefined') {
    return { supported: false, container: 'mp4' }
  }

  // 1. Try MP4 first (Standard format for TikTok)
  try {
    const mp4Res = await canRenderMediaOnWeb({
      container: 'mp4',
      width: 1080,
      height: 1920,
    })
    if (mp4Res.canRender) {
      return {
        supported: true,
        container: 'mp4',
        videoCodec: mp4Res.resolvedVideoCodec || 'h264',
        audioCodec: mp4Res.resolvedAudioCodec || 'aac',
      }
    }
    console.log('[client-renderer] MP4 canRenderMediaOnWeb issues:', mp4Res.issues)
  } catch (err) {
    console.warn('[client-renderer] MP4 canRenderMediaOnWeb error:', err)
  }

  // 2. Try WebM next
  try {
    const webmRes = await canRenderMediaOnWeb({
      container: 'webm',
      width: 1080,
      height: 1920,
    })
    if (webmRes.canRender) {
      return {
        supported: true,
        container: 'webm',
        videoCodec: webmRes.resolvedVideoCodec || 'vp9',
        audioCodec: webmRes.resolvedAudioCodec || 'opus',
      }
    }
    console.log('[client-renderer] WebM canRenderMediaOnWeb issues:', webmRes.issues)
  } catch (err) {
    console.warn('[client-renderer] WebM canRenderMediaOnWeb error:', err)
  }

  return { supported: false, container: 'mp4' }
}

export async function isClientExportSupported(): Promise<boolean> {
  const config = await getWebExportConfig()
  return config.supported
}

async function prepareAssetUrl(url: string): Promise<string> {
  if (!url) return ''
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${url}`
  }
  // Try fetching external URL to blob to bypass canvas taint / CORS
  try {
    const res = await fetch(url)
    if (res.ok) {
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    }
  } catch {
    // Return original url if fetch fails
  }
  return url
}

export async function renderVideoOnClient(
  opts: ClientRenderOptions
): Promise<ClientRenderResult> {
  const fps = opts.fps || 30
  const exportConfig = await getWebExportConfig()

  opts.onProgress?.(5, 'Đang chuẩn hóa đồ họa & hình ảnh sản phẩm...')

  // Pre-prepare images as local blob URLs to avoid canvas tainting
  const rawImages = opts.imageUrls.length > 0 ? opts.imageUrls : ['/backgrounds/minimal_lifestyle.png']
  const validImages = await Promise.all(rawImages.map(prepareAssetUrl))

  // Prepare Audio URLs with pre-fetched blob URLs to avoid playback hiccups or CORS during render
  const resolvedVoiceUrl = opts.voiceAudioUrl ? await prepareAssetUrl(opts.voiceAudioUrl) : ''
  if (resolvedVoiceUrl) {
    const bytes = await fetch(resolvedVoiceUrl).then(response => response.arrayBuffer())
    const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes)
    assertNarrationDuration(opts.scenes, decoded.duration)
  }
  const resolvedBgmUrl = await prepareAssetUrl(opts.bgmAudioUrl || '/music/lofi-beat.mp3')

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
    scenes: opts.scenes,
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

  const totalDurationFrames = Math.max(90, Math.ceil(storyplan.totalDurationSec * fps))

  const remotionProps: RemotionVideoProps = {
    beats: beatsWithCards,
    masterAudioUrl: resolvedVoiceUrl || '',
    bgmAudioUrl: resolvedBgmUrl,
    bgmVolume: 0.12,
    sfxCues: [],
    productName: opts.productName || 'Sản phẩm thông minh',
    priceText: opts.price ? `${opts.price.toLocaleString('vi-VN')}đ` : undefined,
    totalDurationFrames,
    fps,
  }

  opts.onProgress?.(10, `Đang khởi tạo Remotion Engine 1080x1920 (${exportConfig.container.toUpperCase()})...`)

  // 5. Render directly in the browser via WebCodecs & Mediabunny
  const webProps: RemotionVideoProps & Record<string, unknown> = {...remotionProps}
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      component: TikTokCommerceVideo,
      durationInFrames: totalDurationFrames,
      fps,
      width: 1080,
      height: 1920,
      id: 'TikTokCommerceVideo',
      defaultProps: webProps,
    },
    inputProps: webProps,
    container: exportConfig.container,
    videoCodec: exportConfig.videoCodec,
    audioCodec: exportConfig.audioCodec,
    onProgress: ({ progress }) => {
      const pct = Math.min(98, Math.max(10, Math.round(10 + progress * 88)))
      opts.onProgress?.(pct, `Đang kết xuất khung hình Remotion: ${pct}%`)
    },
  })

  opts.onProgress?.(99, `Đang hoàn tất đóng gói video ${exportConfig.container.toUpperCase()}...`)
  const blob = await getBlob()

  const ext = exportConfig.container === 'webm' ? 'webm' : 'mp4'
  const mimeType = exportConfig.container === 'webm' ? 'video/webm' : 'video/mp4'
  const fileName = `remotion_${Date.now()}.${ext}`
  const file = new File([blob], fileName, { type: mimeType })
  const blobUrl = URL.createObjectURL(blob)

  return {
    blob,
    blobUrl,
    file,
    fileName,
  }
}
