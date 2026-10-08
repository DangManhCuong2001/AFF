import React from 'react'
import { SceneContainer } from '../components/SceneContainer'
import { SceneLabel } from '../components/SceneLabel'
import { SceneHeadline } from '../components/SceneHeadline'
import { ProductCloseup } from '../components/ProductCloseup'
import { ProductCard } from '../components/ProductCard'
import { BenefitChipRow } from '../components/BenefitChipRow'
import { SupportText } from '../components/SupportText'

interface BenefitsSceneProps {
  label?: string
  headline: string
  productImageUrl: string
  supportText?: string
  benefitChips?: string[]
  displayMode?: 'closeup' | 'card'
  backgroundUrl?: string
}

export const BenefitsScene: React.FC<BenefitsSceneProps> = ({
  label = 'CHI TIẾT TIỆN LỢI',
  headline,
  productImageUrl,
  supportText,
  benefitChips = ['Đựng gọn', 'Dễ vệ sinh', 'Bếp đẹp hơn'],
  displayMode = 'closeup',
  backgroundUrl,
}) => {
  return (
    <SceneContainer backgroundUrl={backgroundUrl} backgroundDim={0.62}>
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
        <SceneLabel text={label} color="cyan" />
        <SceneHeadline text={headline} />
        {supportText && <SupportText text={supportText} />}
      </div>

      {/* 2. Detail Visual Area (Macro Closeup or Clean Card) */}
      {displayMode === 'closeup' ? (
        <ProductCloseup
          imageUrl={productImageUrl}
          size={480}
          zoomLevel={1.3}
          badgeText="CHI TIẾT THIẾT KẾ"
        />
      ) : (
        <ProductCard
          imageUrl={productImageUrl}
          size={480}
          variant="frosted"
        />
      )}

      {/* 3. Benefit Chips */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <BenefitChipRow chips={benefitChips} />
      </div>
    </SceneContainer>
  )
}
