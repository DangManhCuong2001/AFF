import React from 'react'
import { AbsoluteFill } from 'remotion'
import { CommerceLayoutProps } from './types'
import { ProductPresentationView } from '../components/ProductPresentationView'
import { ModernCleanCommerceTheme } from '../theme/ModernCleanCommerce'

export const SplitVerticalLayout: React.FC<CommerceLayoutProps> = ({
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
        padding: '80px 40px',
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
              padding: '6px 16px',
              borderRadius: ModernCleanCommerceTheme.radius.pill,
              backgroundColor: ModernCleanCommerceTheme.colors.accentBrand,
              color: '#000000',
              ...ModernCleanCommerceTheme.typography.badgeText,
              marginBottom: 10,
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
              ...ModernCleanCommerceTheme.typography.headlineMedium,
            }}
          >
            {headline}
          </h1>
        )}
      </div>

      {/* Vertical Split Center: Left Details + Right Product */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 24,
          margin: '24px 0',
          alignItems: 'center',
        }}
      >
        {/* Left Column: Chips & Explanations */}
        <div
          style={{
            width: '42%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {supportText && (
            <p
              style={{
                margin: 0,
                color: ModernCleanCommerceTheme.colors.textSecondary,
                fontSize: 24,
                lineHeight: 1.3,
              }}
            >
              {supportText}
            </p>
          )}
          {benefitChips.map((chip, idx) => {
            const isVisible = idx < activeBenefitCount
            return (
              <div
                key={chip}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: `translateX(${isVisible ? 0 : -15}px)`,
                  padding: '12px 18px',
                  borderRadius: ModernCleanCommerceTheme.radius.chip,
                  backgroundColor: ModernCleanCommerceTheme.colors.surfaceCardElevated,
                  border: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorder}`,
                  color: ModernCleanCommerceTheme.colors.textPrimary,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                🔹 {chip}
              </div>
            )
          })}
        </div>

        {/* Right Column: Product Presentation Card */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <ProductPresentationView
            presentation={presentation}
            assetUrl={assetUrl}
            isEntered={productEnterProgress > 0}
            isFocused={focusProgress > 0}
            focusProgress={focusProgress}
          />
        </div>
      </div>
    </AbsoluteFill>
  )
}
