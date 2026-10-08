import React from 'react'

interface GradientOverlayProps {
  topHeight?: number
  bottomHeight?: number
  opacity?: number
}

/**
 * Top and bottom cinematic gradient overlays to guarantee 100% text readability
 * across any bright or cluttered background images, while respecting TikTok UI safe zones.
 */
export const GradientOverlay: React.FC<GradientOverlayProps> = ({
  topHeight = 360,
  bottomHeight = 440,
  opacity = 0.85,
}) => {
  return (
    <>
      {/* Top subtle readability gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: topHeight,
          background: `linear-gradient(180deg, rgba(9, 9, 11, ${opacity * 0.95}) 0%, rgba(9, 9, 11, ${opacity * 0.5}) 55%, transparent 100%)`,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Bottom subtle readability gradient for TikTok captions and CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: bottomHeight,
          background: `linear-gradient(0deg, rgba(9, 9, 11, ${opacity}) 0%, rgba(9, 9, 11, ${opacity * 0.65}) 50%, transparent 100%)`,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </>
  )
}
