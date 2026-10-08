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
          background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 50%, #fb7185 100%)',
          borderRadius: 9999,
          color: '#ffffff',
          fontWeight: 900,
          fontSize: 30,
          boxShadow: '0 16px 36px rgba(225, 29, 72, 0.6), 0 0 20px rgba(244, 63, 94, 0.4)',
          border: '2px solid rgba(255, 255, 255, 0.7)',
        }}
      >
        <span>🛒 BẤM GIỎ HÀNG GÓC TRÁI • MUA NGAY</span>
        {priceText && (
          <span
            style={{
              padding: '6px 16px',
              backgroundColor: '#facc15',
              color: '#09090b',
              borderRadius: 9999,
              fontSize: 26,
              fontWeight: 900,
            }}
          >
            {priceText}
          </span>
        )}
      </div>
    </div>
  )
}
