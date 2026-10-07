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

      {/* Main Subtitle Box */}
      <div
        style={{
          padding: '16px 32px',
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 20,
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 34,
          lineHeight: 1.35,
          textAlign: 'center',
          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
          maxWidth: 920,
        }}
      >
        {subtitleText}
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
