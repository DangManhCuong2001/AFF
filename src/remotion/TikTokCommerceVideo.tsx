import React from 'react'
import { AbsoluteFill, Audio, Sequence } from 'remotion'
import { RemotionVideoProps } from './types'
import { DynamicScene } from './DynamicScene'

export const TikTokCommerceVideo: React.FC<RemotionVideoProps> = ({
  beats,
  masterAudioUrl,
  bgmAudioUrl,
  bgmVolume = 0.12,
  sfxCues = [],
  productName,
  priceText,
  fps,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
      {/* 1. Visual Scenes Sequence */}
      {beats.map((beat, idx) => {
        const fromFrame = Math.round(beat.startTimeSec * fps)
        const durationFrames = Math.max(1, Math.round(beat.durationSec * fps))
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
            />
          </Sequence>
        )
      })}

      {/* 2. Master Voiceover Audio */}
      {masterAudioUrl && (
        <Audio src={masterAudioUrl} volume={1.2} />
      )}

      {/* 3. Ducked Background Music Track */}
      {bgmAudioUrl && (
        <Audio src={bgmAudioUrl} volume={bgmVolume} loop />
      )}

      {/* 4. Synced Sound Effects Cues */}
      {sfxCues.map((sfx) => {
        const sfxFromFrame = Math.round(sfx.timestampSec * fps)
        return (
          <Sequence
            key={sfx.id}
            from={sfxFromFrame}
            durationInFrames={Math.round(fps * 0.8)}
            name={`SFX-${sfx.name || sfx.id}`}
          >
            <Audio src={sfx.url} volume={sfx.volume} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
