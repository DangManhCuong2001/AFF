'use client'

import React from 'react'
import {
  InfographicCardData,
  InfographicTheme,
} from '@/engines/infographic/types'
import {
  Shield,
  Hand,
  Package,
  Sparkles,
  Zap,
  Clock,
  CheckCircle2,
  Leaf,
  ShoppingCart,
  ChevronRight,
} from 'lucide-react'

interface InfographicCardRendererProps {
  card: InfographicCardData
  theme: InfographicTheme
  width?: number
  height?: number
  scale?: number
}

// Icon mapper
const renderIcon = (iconName: string, color: string = '#FFFFFF') => {
  const size = 18
  switch (iconName) {
    case 'shield':
      return <Shield size={size} color={color} strokeWidth={2.2} />
    case 'touch':
      return <Hand size={size} color={color} strokeWidth={2.2} />
    case 'box':
      return <Package size={size} color={color} strokeWidth={2.2} />
    case 'sparkle':
      return <Sparkles size={size} color={color} strokeWidth={2.2} />
    case 'zap':
      return <Zap size={size} color={color} strokeWidth={2.2} />
    case 'clock':
      return <Clock size={size} color={color} strokeWidth={2.2} />
    case 'leaf':
      return <Leaf size={size} color={color} strokeWidth={2.2} />
    default:
      return <CheckCircle2 size={size} color={color} strokeWidth={2.2} />
  }
}

export const InfographicCardRenderer: React.FC<InfographicCardRendererProps> = ({
  card,
  theme,
  width = 450,
  height = 800,
}) => {
  const {
    stepNumber,
    stepLabel,
    headline,
    highlightWord,
    subtitle,
    layoutVariant,
    productImageUrl,
    featureChips,
    stickers,
    accentEffect,
    offer,
  } = card

  // Helper to highlight specific words in headline
  const renderHeadline = () => {
    if (!highlightWord) {
      return <span>{headline}</span>
    }

    const parts = headline.split(new RegExp(`(${highlightWord})`, 'gi'))
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = part.toLowerCase() === highlightWord.toLowerCase()
          return isMatch ? (
            <span
              key={i}
              style={{
                color: theme.accentColor,
                fontWeight: 900,
              }}
            >
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        })}
      </>
    )
  }

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: theme.surfaceBg,
        position: 'relative',
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow:
          '0 20px 45px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        border: `1px solid ${theme.borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 28px 30px',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER: Step Badge, Headline, Subtitle */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 12,
          zIndex: 10,
        }}
      >
        {/* Step Badge (Circle with number + dark pill) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.badgeBg,
            borderRadius: 9999,
            padding: '5px 14px 5px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: theme.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {stepNumber}
          </div>
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {stepLabel}
          </span>
        </div>

        {/* Main Headline */}
        <h2
          style={{
            margin: 0,
            fontSize: stepNumber === 4 ? 48 : 28,
            fontWeight: 800,
            color: theme.textPrimary,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
          }}
        >
          {stepNumber === 4 && offer ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 900,
                  color: theme.accentColor,
                  lineHeight: 1,
                }}
              >
                {offer.priceNumber}
              </span>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: theme.textPrimary,
                  lineHeight: 1,
                }}
              >
                {offer.priceUnit}
              </span>
            </div>
          ) : (
            renderHeadline()
          )}
        </h2>

        {/* Subtitle */}
        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            fontWeight: 500,
            color: theme.textSecondary,
            lineHeight: 1.45,
            maxWidth: '92%',
          }}
        >
          {subtitle}
        </p>

        {/* Optional: 3 Feature Icon Cards Placed at Top (Layout Variant 2) */}
        {layoutVariant === 'solution_chips_top' && featureChips && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              width: '100%',
              marginTop: 6,
            }}
          >
            {featureChips.map((chip) => (
              <div
                key={chip.id}
                style={{
                  backgroundColor: theme.cardBg,
                  borderRadius: 18,
                  padding: '12px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
                  border: `1px solid ${theme.borderColor}`,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    backgroundColor: theme.badgeBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderIcon(chip.iconName, '#FFFFFF')}
                </div>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: theme.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {chip.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MIDDLE & BOTTOM PRODUCT HERO AREA */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 14,
        }}
      >
        {/* Cartoon Joy Rays \ | / above product */}
        {accentEffect === 'rays' && (
          <div
            style={{
              position: 'absolute',
              top: -8,
              zIndex: 5,
              display: 'flex',
              gap: 6,
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                width: 3.5,
                height: 14,
                backgroundColor: theme.accentColor,
                borderRadius: 2,
                transform: 'rotate(-25deg)',
              }}
            />
            <div
              style={{
                width: 3.5,
                height: 18,
                backgroundColor: theme.accentColor,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                width: 3.5,
                height: 14,
                backgroundColor: theme.accentColor,
                borderRadius: 2,
                transform: 'rotate(25deg)',
              }}
            />
          </div>
        )}

        {/* Doodle Spiral on Card 1 (Problem) */}
        {stepNumber === 1 && (
          <svg
            style={{
              position: 'absolute',
              top: -10,
              right: 12,
              width: 50,
              height: 50,
              zIndex: 10,
              opacity: 0.75,
            }}
            viewBox="0 0 100 100"
            fill="none"
          >
            <path
              d="M50 15 C30 15, 20 35, 30 55 C40 75, 75 75, 80 50 C85 25, 45 20, 35 40 C25 60, 50 85, 70 80"
              stroke={theme.textPrimary}
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Product Image Stage */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: layoutVariant === 'solution_chips_top' ? 340 : 380,
            borderRadius: 22,
            overflow: 'hidden',
            backgroundColor: theme.cardBg,
            boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
            border: `1px solid ${theme.borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Real Product Image */}
          {productImageUrl ? (
            <img
              src={productImageUrl}
              alt={headline}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 20,
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#E7E5E4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#78716C',
                fontSize: 14,
              }}
            >
              Ảnh sản phẩm
            </div>
          )}

          {/* Floating Problem Callout Stickers on Card 1 */}
          {stickers &&
            stickers.map((stk, idx) => (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  top: `${stk.topPercent}%`,
                  left: `${stk.leftPercent}%`,
                  transform: `translate(-50%, -50%) rotate(${stk.rotationDeg}deg)`,
                  backgroundColor: '#FFFFFF',
                  color: '#1C1917',
                  padding: '6px 14px',
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow:
                    '0 6px 16px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.1)',
                  border: '1.5px solid rgba(0,0,0,0.1)',
                  zIndex: 20,
                  whiteSpace: 'nowrap',
                }}
              >
                {stk.text}
              </div>
            ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM AREA: Feature Chips on Card 3 OR CTA Button on Card 4 */}
      {/* ------------------------------------------------------------- */}
      {stepNumber === 3 && featureChips && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            width: '100%',
            marginTop: 14,
            zIndex: 10,
          }}
        >
          {featureChips.map((chip) => (
            <div
              key={chip.id}
              style={{
                backgroundColor: theme.cardBg,
                borderRadius: 18,
                padding: '12px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
                border: `1px solid ${theme.borderColor}`,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  backgroundColor: theme.badgeBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {renderIcon(chip.iconName, '#FFFFFF')}
              </div>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: theme.textPrimary,
                  textAlign: 'center',
                }}
              >
                {chip.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Card 4 CTA & Offer Pill */}
      {stepNumber === 4 && offer && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            marginTop: 14,
            zIndex: 10,
          }}
        >
          {/* Big High-Converting CTA Button */}
          <div
            style={{
              width: '100%',
              backgroundColor: theme.accentColor,
              color: '#FFFFFF',
              padding: '16px 24px',
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: `0 10px 24px ${theme.accentColor}55`,
              cursor: 'pointer',
            }}
          >
            <ShoppingCart size={22} color="#FFFFFF" />
            <span
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: '-0.01em',
              }}
            >
              {offer.ctaText}
            </span>
            <ChevronRight size={20} color="#FFFFFF" strokeWidth={3} />
          </div>

          {/* Subnote */}
          {offer.subNote && (
            <span
              style={{
                fontSize: 11.5,
                color: theme.textSecondary,
                fontWeight: 500,
              }}
            >
              {offer.subNote}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
