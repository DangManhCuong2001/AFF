import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface AnimatedCaptionProps {
  badgeText?: string
  subtitleText: string
  emphasisWord?: string
  emphasisRevealDelayFrames?: number
}

export const AnimatedCaption: React.FC<AnimatedCaptionProps> = ({
  badgeText,
  subtitleText,
  emphasisWord,
  emphasisRevealDelayFrames = 15,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Spring animation for subtitle entrance
  const captionSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  })

  // Spring for emphasis badge
  const emphasisFrame = Math.max(0, frame - emphasisRevealDelayFrames)
  const emphasisSpring = spring({
    frame: emphasisFrame,
    fps,
    config: { damping: 10, stiffness: 140 },
  })

  const captionOpacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })
  const captionTranslateY = interpolate(captionSpring, [0, 1], [20, 0])

  const { durationInFrames } = useVideoConfig()
  const words = subtitleText.trim().split(/\s+/)
  const activeWordIndex = Math.min(
    words.length - 1,
    Math.floor((frame / Math.max(1, durationInFrames - 4)) * words.length)
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '0 48px',
        opacity: captionOpacity,
        transform: `translateY(${captionTranslateY}px)`,
      }}
    >
      {/* Top Story Beat Badge */}
      {badgeText && (
        <div
          style={{
            padding: '8px 24px',
            backgroundColor: 'rgba(234, 179, 8, 0.95)',
            color: '#09090b',
            borderRadius: 9999,
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: '0.05em',
            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            textTransform: 'uppercase',
          }}
        >
          {badgeText}
        </div>
      )}

      {/* Main Subtitle Box with CapCut Word-by-Word Kinetic Karaoke */}
      <div
        style={{
          padding: '18px 36px',
          backgroundColor: 'rgba(9, 9, 11, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(255, 255, 255, 0.18)',
          borderRadius: 24,
          fontSize: 34,
          lineHeight: 1.4,
          textAlign: 'center',
          boxShadow: '0 16px 36px rgba(0,0,0,0.6), 0 0 20px rgba(244,63,94,0.15)',
          maxWidth: 940,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {words.map((word, wIdx) => {
          const isPast = wIdx < activeWordIndex
          const isCurrent = wIdx === activeWordIndex
          return (
            <span
              key={wIdx}
              style={{
                display: 'inline-block',
                margin: '2px 6px',
                color: isCurrent ? '#facc15' : isPast ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                fontWeight: isCurrent ? 900 : 700,
                transform: isCurrent ? 'scale(1.15)' : 'scale(1.0)',
                textShadow: isCurrent
                  ? '0 0 16px rgba(250, 204, 21, 0.9), 0 2px 4px black'
                  : '0 2px 4px rgba(0,0,0,0.7)',
                transition: 'all 0.08s ease-out',
              }}
            >
              {word}
            </span>
          )
        })}
      </div>

      {/* Emphasis Pop Badge (Triggered on Key Phrase) */}
      {emphasisWord && frame >= emphasisRevealDelayFrames && (
        <div
          style={{
            padding: '10px 28px',
            background: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
            color: '#ffffff',
            borderRadius: 16,
            fontWeight: 900,
            fontSize: 32,
            letterSpacing: '0.06em',
            boxShadow: '0 10px 25px rgba(244, 63, 94, 0.5)',
            transform: `scale(${interpolate(emphasisSpring, [0, 1], [0.6, 1.0])})`,
          }}
        >
          ⚡ {emphasisWord}
        </div>
      )}
    </div>
  )
}
