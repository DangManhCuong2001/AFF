import React from 'react'
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from 'remotion'
import { Audio } from '@remotion/media'
import { RemotionVideoProps } from './types'
import { DynamicScene } from './DynamicScene'
import {HybridIntroScene} from './HybridIntroScene'
import {hybridIntroFrames} from './scene-video'

function resolveAudioSrc(src?: string): string | undefined {
  if (!src) return undefined
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return src
  }
  try {
    const clean = src.startsWith('/') ? src.slice(1) : src
    return staticFile(clean)
  } catch {
    return src
  }
}

export const TikTokCommerceVideo: React.FC<RemotionVideoProps> = ({
  beats,
  masterAudioUrl,
  bgmAudioUrl,
  bgmVolume = 0.12,
  sfxCues = [],
  productName,
  priceText,
  fps,
  sceneVideos,
  introVideo,
}) => {
  const resolvedMasterAudio = resolveAudioSrc(masterAudioUrl)
  const {durationInFrames} = useVideoConfig()
  const resolvedBgmAudio = resolveAudioSrc(bgmAudioUrl)
  const introFrames = hybridIntroFrames(introVideo, durationInFrames, fps, beats.find(beat => beat.plannedScene?.type === 'cta' || beat.shotType === 'CTAShot')?.startTimeSec)

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
      {/* 1. Visual Scenes Sequence */}
      {beats.map((beat, idx) => {
        const fromFrame = Math.round(beat.startTimeSec * fps)
        // Shared boundaries prevent one-frame gaps from rounding individual durations.
        const endFrame = idx === beats.length - 1 ? durationInFrames : Math.round(beats[idx + 1].startTimeSec * fps)
        const durationFrames = Math.max(1, endFrame - fromFrame)
        const isLastScene = idx === beats.length - 1

        return (
          <Sequence
            key={beat.id}
            from={fromFrame}
            durationInFrames={durationFrames}
            name={`Scene-${idx + 1}-${beat.shotType}`}
          >
            <DynamicScene
              beat={beat}
              productName={productName}
              priceText={priceText}
              isLastScene={isLastScene}
              video={sceneVideos?.[beat.segmentId]}
            />
          </Sequence>
        )
      })}

      {introVideo && introFrames > 0 && <Sequence durationInFrames={introFrames} name="AI opening — continuous action"><HybridIntroScene clip={introVideo} beats={beats} productName={productName} durationFrames={introFrames} /></Sequence>}

      {/* 2. Master narration already has a short audio fade before speech begins. */}
      {resolvedMasterAudio && (
        <Audio
          src={resolvedMasterAudio}
          volume={(f) => {
            // Finish the visual audio ramp inside the initial silence, preserving
            // the first spoken syllable instead of fading it over 133 milliseconds.
            const ramp = Math.min(1, f / Math.max(1, Math.round(fps * 0.02)))
            // Leave headroom for the background track when the voice is near full scale.
            return ramp * 0.85
          }}
        />
      )}

      {/* 3. Ducked Background Music Track – fade in over first 15 frames */}
      {resolvedBgmAudio && (
        <Audio
          src={resolvedBgmAudio}
          volume={(f) => {
            const last = beats.at(-1)
            const totalFrames = last ? Math.round((last.startTimeSec + last.durationSec) * fps) : 0
            const fadeOut = Math.max(0, Math.min(1, (totalFrames - f) / (fps * 0.5)))
            // Fade in BGM over first 15 frames to prevent hard-start pop
            const fadeIn = Math.min(1, f / 15)
            return fadeIn * fadeOut * bgmVolume
          }}
          loop
        />
      )}

      {/* 4. Synced Sound Effects Cues */}
      {sfxCues.map((sfx) => {
        const sfxFromFrame = Math.round(sfx.timestampSec * fps)
        const resolvedSfx = resolveAudioSrc(sfx.url)
        if (!resolvedSfx) return null
        return (
          <Sequence
            key={sfx.id}
            from={sfxFromFrame}
            durationInFrames={Math.round(fps * 0.8)}
            name={`SFX-${sfx.name || sfx.id}`}
          >
            <Audio src={resolvedSfx} volume={sfx.volume} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
