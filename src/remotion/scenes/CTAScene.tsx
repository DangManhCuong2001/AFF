import React from 'react'
import { SceneContainer } from '../components/SceneContainer'
import { SceneLabel } from '../components/SceneLabel'
import { SceneHeadline } from '../components/SceneHeadline'
import { ProductCard } from '../components/ProductCard'
import { OfferCard } from '../components/OfferCard'
import { CTAButton } from '../components/CTAButton'

interface CTASceneProps {
  label?: string
  headline: string
  productImageUrl: string
  priceText?: string
  voucherText?: string
  ctaLabel?: string
  backgroundUrl?: string
}

export const CTAScene: React.FC<CTASceneProps> = ({
  label = 'TIKTOK SHOP ƯU ĐÃI',
  headline = 'Xem ngay ở giỏ hàng góc trái',
  productImageUrl,
  priceText,
  voucherText,
  ctaLabel = 'Xem ở giỏ hàng góc trái',
  backgroundUrl,
}) => {
  return (
    <SceneContainer backgroundUrl={backgroundUrl} backgroundDim={0.65}>
      {/* 1. Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          textAlign: 'center',
          marginTop: 10,
        }}
      >
        <SceneLabel text={label} color="rose" />
        <SceneHeadline text={headline} />
      </div>

      {/* 2. Compact Product Preview */}
      <ProductCard
        imageUrl={productImageUrl}
        size={420}
        variant="frosted"
      />

      {/* 3. Offer & CTA Area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
          width: '100%',
        }}
      >
        {(priceText || voucherText) && (
          <OfferCard price={priceText} voucher={voucherText} />
        )}
        <CTAButton label={ctaLabel} priceText={priceText ? undefined : undefined} />
      </div>
    </SceneContainer>
  )
}
