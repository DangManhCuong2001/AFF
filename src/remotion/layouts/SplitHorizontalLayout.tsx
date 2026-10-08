import React from 'react'
import { AbsoluteFill } from 'remotion'
import { CommerceLayoutProps } from './types'
import { ProductPresentationView } from '../components/ProductPresentationView'
import { ModernCleanCommerceTheme } from '../theme/ModernCleanCommerce'

export const SplitHorizontalLayout: React.FC<CommerceLayoutProps> = ({
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
        fontFamily: ModernCleanCommerceTheme.typography.fontFamily,
      }}
    >
      {/* Top Half: Context / Typography */}
      <div
        style={{
          height: '42%',
          padding: '80px 48px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderBottom: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorder}`,
          opacity: headlineProgress,
          transform: `translateY(${(1 - headlineProgress) * 20}px)`,
        }}
      >
        {badgeText && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '6px 18px',
              borderRadius: ModernCleanCommerceTheme.radius.pill,
              backgroundColor: ModernCleanCommerceTheme.colors.accentBrand,
              color: '#000000',
              ...ModernCleanCommerceTheme.typography.badgeText,
              marginBottom: 12,
            }}
          >
            {badgeText}
          </div>
        )}
        {headline && (
          <h1
            style={{
              margin: '0 0 12px 0',
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

      {/* Bottom Half: Full Product Framing */}
      <div
        style={{
          height: '58%',
          padding: '32px 48px 60px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <ProductPresentationView
            presentation={presentation}
            assetUrl={assetUrl}
            isEntered={productEnterProgress > 0}
            isFocused={focusProgress > 0}
            focusProgress={focusProgress}
          />
        </div>

        {benefitChips.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            {benefitChips.map((chip, idx) => {
              const isVisible = idx < activeBenefitCount
              return (
                <div
                  key={chip}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: `scale(${isVisible ? 1 : 0.9})`,
                    padding: '10px 20px',
                    borderRadius: ModernCleanCommerceTheme.radius.pill,
                    backgroundColor: ModernCleanCommerceTheme.colors.surfaceGlass,
                    border: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorderHighlight}`,
                    color: ModernCleanCommerceTheme.colors.textPrimary,
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  ✓ {chip}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}
