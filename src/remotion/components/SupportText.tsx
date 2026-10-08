import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface SupportTextProps {
  text: string
  align?: 'center' | 'left'
  delayFrames?: number
}

export const SupportText: React.FC<SupportTextProps> = ({
  text,
  align = 'center',
  delayFrames = 5,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentFrame = Math.max(0, frame - delayFrames)
  const entrance = spring({
    frame: currentFrame,
    fps,
    config: { damping: 16, stiffness: 120 },
  })

  const opacity = interpolate(entrance, [0, 1], [0, 0.88])
  const translateY = interpolate(entrance, [0, 1], [10, 0])

  return (
    <p
      style={{
        margin: 0,
        fontSize: 18,
        fontWeight: 500,
        lineHeight: 1.45,
        color: '#e4e4e7',
        textAlign: align,
        opacity,
        transform: `translateY(${translateY}px)`,
        textShadow: '0 2px 6px rgba(0,0,0,0.7)',
        maxWidth: 580,
      }}
    >
      {text}
    </p>
  )
}
