import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface CTAButtonProps {
  label?: string
  priceText?: string
  delayFrames?: number
}

export const CTAButton: React.FC<CTAButtonProps> = ({
  label = 'Xem ở giỏ hàng góc trái',
  priceText,
  delayFrames = 4,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentFrame = Math.max(0, frame - delayFrames)
  const entrance = spring({
    frame: currentFrame,
    fps,
    config: { damping: 14, stiffness: 110 },
  })

  // Subtle floating breathing effect
  const hoverY = Math.sin((frame / fps) * 2.5) * 4

  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const scale = interpolate(entrance, [0, 1], [0.92, 1.0])
  const translateY = interpolate(entrance, [0, 1], [18, 0]) + hoverY

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 32px',
        borderRadius: 9999,
        background:
          'linear-gradient(135deg, #e11d48 0%, #f43f5e 60%, #fb7185 100%)',
        boxShadow:
          '0 16px 36px rgba(225, 29, 72, 0.45), 0 4px 12px rgba(0, 0, 0, 0.3)',
        border: '1.5px solid rgba(255, 255, 255, 0.4)',
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>🛒</span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        {label}
      </span>

      {priceText && (
        <span
          style={{
            marginLeft: 4,
            padding: '4px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderRadius: 9999,
            fontSize: 16,
            fontWeight: 800,
            color: '#fef08a',
            lineHeight: 1,
          }}
        >
          {priceText}
        </span>
      )}
    </div>
  )
}
