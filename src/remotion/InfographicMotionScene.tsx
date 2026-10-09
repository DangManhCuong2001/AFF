import React from 'react'
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { InfographicCardData, InfographicTheme } from './remotion-types'

interface InfographicMotionSceneProps {
  card: InfographicCardData
  theme: InfographicTheme
  durationSec?: number
}

// Built-in inline SVG icon mapper for 100% Remotion bundler safety
const renderIcon = (iconName: string, color: string = '#FFFFFF', size: number = 32) => {
  switch (iconName) {
    case 'shield':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    case 'touch':
    case 'hand':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      )
    case 'box':
    case 'package':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      )
    case 'sparkle':
    case 'sparkles':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      )
    case 'zap':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )
    case 'clock':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    case 'leaf':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
  }
}

export const InfographicMotionScene: React.FC<InfographicMotionSceneProps> = ({
  card,
  theme,
  durationSec = 3.5,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const totalFrames = Math.max(1, Math.round(durationSec * fps))

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

  // 1. Entrance Spring for the Main Card Shell
  const cardScale = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.9, stiffness: 120 },
  })

  // 2. Smooth Header Slide Down
  const headerSlide = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: { damping: 16, mass: 0.8 },
  })
  const headerOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })

  // 3. Ken Burns subtle zoom on product image
  const imgZoom = interpolate(frame, [0, totalFrames], [1.0, 1.07], {
    extrapolateRight: 'clamp',
  })

  // 4. Headline Accent Highlight
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

  // 5. CTA Button Pulse
  const ctaPulse = 1 + Math.sin(frame / 6) * 0.022

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.surfaceBg,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '70px 52px 64px',
        boxSizing: 'border-box',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* TOP HEADER: Step Badge, Headline, Subtitle */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 16,
          zIndex: 10,
          opacity: headerOpacity,
          transform: `translateY(${(1 - headerSlide) * -30}px)`,
        }}
      >
        {/* Step Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: theme.badgeBg,
            borderRadius: 9999,
            padding: '8px 22px 8px 10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: theme.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: 18,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {stepNumber}
          </div>
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 18,
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
            fontSize: stepNumber === 4 ? 68 : 46,
            fontWeight: 800,
            color: theme.textPrimary,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
          }}
        >
          {stepNumber === 4 && offer ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span
                style={{
                  fontSize: 78,
                  fontWeight: 900,
                  color: theme.accentColor,
                  lineHeight: 1,
                }}
              >
                {offer.priceNumber}
              </span>
              <span
                style={{
                  fontSize: 38,
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
            fontSize: 26,
            fontWeight: 500,
            color: theme.textSecondary,
            lineHeight: 1.45,
            maxWidth: '95%',
          }}
        >
          {subtitle}
        </p>

        {/* Top Feature Chips (if layoutVariant === 'solution_chips_top') */}
        {layoutVariant === 'solution_chips_top' && featureChips && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              width: '100%',
              marginTop: 10,
            }}
          >
            {featureChips.map((chip, idx) => {
              const chipDelay = 6 + idx * 4
              const chipSpring = spring({
                frame: Math.max(0, frame - chipDelay),
                fps,
                config: { damping: 14, mass: 0.8 },
              })
              return (
                <div
                  key={chip.id}
                  style={{
                    backgroundColor: theme.cardBg,
                    borderRadius: 26,
                    padding: '20px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                    border: `1.5px solid ${theme.borderColor}`,
                    transform: `scale(${chipSpring})`,
                    opacity: interpolate(frame, [chipDelay, chipDelay + 6], [0, 1], {
                      extrapolateRight: 'clamp',
                      extrapolateLeft: 'clamp',
                    }),
                  }}
                >
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      backgroundColor: theme.badgeBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {renderIcon(chip.iconName, '#FFFFFF', 30)}
                  </div>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: theme.textPrimary,
                      textAlign: 'center',
                    }}
                  >
                    {chip.title}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* MIDDLE: Product Hero Stage */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 20,
          marginBottom: 10,
        }}
      >
        {/* Cartoon Joy Rays */}
        {accentEffect === 'rays' && (
          <div
            style={{
              position: 'absolute',
              top: -16,
              zIndex: 5,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                width: 6,
                height: 24,
                backgroundColor: theme.accentColor,
                borderRadius: 4,
                transform: 'rotate(-25deg)',
              }}
            />
            <div
              style={{
                width: 6,
                height: 32,
                backgroundColor: theme.accentColor,
                borderRadius: 4,
              }}
            />
            <div
              style={{
                width: 6,
                height: 24,
                backgroundColor: theme.accentColor,
                borderRadius: 4,
                transform: 'rotate(25deg)',
              }}
            />
          </div>
        )}

        {/* Doodle Spiral on Step 1 (Problem) */}
        {stepNumber === 1 && (
          <svg
            style={{
              position: 'absolute',
              top: -14,
              right: 18,
              width: 74,
              height: 74,
              zIndex: 10,
              opacity: 0.8,
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

        {/* Product Image Stage Card */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: layoutVariant === 'solution_chips_top' ? 760 : 840,
            borderRadius: 36,
            overflow: 'hidden',
            backgroundColor: theme.cardBg,
            boxShadow: '0 24px 60px rgba(0,0,0,0.1)',
            border: `2px solid ${theme.borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {productImageUrl ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                borderRadius: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Img
                src={productImageUrl}
                alt={headline}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: `scale(${imgZoom})`,
                }}
              />
            </div>
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
                fontSize: 24,
              }}
            >
              Ảnh sản phẩm
            </div>
          )}

          {/* Floating Problem Callout Stickers */}
          {stickers &&
            stickers.map((stk, idx) => {
              const stickerDelay = 8 + idx * 8
              const stkSpring = spring({
                frame: Math.max(0, frame - stickerDelay),
                fps,
                config: { damping: 12, mass: 0.7, stiffness: 140 },
              })

              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    top: `${stk.topPercent}%`,
                    left: `${stk.leftPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${stk.rotationDeg}deg) scale(${stkSpring})`,
                    backgroundColor: stk.variant === 'warning' ? '#FEE2E2' : '#FFFFFF',
                    color: stk.variant === 'warning' ? '#991B1B' : '#1C1917',
                    padding: '12px 26px',
                    borderRadius: 9999,
                    fontSize: 22,
                    fontWeight: 800,
                    boxShadow: '0 10px 28px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.1)',
                    border: stk.variant === 'warning' ? '2px solid #EF4444' : '2px solid rgba(0,0,0,0.12)',
                    zIndex: 20,
                    whiteSpace: 'nowrap',
                    opacity: interpolate(frame, [stickerDelay, stickerDelay + 4], [0, 1], {
                      extrapolateRight: 'clamp',
                      extrapolateLeft: 'clamp',
                    }),
                  }}
                >
                  {stk.text}
                </div>
              )
            })}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* BOTTOM AREA: Feature Chips on Step 3 OR CTA Button on Step 4 */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {stepNumber === 3 && featureChips && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            width: '100%',
            marginTop: 18,
            zIndex: 10,
          }}
        >
          {featureChips.map((chip, idx) => {
            const chipDelay = 10 + idx * 5
            const chipSpring = spring({
              frame: Math.max(0, frame - chipDelay),
              fps,
              config: { damping: 14, mass: 0.8 },
            })
            return (
              <div
                key={chip.id}
                style={{
                  backgroundColor: theme.cardBg,
                  borderRadius: 26,
                  padding: '20px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                  border: `1.5px solid ${theme.borderColor}`,
                  transform: `scale(${chipSpring})`,
                  opacity: interpolate(frame, [chipDelay, chipDelay + 6], [0, 1], {
                    extrapolateRight: 'clamp',
                    extrapolateLeft: 'clamp',
                  }),
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    backgroundColor: theme.badgeBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderIcon(chip.iconName, '#FFFFFF', 30)}
                </div>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: theme.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {chip.title}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Step 4 / Last Scene CTA & Offer Pill */}
      {(stepNumber === 4 || (offer && offer.ctaText)) && offer && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            width: '100%',
            marginTop: 18,
            zIndex: 10,
          }}
        >
          {/* Big High-Converting CTA Button with Gentle Pulsating Motion */}
          <div
            style={{
              width: '100%',
              backgroundColor: theme.accentColor,
              color: '#FFFFFF',
              padding: '26px 36px',
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              boxShadow: `0 16px 36px ${theme.accentColor}66`,
              transform: `scale(${ctaPulse})`,
            }}
          >
            {/* Shopping Cart Icon */}
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            <span
              style={{
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: '-0.01em',
              }}
            >
              {offer.ctaText}
            </span>
            {/* Chevron Right Icon */}
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {/* Subnote */}
          {offer.subNote && (
            <span
              style={{
                fontSize: 18,
                color: theme.textSecondary,
                fontWeight: 600,
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
