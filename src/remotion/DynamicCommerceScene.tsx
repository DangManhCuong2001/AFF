import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { LayoutVariant, ProductPresentation } from '@/engines/core/contracts'
import { VisualBeatEngine } from '@/engines/visual/VisualBeatEngine'
import { VisualBeat } from '@/engines/core/contracts'

import { EditorialTopLayout } from './layouts/EditorialTopLayout'
import { EditorialLeftLayout } from './layouts/EditorialLeftLayout'
import { HeroCenterLayout } from './layouts/HeroCenterLayout'
import { HeroOffsetLayout } from './layouts/HeroOffsetLayout'
import { SplitHorizontalLayout } from './layouts/SplitHorizontalLayout'
import { SplitVerticalLayout } from './layouts/SplitVerticalLayout'
import { DetailFocusLayout } from './layouts/DetailFocusLayout'
import { CommerceOfferLayout } from './layouts/CommerceOfferLayout'

export interface DynamicCommerceSceneProps {
  layoutVariant: LayoutVariant
  presentation: ProductPresentation
  assetUrl: string
  beats?: VisualBeat[]
  headline?: string
  supportText?: string
  benefitChips?: string[]
  badgeText?: string
  priceText?: string
  voucherText?: string
  durationSec?: number
}

export const DynamicCommerceScene: React.FC<DynamicCommerceSceneProps> = ({
  layoutVariant,
  presentation,
  assetUrl,
  beats,
  headline,
  supportText,
  benefitChips = [],
  badgeText,
  priceText,
  voucherText,
  durationSec = 3.5,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Ensure beats exist; generate standard internal motion beats if empty
  const activeBeats =
    beats && beats.length > 0
      ? beats
      : VisualBeatEngine.generateDefaultBeatsForScene(
          'scene-auto',
          durationSec,
          benefitChips.length,
          !!priceText,
          layoutVariant === 'commerce-offer'
        )

  // Evaluate dynamic internal motion state for current frame
  const timeline = VisualBeatEngine.evaluateBeats(activeBeats, frame, fps)

  const commonProps = {
    headline,
    supportText,
    benefitChips,
    presentation,
    assetUrl,
    timeline,
    badgeText,
    priceText,
    voucherText,
  }

  switch (layoutVariant) {
    case 'editorial-top':
      return <EditorialTopLayout {...commonProps} />
    case 'editorial-left':
      return <EditorialLeftLayout {...commonProps} />
    case 'hero-center':
      return <HeroCenterLayout {...commonProps} />
    case 'hero-offset':
      return <HeroOffsetLayout {...commonProps} />
    case 'split-horizontal':
      return <SplitHorizontalLayout {...commonProps} />
    case 'split-vertical':
      return <SplitVerticalLayout {...commonProps} />
    case 'detail-focus':
      return <DetailFocusLayout {...commonProps} />
    case 'commerce-offer':
      return <CommerceOfferLayout {...commonProps} />
    default:
      return <HeroCenterLayout {...commonProps} />
  }
}
