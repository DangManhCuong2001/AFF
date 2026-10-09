import React from 'react'
import { SceneContainer } from '../components/SceneContainer'
import { SceneLabel } from '../components/SceneLabel'
import { SceneHeadline } from '../components/SceneHeadline'
import { ProductCard } from '../components/ProductCard'
import { BenefitChipRow } from '../components/BenefitChipRow'
import { SupportText } from '../components/SupportText'

interface ResultSceneProps {
  label?: string
  headline: string
  productImageUrl: string
  supportText?: string
  resultChips?: string[]
  backgroundUrl?: string
}

export const ResultScene: React.FC<ResultSceneProps> = ({
  label = 'KẾT QUẢ THỎA MÃN',
  headline,
  productImageUrl,
  supportText = 'Không gian ngăn nắp, cuộc sống tiện nghi hơn',
  resultChips = ['Gọn gàng 100%', 'Thẩm mỹ tiện nghi'],
  backgroundUrl,
}) => {
  return (
    <SceneContainer backgroundUrl={backgroundUrl} backgroundDim={0.55}>
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
        <SceneLabel text={label} color="emerald" />
        <SceneHeadline text={headline} />
        {supportText && <SupportText text={supportText} />}
      </div>

      {/* 2. Clean Product Display in Lifestyle Context */}
      <ProductCard
        imageUrl={productImageUrl}
        size={490}
        variant="frosted"
      />

      {/* 3. Result Payoff Chips */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <BenefitChipRow chips={resultChips} />
      </div>
    </SceneContainer>
  )
}
