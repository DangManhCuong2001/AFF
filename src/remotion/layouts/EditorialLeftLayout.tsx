import React from 'react'
import { AbsoluteFill } from 'remotion'
import { CommerceLayoutProps } from './types'
import { ProductPresentationView } from '../components/ProductPresentationView'
import { ModernCleanCommerceTheme } from '../theme/ModernCleanCommerce'

export const EditorialLeftLayout: React.FC<CommerceLayoutProps> = ({
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
        backgroundColor: ModernCleanCommerceTheme.colors.bgDark,
        padding: '70px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: ModernCleanCommerceTheme.typography.fontFamily,
      }}
    >
      {/* Top Left Badge & Hook */}
      <div
        style={{
          opacity: headlineProgress,
          transform: `translateX(${(1 - headlineProgress) * -25}px)`,
          maxWidth: '85%',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 20px',
            borderRadius: ModernCleanCommerceTheme.radius.pill,
            backgroundColor: ModernCleanCommerceTheme.colors.accentRose,
            color: '#FFFFFF',
            ...ModernCleanCommerceTheme.typography.badgeText,
            marginBottom: 16,
            boxShadow: '0 4px 15px rgba(244, 63, 94, 0.4)',
          }}
        >
          {badgeText || 'VẤN ĐỀ HAY GẶP ⚠️'}
        </div>
        {headline && (
          <h1
            style={{
              margin: '0 0 12px 0',
              color: ModernCleanCommerceTheme.colors.textPrimary,
              ...ModernCleanCommerceTheme.typography.headlineMedium,
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

      {/* Product Display Framed Right/Bottom */}
      <div
        style={{
          flex: 1,
          margin: '24px 0',
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
          style={{ width: '100%', height: '100%', maxHeight: 900 }}
        />
      </div>

      {/* Floating Alert or Solution Chips */}
      {benefitChips.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {benefitChips.map((chip, idx) => {
            const isVisible = idx < activeBenefitCount
            return (
              <div
                key={chip}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: `translateX(${isVisible ? 0 : -20}px)`,
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  padding: '12px 22px',
                  borderRadius: ModernCleanCommerceTheme.radius.chip,
                  backgroundColor: ModernCleanCommerceTheme.colors.surfaceGlass,
                  border: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorder}`,
                  color: ModernCleanCommerceTheme.colors.textPrimary,
                  fontSize: 22,
                  fontWeight: 600,
                  backdropFilter: 'blur(12px)',
                }}
              >
                👉 {chip}
              </div>
            )
          })}
        </div>
      )}
    </AbsoluteFill>
  )
}
