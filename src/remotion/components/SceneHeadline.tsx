import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface SceneHeadlineProps {
  text: string
  highlightWord?: string
  align?: 'center' | 'left'
  size?: 'medium' | 'large'
}

export const SceneHeadline: React.FC<SceneHeadlineProps> = ({
  text,
  highlightWord,
  align = 'center',
  size = 'large',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 110, mass: 0.8 },
  })

  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const translateY = interpolate(entrance, [0, 1], [14, 0])

  const fontSize = size === 'large' ? 38 : 32

  // Format headline with optional word highlight
  const words = text.split(' ')

  return (
    <h1
      style={{
        margin: 0,
        fontSize,
        fontWeight: 900,
        lineHeight: 1.25,
        color: '#ffffff',
        textAlign: align,
        letterSpacing: '-0.02em',
        opacity,
        transform: `translateY(${translateY}px)`,
        textShadow:
          '0 2px 8px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.6)',
        maxWidth: 620,
      }}
    >
      {words.map((w, idx) => {
        const isHighlight =
          highlightWord &&
          w.toLowerCase().includes(highlightWord.toLowerCase())

        return (
          <span
            key={idx}
            style={{
              color: isHighlight ? '#fbbf24' : '#ffffff',
              marginRight: 8,
              display: 'inline-block',
            }}
          >
            {w}
          </span>
        )
      })}
    </h1>
  )
}
