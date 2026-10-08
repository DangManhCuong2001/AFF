import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface BenefitChipRowProps {
  chips: string[]
  delayFrames?: number
}

export const BenefitChipRow: React.FC<BenefitChipRowProps> = ({
  chips,
  delayFrames = 8,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (!chips || chips.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        maxWidth: 600,
      }}
    >
      {chips.map((chip, idx) => {
        const itemDelay = delayFrames + idx * 4
        const currentFrame = Math.max(0, frame - itemDelay)
        const chipSpring = spring({
          frame: currentFrame,
          fps,
          config: { damping: 14, stiffness: 130 },
        })

        const opacity = interpolate(chipSpring, [0, 1], [0, 1])
        const translateY = interpolate(chipSpring, [0, 1], [12, 0])
        const scale = interpolate(chipSpring, [0, 1], [0.92, 1.0])

        return (
          <div
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 9999,
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
              opacity,
              transform: `translateY(${translateY}px) scale(${scale})`,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: '#34d399',
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              ✓
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}
            >
              {chip}
            </span>
          </div>
        )
      })}
    </div>
  )
}
