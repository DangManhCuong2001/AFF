import React from 'react'
import { AbsoluteFill } from 'remotion'
import { CommerceLayoutProps } from './types'
import { ProductPresentationView } from '../components/ProductPresentationView'
import { ModernCleanCommerceTheme } from '../theme/ModernCleanCommerce'

export const DetailFocusLayout: React.FC<CommerceLayoutProps> = ({
  headline,
  supportText,
  benefitChips = [],
  presentation,
  assetUrl,
  timeline,
  badgeText,
}) => {
  const { headlineProgress, productEnterProgress, activeBenefitCount, focusProgress } = timeline

  return (
    <AbsoluteFill
      style={{
        backgroundColor: ModernCleanCommerceTheme.colors.bgNoir,
        padding: '80px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: ModernCleanCommerceTheme.typography.fontFamily,
      }}
    >
      {/* Top Header */}
      <div
        style={{
          opacity: headlineProgress,
          transform: `translateY(${(1 - headlineProgress) * 20}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 20px',
            borderRadius: ModernCleanCommerceTheme.radius.pill,
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            color: ModernCleanCommerceTheme.colors.accentBrand,
            ...ModernCleanCommerceTheme.typography.badgeText,
            marginBottom: 14,
          }}
        >
          {badgeText || 'CHI TIẾT ĐẮT GIÁ 🔍'}
        </div>
        {headline && (
          <h1
            style={{
              margin: '0 0 10px 0',
              color: ModernCleanCommerceTheme.colors.textPrimary,
              ...ModernCleanCommerceTheme.typography.headlineLarge,
            }}
          >
            {headline}
          </h1>
        )}
        {supportText && (
          <p
            style={{
              margin: 0,
              color: ModernCleanCommerceTheme.colors.textSecondary,
              ...ModernCleanCommerceTheme.typography.supportText,
            }}
          >
            {supportText}
          </p>
        )}
      </div>

      {/* Center Macro Detail Focus Frame */}
      <div
        style={{
          flex: 1,
          margin: '32px 0',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ProductPresentationView
          presentation={presentation}
          assetUrl={assetUrl}
          isEntered={productEnterProgress > 0}
          isFocused={true}
          focusProgress={focusProgress}
          style={{ width: '100%', height: '100%', maxHeight: 920 }}
        />
      </div>

      {/* Floating Detail Chips */}
      {benefitChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {benefitChips.map((chip, idx) => {
            const isVisible = idx < activeBenefitCount
            return (
              <div
                key={chip}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: `scale(${isVisible ? 1 : 0.85})`,
                  padding: '12px 24px',
                  borderRadius: ModernCleanCommerceTheme.radius.pill,
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  border: `1.5px solid ${ModernCleanCommerceTheme.colors.accentBrand}`,
                  color: '#FFFFFF',
                  fontSize: 24,
                  fontWeight: 800,
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 8px 24px rgba(56, 189, 248, 0.25)',
                }}
              >
                🔎 {chip}
              </div>
            )
          })}
        </div>
      )}
    </AbsoluteFill>
  )
}
