import React from 'react'
import { SceneContainer } from '../components/SceneContainer'
import { SceneLabel } from '../components/SceneLabel'
import { SceneHeadline } from '../components/SceneHeadline'
import { ProductCard } from '../components/ProductCard'
import { BenefitChipRow } from '../components/BenefitChipRow'

interface ProductRevealSceneProps {
  label?: string
  headline: string
  productImageUrl: string
  benefitChips?: string[]
  backgroundUrl?: string
  productCardVariant?: 'frosted' | 'clean_white'
}

export const ProductRevealScene: React.FC<ProductRevealSceneProps> = ({
  label = 'GIẢI PHÁP MỚI',
  headline,
  productImageUrl,
  benefitChips = ['Chống ẩm', 'Gọn hơn', 'Dễ lấy'],
  backgroundUrl,
  productCardVariant = 'frosted',
}) => {
  return (
    <SceneContainer backgroundUrl={backgroundUrl} backgroundDim={0.58}>
      {/* 1. Top Header */}
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
        <SceneLabel text={label} color="amber" />
        <SceneHeadline text={headline} />
      </div>

      {/* 2. Center Hero Product Card */}
      <ProductCard
        imageUrl={productImageUrl}
        size={500}
        variant={productCardVariant}
      />

      {/* 3. Bottom Benefit Chips */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <BenefitChipRow chips={benefitChips} />
      </div>
    </SceneContainer>
  )
}
