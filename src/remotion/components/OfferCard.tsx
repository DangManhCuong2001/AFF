import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface OfferCardProps {
  price?: string
  voucher?: string
  subtitle?: string
}

export const OfferCard: React.FC<OfferCardProps> = ({
  price,
  voucher,
  subtitle = 'Ưu đãi có hạn trên TikTok Shop',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
  })

  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const translateY = interpolate(entrance, [0, 1], [16, 0])

  if (!price && !voucher) return null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '16px 28px',
        borderRadius: 24,
        background: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.3)',
        opacity,
        transform: `translateY(${translateY}px)`,
        maxWidth: 540,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {price && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#fbbf24',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {price}
            </span>
          </div>
        )}

        {voucher && (
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 9999,
              backgroundColor: 'rgba(244, 63, 94, 0.25)',
              border: '1px solid rgba(244, 63, 94, 0.5)',
              color: '#fda4af',
              fontSize: 13,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            🎟️ {voucher}
          </span>
        )}
      </div>

      {subtitle && (
        <span
          style={{
            fontSize: 13,
            color: 'rgba(255, 255, 255, 0.75)',
            fontWeight: 500,
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  )
}
