import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface CTAEndCardProps {
  productName: string
  priceText?: string
}

export const CTAEndCard: React.FC<CTAEndCardProps> = ({ priceText }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  })

  const bounce = Math.sin((frame / fps) * 3) * 4

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 40px',
        transform: `translateY(${bounce}px) scale(${interpolate(cardSpring, [0, 1], [0.85, 1.0])})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '18px 36px',
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.95) 0%, rgba(14, 165, 233, 0.95) 100%)',
          borderRadius: 9999,
          color: '#09090b',
          fontWeight: 800,
          fontSize: 32,
          boxShadow: '0 16px 36px rgba(6, 182, 212, 0.45)',
          border: '2px solid rgba(255, 255, 255, 0.4)',
        }}
      >
        <span>🛍️ Xem ưu đãi tại Giỏ hàng góc trái</span>
        {priceText && (
          <span
            style={{
              padding: '4px 12px',
              backgroundColor: '#09090b',
              color: '#38bdf8',
              borderRadius: 9999,
              fontSize: 26,
            }}
          >
            {priceText}
          </span>
        )}
      </div>
    </div>
  )
}
