import React from 'react'
import { AbsoluteFill } from 'remotion'
import { CommerceLayoutProps } from './types'
import { ProductPresentationView } from '../components/ProductPresentationView'
import { ModernCleanCommerceTheme } from '../theme/ModernCleanCommerce'

export const HeroCenterLayout: React.FC<CommerceLayoutProps> = ({
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
        padding: '80px 44px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: ModernCleanCommerceTheme.typography.fontFamily,
      }}
    >
      {/* Top Floating Pill Badge */}
      <div
        style={{
          opacity: headlineProgress,
          transform: `scale(${0.9 + headlineProgress * 0.1})`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            padding: '8px 24px',
            borderRadius: ModernCleanCommerceTheme.radius.pill,
            backgroundColor: ModernCleanCommerceTheme.colors.accentEmerald,
            color: '#FFFFFF',
            ...ModernCleanCommerceTheme.typography.badgeText,
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.45)',
          }}
        >
          {badgeText || 'GIẢI PHÁP GỌN GÀNG ✨'}
        </div>
        {headline && (
          <h1
            style={{
              margin: 0,
              color: ModernCleanCommerceTheme.colors.textPrimary,
              ...ModernCleanCommerceTheme.typography.headlineLarge,
              textAlign: 'center',
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
              textAlign: 'center',
            }}
          >
            {supportText}
          </p>
        )}
      </div>

      {/* Hero Center Product Card with Halo Glow */}
      <div
        style={{
          width: '100%',
          flex: 1,
          margin: '28px 0',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Halo Glow */}
        <div
          style={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <ProductPresentationView
          presentation={presentation}
          assetUrl={assetUrl}
          isEntered={productEnterProgress > 0}
          isFocused={focusProgress > 0}
          focusProgress={focusProgress}
          style={{ width: '100%', height: '100%', maxHeight: 950 }}
        />
      </div>

      {/* Bottom Benefit Chips */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {benefitChips.map((chip, idx) => {
          const isVisible = idx < activeBenefitCount
          return (
            <div
              key={chip}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: `scale(${isVisible ? 1 : 0.85})`,
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                padding: '12px 24px',
                borderRadius: ModernCleanCommerceTheme.radius.pill,
                backgroundColor: ModernCleanCommerceTheme.colors.surfaceGlass,
                border: `1px solid ${ModernCleanCommerceTheme.colors.surfaceBorderHighlight}`,
                color: ModernCleanCommerceTheme.colors.textPrimary,
                fontSize: 24,
                fontWeight: 700,
                backdropFilter: 'blur(16px)',
              }}
            >
              ✅ {chip}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
