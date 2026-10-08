import React from 'react'
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface ProductCloseupProps {
  imageUrl: string
  size?: number
  zoomLevel?: number
  focusArea?: 'center' | 'top' | 'bottom'
  badgeText?: string
}

export const ProductCloseup: React.FC<ProductCloseupProps> = ({
  imageUrl,
  size = 540,
  zoomLevel = 1.35,
  focusArea = 'center',
  badgeText = 'CẬN CẢNH CHI TIẾT',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  })

  // Subtle pan across the detail
  const slowPanY = interpolate(frame, [0, 90], [0, -12], {
    extrapolateRight: 'clamp',
  })

  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const scale = interpolate(entrance, [0, 1], [0.94, 1.0])

  const objectPosition =
    focusArea === 'top'
      ? 'center 20%'
      : focusArea === 'bottom'
      ? 'center 80%'
      : 'center center'

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 32,
        overflow: 'hidden',
        boxShadow:
          '0 28px 60px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {/* Zoomed macro image */}
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          transform: `scale(${zoomLevel}) translateY(${slowPanY}px)`,
        }}
      >
        <Img
          src={imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition,
          }}
        />
      </div>

      {/* Detail overlay badge in top right */}
      {badgeText && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '6px 14px',
            borderRadius: 9999,
            backgroundColor: 'rgba(9, 9, 11, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            fontSize: 12,
            fontWeight: 700,
            color: '#fbbf24',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          🔍 {badgeText}
        </div>
      )}
    </div>
  )
}
