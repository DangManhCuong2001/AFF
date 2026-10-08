import React from 'react'
import { AbsoluteFill } from 'remotion'
import { CommerceLayoutProps } from './types'
import { ProductPresentationView } from '../components/ProductPresentationView'
import { ModernCleanCommerceTheme } from '../theme/ModernCleanCommerce'

export const CommerceOfferLayout: React.FC<CommerceLayoutProps> = ({
  headline,
  supportText,
  presentation,
  assetUrl,
  timeline,
  badgeText,
  priceText,
  voucherText,
}) => {
  const { headlineProgress, productEnterProgress, priceProgress, ctaProgress, focusProgress } = timeline

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
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 24px',
            borderRadius: ModernCleanCommerceTheme.radius.pill,
            backgroundColor: ModernCleanCommerceTheme.colors.accentAmber,
            color: '#000000',
            ...ModernCleanCommerceTheme.typography.badgeText,
            marginBottom: 12,
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.45)',
          }}
        >
          {badgeText || 'ƯU ĐÃI HÔM NAY 🔥'}
        </div>
        {headline && (
          <h1
            style={{
              margin: '0 0 8px 0',
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

      {/* Center Compact Product View */}
      <div
        style={{
          flex: 1,
          margin: '20px 0',
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
          style={{ width: '85%', height: '85%', maxHeight: 780 }}
        />
      </div>

      {/* Big Deal Card with Price & Voucher & TikTok Cart Pointer */}
      <div
        style={{
          opacity: Math.max(priceProgress, ctaProgress),
          transform: `scale(${0.9 + Math.max(priceProgress, ctaProgress) * 0.1})`,
          padding: '24px 32px',
          borderRadius: ModernCleanCommerceTheme.radius.card,
          backgroundColor: ModernCleanCommerceTheme.colors.surfaceGlass,
          border: '1.5px solid rgba(255, 255, 255, 0.2)',
          boxShadow: ModernCleanCommerceTheme.shadows.heroCard,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, color: ModernCleanCommerceTheme.colors.textMuted, fontWeight: 600 }}>
              GIÁ ƯU ĐÃI CHỈ
            </div>
            <div style={{ color: '#FACC15', ...ModernCleanCommerceTheme.typography.priceLarge }}>
              {priceText || '89.000đ'}
            </div>
          </div>
          {voucherText && (
            <div
              style={{
                padding: '10px 18px',
                borderRadius: ModernCleanCommerceTheme.radius.pill,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#F87171',
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              🎟️ {voucherText}
            </div>
          )}
        </div>

        {/* CTA Banner pointing to bottom left TikTok cart */}
        <div
          style={{
            padding: '14px 20px',
            borderRadius: ModernCleanCommerceTheme.radius.pill,
            backgroundColor: '#FFFFFF',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontSize: 24,
            fontWeight: 800,
            boxShadow: '0 8px 24px rgba(255, 255, 255, 0.3)',
          }}
        >
          <span>👇 BẤM GIỎ HÀNG GÓC TRÁI MUA NGAY</span>
        </div>
      </div>
    </AbsoluteFill>
  )
}
