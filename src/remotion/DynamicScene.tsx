import React from 'react'
import { DynamicCommerceScene } from './DynamicCommerceScene'
import { StoryplanBeat, LayoutVariant, ProductPresentation, VisualBeat } from './remotion-types'

interface DynamicSceneProps {
  beat: StoryplanBeat
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
  const {
    shotType,
    sceneTemplate,
    layers,
    label,
    headline,
    supportText,
    benefitChips = [],
    offer,
  } = beat

  const productImgUrl = layers?.product?.url || '/placeholders/product-hero.png'

  // Resolve Headline
  const resolvedHeadline =
    headline ||
    layers?.typography?.subtitleText ||
    `Khám phá ${productName}`

  // Map to LayoutVariant (Decoupling SceneType from LayoutVariant)
  let layoutVariant: LayoutVariant = 'hero-center'

  if (isLastScene || shotType === 'CTAShot' || shotType === 'OfferShot' || sceneTemplate === 'cta') {
    layoutVariant = 'commerce-offer'
  } else if (sceneTemplate === 'problem' || shotType === 'ProblemCloseup') {
    // Alternate between editorial-left and editorial-top
    layoutVariant = 'editorial-left'
  } else if (sceneTemplate === 'benefits' || shotType === 'DetailShot' || shotType === 'MacroProductShot') {
    layoutVariant = 'detail-focus'
  } else if (sceneTemplate === 'result' || shotType === 'ResultShot') {
    layoutVariant = 'hero-offset'
  } else if (shotType === 'BeforeAfterShot') {
    layoutVariant = 'split-horizontal'
  } else {
    layoutVariant = 'hero-center'
  }

  // Map to ProductPresentation
  const presentation: ProductPresentation = {
    type:
      layoutVariant === 'detail-focus'
        ? 'detail-focus'
        : layoutVariant === 'commerce-offer'
        ? 'floating-product'
        : layoutVariant === 'editorial-left'
        ? 'smart-crop'
        : 'hero-card',
    assetId: beat.id,
    zoom: layoutVariant === 'detail-focus' ? 1.3 : 1.05,
  }

  // Adapt visual beats to internal motion beats
  const contractBeats: VisualBeat[] = [
    {
      id: `${beat.id}-b0`,
      atMs: 0,
      type: 'headline-enter',
      payload: {},
    },
    {
      id: `${beat.id}-b1`,
      atMs: 350,
      type: 'product-enter',
      payload: {},
    },
    ...benefitChips.map((chip, idx) => ({
      id: `${beat.id}-benefit-${idx}`,
      atMs: 1000 + idx * 700,
      type: 'benefit-enter' as const,
      payload: { chip },
    })),
    {
      id: `${beat.id}-focus`,
      atMs: Math.round(beat.durationSec * 600),
      type: 'product-focus',
      payload: {},
    },
  ]

  return (
    <DynamicCommerceScene
      layoutVariant={layoutVariant}
      presentation={presentation}
      assetUrl={productImgUrl}
      beats={contractBeats}
      headline={resolvedHeadline}
      supportText={supportText}
      benefitChips={benefitChips}
      badgeText={label || layers?.typography?.badgeText}
      priceText={offer?.price || priceText}
      voucherText={offer?.voucher}
      durationSec={beat.durationSec || 3.5}
    />
  )
}
