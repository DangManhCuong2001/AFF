import React from 'react'
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface ProductCardProps {
  imageUrl: string
  aspectRatio?: 'square' | 'portrait'
  size?: number
  delayFrames?: number
  variant?: 'frosted' | 'clean_white' | 'minimal'
}

export const ProductCard: React.FC<ProductCardProps> = ({
  imageUrl,
  aspectRatio = 'square',
  size = 540,
  delayFrames = 0,
  variant = 'frosted',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentFrame = Math.max(0, frame - delayFrames)

  // Gentle pop-in entrance spring
  const entrance = spring({
    frame: currentFrame,
    fps,
    config: { damping: 16, stiffness: 100, mass: 0.9 },
  })

  // Subtle floating hover effect (sine wave)
  const hoverY = Math.sin((frame / fps) * 2.2) * 6
  // Very slow, cinematic push-in (Ken Burns)
  const slowZoom = interpolate(frame, [0, 90], [1.0, 1.04], {
    extrapolateRight: 'clamp',
  })

  const scale = interpolate(entrance, [0, 1], [0.9, 1.0]) * slowZoom
  const opacity = interpolate(entrance, [0, 1], [0, 1])
  const translateY = interpolate(entrance, [0, 1], [24, 0]) + hoverY

  const height = aspectRatio === 'square' ? size : Math.round(size * 1.15)

  // Card background & borders based on variant
  const cardStyle = {
    frosted: {
      background: 'rgba(255, 255, 255, 0.09)',
      border: '1px solid rgba(255, 255, 255, 0.22)',
      boxShadow:
        '0 28px 60px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
    },
    clean_white: {
      background: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.9)',
      boxShadow:
        '0 30px 60px rgba(0, 0, 0, 0.35), 0 10px 20px rgba(0, 0, 0, 0.2)',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
    minimal: {
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  }[variant]

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
      }}
    >
      {/* Ambient soft glow aura behind the card */}
      <div
        style={{
          position: 'absolute',
          width: size * 0.9,
          height: height * 0.9,
          background:
            'radial-gradient(circle, rgba(251, 191, 36, 0.16) 0%, rgba(244, 63, 94, 0.12) 40%, transparent 70%)',
          borderRadius: 36,
          filter: 'blur(40px)',
          zIndex: 0,
        }}
      />

      {/* Main Rounded Product Card Container */}
      <div
        style={{
          position: 'relative',
          width: size,
          height,
          borderRadius: 32,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          zIndex: 1,
          ...cardStyle,
        }}
      >
        <Img
          src={imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: 20,
            filter:
              variant === 'clean_white'
                ? 'none'
                : 'drop-shadow(0 15px 30px rgba(0,0,0,0.5))',
          }}
        />
      </div>
    </div>
  )
}
