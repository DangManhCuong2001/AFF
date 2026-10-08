import React from 'react'
import { AbsoluteFill } from 'remotion'
import { CommerceLayoutProps } from './types'
import { ProductPresentationView } from '../components/ProductPresentationView'
import { ModernCleanCommerceTheme } from '../theme/ModernCleanCommerce'

export const HeroOffsetLayout: React.FC<CommerceLayoutProps> = ({
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
        padding: '75px 44px',
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
        {badgeText && (
          <span
            style={{
              display: 'inline-block',
              padding: '6px 18px',
              borderRadius: ModernCleanCommerceTheme.radius.pill,
              backgroundColor: ModernCleanCommerceTheme.colors.surfaceCardElevated,
              border: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorderHighlight}`,
              color: ModernCleanCommerceTheme.colors.accentBrand,
              ...ModernCleanCommerceTheme.typography.badgeText,
              marginBottom: 12,
            }}
          >
            {badgeText}
          </span>
        )}
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

      {/* Asymmetric Offset Product Box */}
      <div
        style={{
          flex: 1,
          margin: '20px 0',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'rotate(-1.5deg)',
        }}
      >
        <ProductPresentationView
          presentation={presentation}
          assetUrl={assetUrl}
          isEntered={productEnterProgress > 0}
          isFocused={focusProgress > 0}
          focusProgress={focusProgress}
          style={{ width: '92%', height: '95%', maxHeight: 920 }}
        />
      </div>

      {/* Bottom Floating Chips */}
      {benefitChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {benefitChips.map((chip, idx) => {
            const isVisible = idx < activeBenefitCount
            return (
              <div
                key={chip}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: `translateY(${isVisible ? 0 : 15}px)`,
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  padding: '12px 22px',
                  borderRadius: ModernCleanCommerceTheme.radius.pill,
                  backgroundColor: ModernCleanCommerceTheme.colors.surfaceGlass,
                  border: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorderHighlight}`,
                  color: ModernCleanCommerceTheme.colors.textPrimary,
                  fontSize: 22,
                  fontWeight: 700,
                  backdropFilter: 'blur(16px)',
                }}
              >
                ⭐ {chip}
              </div>
            )
          })}
        </div>
      )}
    </AbsoluteFill>
  )
}
