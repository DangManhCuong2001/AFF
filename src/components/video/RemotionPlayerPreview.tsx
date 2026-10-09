'use client'

import React, { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { TikTokCommerceVideo } from '@/remotion/TikTokCommerceVideo'
import { RemotionVideoProps } from '@/remotion/types'
import { VisualBeat } from '@/engines/visual/types'
import { VipeeVisualDirector } from '@/engines/visual/VipeeVisualDirector'
import { StoryboardScene } from '@/engines/core/types'
import { InfographicEngine } from '@/engines/infographic/InfographicEngine'
import { Sparkles, Play, RefreshCw, Volume2, ShieldCheck, Film } from 'lucide-react'

// Dynamically import Player from @remotion/player with SSR disabled to prevent hydration mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RemotionPlayer = dynamic<any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => import('@remotion/player').then((mod) => mod.Player as any),
  { ssr: false }
)

interface RemotionPlayerPreviewProps {
  productName: string
  price?: number
  category?: string
  scenes: StoryboardScene[]
  imageUrls: string[]
  voiceAudioUrl?: string
  bgmAudioUrl?: string
  fps?: number
  renderedVideoUrl?: string | null
}

export const RemotionPlayerPreview: React.FC<RemotionPlayerPreviewProps> = ({
  productName,
  price,
  category = 'home',
  scenes,
  imageUrls,
  voiceAudioUrl,
  bgmAudioUrl = '/music/lofi-beat.mp3',
  fps = 30,
  renderedVideoUrl,
}) => {
  const [viewMode, setViewMode] = useState<'remotion' | 'mp4'>('remotion')

  const visualDirector = useMemo(() => new VipeeVisualDirector(), [])

  const remotionProps = useMemo<RemotionVideoProps>(() => {
    const validImages = imageUrls.length > 0 ? imageUrls : ['/backgrounds/minimal_lifestyle.png']

    const speechTimings = scenes.reduce<{
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

    const storyplan = visualDirector.createVisualStoryplan({
      speechTimings,
      productImages: validImages,
      productName: productName || 'Sản phẩm thông minh',
      category: category,
    })

    // Generate Commercial Infographic Deck for exact visual fidelity matching Part 1
    const infographicEngine = new InfographicEngine()
    const deck = infographicEngine.generateDeck({
      productName: productName || 'Sản phẩm thông minh',
      price,
      primaryImageUrl: validImages[0] || '',
      secondaryImageUrl: validImages[1],
      galleryImages: validImages,
      scenes,
    })

    // Attach Infographic Cards & Category Theme to each story beat
    const beatsWithCards = storyplan.beats.map((beat, idx) => ({
      ...beat,
      infographicCard: deck.cards[idx] || deck.cards[deck.cards.length - 1],
      theme: deck.theme,
    }))

    const totalDurationFrames = Math.max(90, Math.round(storyplan.totalDurationSec * fps))

    return {
      beats: beatsWithCards,
      masterAudioUrl: voiceAudioUrl || '',
      bgmAudioUrl: bgmAudioUrl,
      bgmVolume: 0.12,
      sfxCues: [],
      productName: productName || 'Sản phẩm thông minh',
      priceText: price ? `${price.toLocaleString('vi-VN')}đ` : undefined,
      totalDurationFrames,
      fps,
    }
  }, [visualDirector, scenes, imageUrls, productName, category, price, voiceAudioUrl, bgmAudioUrl, fps])

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* Switcher: Remotion Live Preview vs Rendered MP4 */}
      {renderedVideoUrl && (
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('remotion')}
            className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              viewMode === 'remotion'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Remotion 60FPS Live
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mp4')}
            className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              viewMode === 'mp4'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Tệp MP4 Xuất Bản
          </button>
        </div>
      )}

      {/* Main 9:16 Frame Container */}
      <div className="w-full max-w-[340px] aspect-[9/16] rounded-3xl overflow-hidden border-2 border-neutral-800 shadow-2xl bg-black relative flex flex-col justify-center items-center group">
        {viewMode === 'mp4' && renderedVideoUrl ? (
          <video
            key={renderedVideoUrl}
            src={renderedVideoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full relative">
            <RemotionPlayer
              component={TikTokCommerceVideo}
              inputProps={remotionProps}
              durationInFrames={remotionProps.totalDurationFrames}
              fps={remotionProps.fps}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{
                width: '100%',
                height: '100%',
              }}
              controls
              autoPlay
              loop
              acknowledgeRemotionLicense
            />
          </div>
        )}
      </div>

      {/* Live Badge Information */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-400">
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Kinetic Typography & 3D Spring Card
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
          <Volume2 className={`w-3 h-3 ${voiceAudioUrl ? 'text-emerald-400' : 'text-neutral-500'}`} />
          {voiceAudioUrl ? 'Thuyết minh & BGM: Sẵn sàng' : 'BGM & SFX'}
        </span>
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400">
          9:16 TikTok Format
        </span>
      </div>
    </div>
  )
}
