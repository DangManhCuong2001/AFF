import React from 'react'
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { VisualBeat } from '@/engines/visual/types'
import { ProductCutout } from './ProductCutout'
import { AnimatedCaption } from './AnimatedCaption'
import { CTAEndCard } from './CTAEndCard'

interface DynamicSceneProps {
  beat: VisualBeat
  productName: string
  priceText?: string
  isLastScene: boolean
}

export const DynamicScene: React.FC<DynamicSceneProps> = ({
  beat,
  productName,
  priceText,
  isLastScene,
}) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const { layers, cameraMotion, productVisible, productRevealDelaySec } = beat

  // 1. Camera Motion for Background Parallax
  const bgScale = interpolate(
    frame,
    [0, durationInFrames],
    [layers.background.transform.scaleStart, layers.background.transform.scaleEnd]
  )
  const bgTranslateX = interpolate(
    frame,
    [0, durationInFrames],
    [layers.background.transform.translateXStart, layers.background.transform.translateXEnd]
  )
  const bgTranslateY = interpolate(
    frame,
    [0, durationInFrames],
    [layers.background.transform.translateYStart, layers.background.transform.translateYEnd]
  )

  const revealDelayFrames = Math.round((productRevealDelaySec || 0) * fps)
  const shouldShowProduct = productVisible && (revealDelayFrames === 0 || frame >= revealDelayFrames)

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b', overflow: 'hidden' }}>
      {/* Layer 1: Contextual Environment Background with Parallax */}
      <AbsoluteFill
        style={{
          transform: `scale(${bgScale}) translate(${bgTranslateX}px, ${bgTranslateY}px)`,
        }}
      >
        {layers.background.url ? (
          <Img
            src={layers.background.url}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.65) saturate(1.1)',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle at center, #1e293b 0%, #09090b 100%)',
            }}
          />
        )}
      </AbsoluteFill>

      {/* Layer 2: Subtle Ambient Vignette & Gradient */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(9,9,11,0.6) 0%, transparent 25%, transparent 75%, rgba(9,9,11,0.85) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Layer 3: Product Asset / Cutout with Realistic Shadow */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 160,
        }}
      >
        {shouldShowProduct && (
          <ProductCutout
            imageUrl={layers.product.url}
            motion={layers.product.motion}
            hasContactShadow={layers.product.hasContactShadow}
            revealDelayFrames={revealDelayFrames}
          />
        )}
      </AbsoluteFill>

      {/* Layer 4: Top & Middle Subtitles / Kinetic Typography */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          paddingTop: 180,
          pointerEvents: 'none',
        }}
      >
        <AnimatedCaption
          badgeText={layers.typography.badgeText}
          subtitleText={layers.typography.subtitleText}
          emphasisWord={layers.typography.emphasisWord}
          emphasisRevealDelayFrames={
            layers.typography.emphasisRevealDelaySec
              ? Math.round(layers.typography.emphasisRevealDelaySec * fps)
              : 15
          }
        />
      </AbsoluteFill>

      {/* Layer 5: TikTok Shop CTA End Card (Shown on last scenes or continuous) */}
      {(isLastScene || beat.shotType === 'CTAShot') && (
        <CTAEndCard productName={productName} priceText={priceText} />
      )}
    </AbsoluteFill>
  )
}
