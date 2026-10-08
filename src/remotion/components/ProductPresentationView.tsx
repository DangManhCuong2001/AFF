import React from 'react'
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { ProductPresentation } from '@/engines/core/contracts'
import { ProductPresentationResolver } from '@/engines/assets/ProductPresentationResolver'

interface ProductPresentationViewProps {
  presentation: ProductPresentation
  assetUrl: string
  isEntered?: boolean
  isFocused?: boolean
  focusProgress?: number
  className?: string
  style?: React.CSSProperties
}

export const ProductPresentationView: React.FC<ProductPresentationViewProps> = ({
  presentation,
  assetUrl,
  isEntered = true,
  isFocused = false,
  focusProgress = 0,
  style,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enterSpring = spring({
    frame: isEntered ? frame : 0,
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.7 },
  })

  // Subtle continuous breathing motion so the visual never freezes
  const breathe = Math.sin((frame / fps) * 2.2) * 0.015

  const resolved = ProductPresentationResolver.resolve(presentation, {
    focusActive: isFocused,
    focusZoomBonus: focusProgress * 0.12,
  })

  const enterScale = interpolate(enterSpring, [0, 1], [0.82, 1.0], {
    extrapolateRight: 'clamp',
  })
  const enterOpacity = interpolate(enterSpring, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const enterTranslateY = interpolate(enterSpring, [0, 1], [30, 0], {
    extrapolateRight: 'clamp',
  })

  const combinedContainerStyle: React.CSSProperties = {
    ...resolved.containerStyle,
    transform: `scale(${enterScale * (1 + breathe)}) translateY(${enterTranslateY}px)`,
    opacity: enterOpacity,
    ...style,
  }

  return (
    <div style={combinedContainerStyle}>
      <Img
        src={assetUrl}
        alt="Product presentation"
        style={resolved.imageStyle}
      />
      {resolved.isMacro && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            padding: '6px 14px',
            borderRadius: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.04em',
            backdropFilter: 'blur(8px)',
          }}
        >
          CHI TIẾT 1.5X
        </div>
      )}
    </div>
  )
}
