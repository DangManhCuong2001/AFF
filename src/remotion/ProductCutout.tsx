import React from 'react'
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface ProductCutoutProps {
  imageUrl: string
  motion: 'none' | 'snap_pop' | 'subtle_hover' | 'macro_slide' | 'smooth_scale'
  hasContactShadow?: boolean
  revealDelayFrames?: number
}

export const ProductCutout: React.FC<ProductCutoutProps> = ({
  imageUrl,
  motion,
  hasContactShadow = true,
  revealDelayFrames = 0,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentFrame = Math.max(0, frame - revealDelayFrames)

  // Spring animation for product reveal pop
  const popSpring = spring({
    frame: currentFrame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
      mass: 0.6,
    },
  })

  // Subtle floating hover effect
  const hoverOffset = Math.sin((frame / fps) * 2.5) * 8

  let scale = 1.0
  let translateY = 0
  let opacity = 1.0

  if (motion === 'snap_pop') {
    scale = interpolate(popSpring, [0, 1], [0.5, 1.0], { extrapolateRight: 'clamp' })
    opacity = interpolate(currentFrame, [0, 6], [0, 1], { extrapolateRight: 'clamp' })
    translateY = interpolate(popSpring, [0, 1], [40, 0]) + hoverOffset
  } else if (motion === 'macro_slide') {
    scale = interpolate(frame, [0, 60], [1.0, 1.08], { extrapolateRight: 'clamp' })
    translateY = hoverOffset
  } else if (motion === 'subtle_hover') {
    scale = interpolate(frame, [0, 60], [0.98, 1.02])
    translateY = hoverOffset
  } else {
    translateY = hoverOffset
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
      }}
    >
      {/* Isolated Product Asset */}
      <Img
        src={imageUrl}
        style={{
          width: 580,
          height: 580,
          objectFit: 'contain',
          filter:
            'drop-shadow(0 25px 35px rgba(0,0,0,0.65)) drop-shadow(0 10px 15px rgba(0,0,0,0.4))',
          borderRadius: 24,
        }}
      />

      {/* Realistic Soft Contact Shadow */}
      {hasContactShadow && (
        <div
          style={{
            width: 440,
            height: 48,
            marginTop: -20,
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 50%, transparent 75%)',
            borderRadius: '50%',
            filter: 'blur(6px)',
          }}
        />
      )}
    </div>
  )
}
