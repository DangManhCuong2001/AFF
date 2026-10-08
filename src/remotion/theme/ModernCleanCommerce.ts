/**
 * ModernCleanCommerce Design System Tokens
 * Premium, state-of-the-art aesthetic for direct-response TikTok commerce videos.
 */

export const ModernCleanCommerceTheme = {
  colors: {
    // Backgrounds & Surfaces
    bgNoir: '#080A0F',
    bgDark: '#0D1117',
    surfaceCard: 'rgba(255, 255, 255, 0.07)',
    surfaceCardElevated: 'rgba(255, 255, 255, 0.12)',
    surfaceGlass: 'rgba(15, 23, 42, 0.75)',
    surfaceBorder: 'rgba(255, 255, 255, 0.12)',
    surfaceBorderHighlight: 'rgba(255, 255, 255, 0.25)',

    // Typography
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#090D16',

    // Accents & Signals
    accentBrand: '#38BDF8', // Sky Blue Electric
    accentBrandGlow: 'rgba(56, 189, 248, 0.35)',
    accentEmerald: '#10B981', // Clean Verified Green
    accentAmber: '#F59E0B', // Warm Attention Amber
    accentRose: '#F43F5E', // Urgency / Problem Rose
    badgeBgDark: 'rgba(0, 0, 0, 0.65)',
    badgeBgLight: '#FFFFFF',
  },

  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    headlineLarge: {
      fontSize: 54,
      fontWeight: 800,
      lineHeight: 1.15,
      letterSpacing: '-0.02em',
    },
    headlineMedium: {
      fontSize: 44,
      fontWeight: 800,
      lineHeight: 1.18,
      letterSpacing: '-0.015em',
    },
    supportText: {
      fontSize: 28,
      fontWeight: 500,
      lineHeight: 1.3,
      letterSpacing: '0em',
    },
    badgeText: {
      fontSize: 22,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
    },
    priceLarge: {
      fontSize: 68,
      fontWeight: 900,
      lineHeight: 1.0,
      letterSpacing: '-0.03em',
    },
  },

  radius: {
    pill: 9999,
    card: 32,
    chip: 16,
    subtle: 8,
  },

  shadows: {
    heroCard: '0 24px 60px -12px rgba(0, 0, 0, 0.7), 0 8px 24px -4px rgba(0, 0, 0, 0.4)',
    floatingPill: '0 12px 30px -6px rgba(0, 0, 0, 0.5)',
    glow: (color: string) => `0 0 35px ${color}`,
  },
}
