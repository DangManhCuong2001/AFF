import React from 'react'
import { VisualBeat } from '@/engines/visual/types'
import { ProblemScene } from './scenes/ProblemScene'
import { ProductRevealScene } from './scenes/ProductRevealScene'
import { BenefitsScene } from './scenes/BenefitsScene'
import { ResultScene } from './scenes/ResultScene'
import { CTAScene } from './scenes/CTAScene'

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
  const {
    shotType,
    sceneTemplate,
    layers,
    label,
    headline,
    supportText,
    benefitChips,
    offer,
  } = beat

  const bgUrl = layers.background.url
  const productImgUrl = layers.product.url

  // Resolve Headline: Prefer beat.headline, then typography subtitleText, then fallback
  const resolvedHeadline =
    headline ||
    layers.typography.subtitleText ||
    `Khám phá ${productName}`

  // Determine Effective Scene Template
  const effectiveTemplate =
    sceneTemplate ||
    (isLastScene || shotType === 'CTAShot' || shotType === 'OfferShot'
      ? 'cta'
      : shotType === 'ProblemCloseup' || (shotType === 'EstablishingShot' && !beat.productVisible)
      ? 'problem'
      : shotType === 'ProductRevealShot' || shotType === 'EstablishingShot'
      ? 'reveal'
      : shotType === 'DemoShot' || shotType === 'DetailShot' || shotType === 'MacroProductShot'
      ? 'benefits'
      : shotType === 'ResultShot' || shotType === 'BeforeAfterShot'
      ? 'result'
      : 'reveal')

  // 1. Problem Scene
  if (effectiveTemplate === 'problem') {
    return (
      <ProblemScene
        label={label || layers.typography.badgeText || 'VẤN ĐỀ HAY GẶP'}
        headline={resolvedHeadline}
        supportText={supportText}
        backgroundUrl={bgUrl}
      />
    )
  }

  // 2. Product Reveal Scene
  if (effectiveTemplate === 'reveal') {
    return (
      <ProductRevealScene
        label={label || layers.typography.badgeText || 'GIẢI PHÁP MỚI'}
        headline={resolvedHeadline}
        productImageUrl={productImgUrl}
        benefitChips={benefitChips || ['Chống ẩm', 'Gọn hơn', 'Dễ lấy']}
        backgroundUrl={bgUrl}
      />
    )
  }

  // 3. Benefits / Demo Scene
  if (effectiveTemplate === 'benefits') {
    return (
      <BenefitsScene
        label={label || layers.typography.badgeText || 'CHI TIẾT TIỆN LỢI'}
        headline={resolvedHeadline}
        productImageUrl={productImgUrl}
        supportText={supportText}
        benefitChips={benefitChips || ['Đựng gọn', 'Dễ vệ sinh', 'Bếp đẹp hơn']}
        displayMode={beat.productDisplayMode === 'closeup' ? 'closeup' : 'card'}
        backgroundUrl={bgUrl}
      />
    )
  }

  // 4. Result Scene
  if (effectiveTemplate === 'result') {
    return (
      <ResultScene
        label={label || layers.typography.badgeText || 'KẾT QUẢ THỎA MÃN'}
        headline={resolvedHeadline}
        productImageUrl={productImgUrl}
        supportText={supportText}
        resultChips={benefitChips || ['Gọn gàng 100%', 'Bếp thẩm mỹ hơn']}
        backgroundUrl={bgUrl}
      />
    )
  }

  // 5. Offer / CTA Scene (Last Scene or explicit CTA)
  return (
    <CTAScene
      label={label || layers.typography.badgeText || 'TIKTOK SHOP ƯU ĐÃI'}
      headline={resolvedHeadline}
      productImageUrl={productImgUrl}
      priceText={offer?.price || priceText}
      voucherText={offer?.voucher}
      ctaLabel={offer?.ctaText || 'Xem ở giỏ hàng góc trái'}
      backgroundUrl={bgUrl}
    />
  )
}
