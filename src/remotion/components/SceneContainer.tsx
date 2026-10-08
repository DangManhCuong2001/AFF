import React from 'react'
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { GradientOverlay } from './GradientOverlay'

interface SceneContainerProps {
  children: React.ReactNode
  backgroundUrl?: string
  backgroundDim?: number // 0.0 to 1.0, default 0.6
  backgroundBlur?: number // px
  bgScaleStart?: number
  bgScaleEnd?: number
}

export const SceneContainer: React.FC<SceneContainerProps> = ({
  children,
  backgroundUrl,
  backgroundDim = 0.62,
  backgroundBlur = 0,
  bgScaleStart = 1.0,
  bgScaleEnd = 1.08,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  // Slow, smooth background zoom (Ken Burns)
  const bgScale = interpolate(
    frame,
    [0, durationInFrames],
    [bgScaleStart, bgScaleEnd],
    { extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b', overflow: 'hidden' }}>
      {/* 1. Contextual Environment Background with Slow Parallax Zoom */}
      <AbsoluteFill style={{ transform: `scale(${bgScale})` }}>
        {backgroundUrl ? (
          <Img
            src={backgroundUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: `brightness(${1 - backgroundDim}) saturate(1.15) ${
                backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : ''
              }`,
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background:
                'radial-gradient(circle at 50% 35%, #1f2937 0%, #09090b 100%)',
            }}
          />
        )}
      </AbsoluteFill>

      {/* 2. Top & Bottom Readability Gradient Overlays */}
      <GradientOverlay />

      {/* 3. TikTok Safe Zone Foreground Content Container */}
      <AbsoluteFill
        style={{
          paddingTop: 130,
          paddingBottom: 170,
          paddingLeft: 44,
          paddingRight: 44,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 3,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
