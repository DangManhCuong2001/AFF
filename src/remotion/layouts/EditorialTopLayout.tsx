import React from 'react'
import { AbsoluteFill } from 'remotion'
import { CommerceLayoutProps } from './types'
import { ProductPresentationView } from '../components/ProductPresentationView'
import { ModernCleanCommerceTheme } from '../theme/ModernCleanCommerce'

export const EditorialTopLayout: React.FC<CommerceLayoutProps> = ({
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
      {/* Top Editorial Header */}
      <div
        style={{
          opacity: headlineProgress,
          transform: `translateY(${(1 - headlineProgress) * 20}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {badgeText && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '8px 18px',
              borderRadius: ModernCleanCommerceTheme.radius.pill,
              backgroundColor: ModernCleanCommerceTheme.colors.surfaceCardElevated,
              border: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorderHighlight}`,
              color: ModernCleanCommerceTheme.colors.accentBrand,
              ...ModernCleanCommerceTheme.typography.badgeText,
            }}
          >
            {badgeText}
          </div>
        )}
        {headline && (
          <h1
            style={{
              margin: 0,
              color: ModernCleanCommerceTheme.colors.textPrimary,
              ...ModernCleanCommerceTheme.typography.headlineLarge,
              textShadow: '0 4px 20px rgba(0,0,0,0.6)',
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

      {/* Center/Lower Product Area */}
      <div
        style={{
          flex: 1,
          margin: '36px 0',
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
          isFocused={focusProgress > 0}
          focusProgress={focusProgress}
          style={{ width: '100%', height: '100%', maxHeight: 920 }}
        />
      </div>

      {/* Staggered Benefit Chips at bottom */}
      {benefitChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {benefitChips.map((chip, idx) => {
            const isVisible = idx < activeBenefitCount
            return (
              <div
                key={chip}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: `translateY(${isVisible ? 0 : 15}px) scale(${isVisible ? 1 : 0.9})`,
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  padding: '12px 24px',
                  borderRadius: ModernCleanCommerceTheme.radius.pill,
                  backgroundColor: ModernCleanCommerceTheme.colors.surfaceGlass,
                  border: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorderHighlight}`,
                  color: ModernCleanCommerceTheme.colors.textPrimary,
                  fontSize: 24,
                  fontWeight: 700,
                  backdropFilter: 'blur(16px)',
                  boxShadow: ModernCleanCommerceTheme.shadows.floatingPill,
                }}
              >
                ✨ {chip}
              </div>
            )
          })}
        </div>
      )}
    </AbsoluteFill>
  )
}
