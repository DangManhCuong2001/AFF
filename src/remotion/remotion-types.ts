/**
 * remotion-types.ts
 *
 * Self-contained type definitions and pure-logic utilities for the Remotion
 * bundle. Intentionally uses NO "@/" alias imports because Remotion runs its
 * own Webpack instance that does NOT have the Next.js path alias configured.
 *
 * Server-side engine code (contracts.ts, VisualBeatEngine.ts, etc.) must NOT
 * be imported here – those files may pull in Node.js-only modules (zod, fs,
 * child_process…) which break Chromium rendering.
 */

// ─── Shot / Camera types ─────────────────────────────────────────────────────

export type ShotType =
  | 'EstablishingShot'
  | 'ProblemCloseup'
  | 'MacroProductShot'
  | 'ProductRevealShot'
  | 'DemoShot'
  | 'BeforeAfterShot'
  | 'DetailShot'
  | 'ResultShot'
  | 'OfferShot'
  | 'CTAShot'

export type CameraMotionType =
  | 'camera_push'
  | 'camera_pull'
  | 'parallax_left'
  | 'parallax_right'
  | 'macro_zoom'
  | 'snap_reveal'

export type SfxCueType = 'whoosh' | 'pop' | 'snap' | 'click' | 'soft_impact' | 'none'

// ─── Layout Variant ───────────────────────────────────────────────────────────

export type LayoutVariant =
  | 'editorial-top'
  | 'editorial-left'
  | 'hero-center'
  | 'hero-offset'
  | 'split-horizontal'
  | 'split-vertical'
  | 'detail-focus'
  | 'commerce-offer'

// ─── Product Presentation ─────────────────────────────────────────────────────

export interface Crop {
  x: number
  y: number
  width: number
  height: number
}

export interface Position {
  x: number
  y: number
}

export interface ProductPresentation {
  type:
    | 'hero-card'
    | 'detail-focus'
    | 'floating-product'
    | 'smart-crop'
    | 'split-view'
    | 'macro-detail'
  assetId: string
  crop?: Crop
  zoom?: number
  position?: Position
  variant?: string
}

// ─── Visual Beat (for internal Remotion motion) ───────────────────────────────

export interface VisualBeat {
  id: string
  atMs: number
  type:
    | 'headline-enter'
    | 'product-enter'
    | 'benefit-enter'
    | 'product-focus'
    | 'price-enter'
    | 'cta-enter'
  payload: Record<string, unknown>
}

export interface VisualBeatTimelineState {
  headlineProgress: number
  productEnterProgress: number
  activeBenefitCount: number
  focusProgress: number
  priceProgress: number
  ctaProgress: number
}

// ─── Visual Beat Engine (pure browser-safe logic) ────────────────────────────

export class VisualBeatEngine {
  /**
   * Generates standard internal motion beats for a scene of given duration
   */
  static generateDefaultBeatsForScene(
    sceneId: string,
    durationSec: number,
    benefitCount = 2,
    hasPrice = false,
    isCta = false
  ): VisualBeat[] {
    const beats: VisualBeat[] = []
    const totalMs = durationSec * 1000

    beats.push({ id: `${sceneId}-beat-headline`, atMs: 0, type: 'headline-enter', payload: { motion: 'fade-up' } })
    beats.push({ id: `${sceneId}-beat-product`, atMs: Math.min(350, totalMs * 0.15), type: 'product-enter', payload: { scale: 1.0 } })

    for (let i = 0; i < benefitCount; i++) {
      const atMs = Math.round(1000 + i * 700)
      if (atMs < totalMs * 0.85) {
        beats.push({ id: `${sceneId}-beat-benefit-${i + 1}`, atMs, type: 'benefit-enter', payload: { chipIndex: i } })
      }
    }

    const focusAtMs = Math.round(Math.min(2500, totalMs * 0.7))
    beats.push({ id: `${sceneId}-beat-focus`, atMs: focusAtMs, type: 'product-focus', payload: { zoomFactor: 1.1 } })

    if (hasPrice) {
      beats.push({ id: `${sceneId}-beat-price`, atMs: Math.round(totalMs * 0.5), type: 'price-enter', payload: {} })
    }
    if (isCta) {
      beats.push({ id: `${sceneId}-beat-cta`, atMs: Math.round(totalMs * 0.4), type: 'cta-enter', payload: {} })
    }

    return beats.sort((a, b) => a.atMs - b.atMs)
  }

  /**
   * Computes current animated state for given frame in Remotion
   */
  static evaluateBeats(beats: VisualBeat[], frame: number, fps: number): VisualBeatTimelineState {
    const currentMs = (frame / fps) * 1000

    let headlineProgress = 0
    let productEnterProgress = 0
    let activeBenefitCount = 0
    let focusProgress = 0
    let priceProgress = 0
    let ctaProgress = 0

    for (const beat of beats) {
      const diffMs = currentMs - beat.atMs
      const progress = Math.min(1, Math.max(0, diffMs / 350))

      switch (beat.type) {
        case 'headline-enter':
          headlineProgress = Math.max(headlineProgress, progress)
          break
        case 'product-enter':
          productEnterProgress = Math.max(productEnterProgress, progress)
          break
        case 'benefit-enter':
          if (diffMs >= 0) activeBenefitCount++
          break
        case 'product-focus':
          focusProgress = Math.max(focusProgress, progress)
          break
        case 'price-enter':
          priceProgress = Math.max(priceProgress, progress)
          break
        case 'cta-enter':
          ctaProgress = Math.max(ctaProgress, progress)
          break
      }
    }

    return { headlineProgress, productEnterProgress, activeBenefitCount, focusProgress, priceProgress, ctaProgress }
  }
}

// ─── Product Presentation Resolver ───────────────────────────────────────────

export interface ResolvedPresentationStyles {
  containerStyle: React.CSSProperties
  imageStyle: React.CSSProperties
  overlayStyle?: React.CSSProperties
  isCard: boolean
  isMacro: boolean
  isFloating: boolean
}

export class ProductPresentationResolver {
  static resolve(
    presentation: ProductPresentation,
    options?: { focusActive?: boolean; focusZoomBonus?: number }
  ): ResolvedPresentationStyles {
    const { type, zoom = 1.0, position, crop } = presentation
    const extraZoom = options?.focusActive ? (options?.focusZoomBonus ?? 0.1) : 0
    const effectiveZoom = zoom + extraZoom

    const posX = position?.x ?? 0
    const posY = position?.y ?? 0

    let isCard = false
    let isMacro = false
    let isFloating = false

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }

    const imageStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: `scale(${effectiveZoom}) translate(${posX}%, ${posY}%)`,
    }

    switch (type) {
      case 'hero-card': {
        isCard = true
        containerStyle.borderRadius = 32
        containerStyle.border = '1px solid rgba(255, 255, 255, 0.16)'
        containerStyle.background = 'rgba(255, 255, 255, 0.05)'
        containerStyle.boxShadow = '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 8px 24px -4px rgba(0, 0, 0, 0.4)'
        imageStyle.objectFit = 'contain'
        break
      }
      case 'detail-focus': {
        isCard = true
        containerStyle.borderRadius = 28
        containerStyle.border = '1.5px solid rgba(56, 189, 248, 0.3)'
        containerStyle.boxShadow = '0 20px 50px -10px rgba(0, 0, 0, 0.6)'
        imageStyle.objectFit = 'cover'
        imageStyle.transform = `scale(${Math.max(1.25, effectiveZoom)}) translate(${posX}%, ${posY}%)`
        break
      }
      case 'macro-detail': {
        isMacro = true
        isCard = true
        containerStyle.borderRadius = 36
        containerStyle.border = '2px solid rgba(255, 255, 255, 0.22)'
        containerStyle.boxShadow = '0 30px 70px -15px rgba(0, 0, 0, 0.8)'
        imageStyle.objectFit = 'cover'
        imageStyle.transform = `scale(${Math.max(1.5, effectiveZoom * 1.4)}) translate(${posX}%, ${posY}%)`
        break
      }
      case 'floating-product': {
        isFloating = true
        containerStyle.overflow = 'visible'
        imageStyle.objectFit = 'contain'
        imageStyle.filter = 'drop-shadow(0 25px 40px rgba(0, 0, 0, 0.65))'
        break
      }
      case 'smart-crop': {
        if (crop) {
          imageStyle.objectFit = 'cover'
          imageStyle.objectPosition = `${crop.x + crop.width / 2}% ${crop.y + crop.height / 2}%`
        } else {
          imageStyle.objectFit = 'cover'
          imageStyle.objectPosition = 'center center'
        }
        break
      }
      case 'split-view': {
        isCard = true
        containerStyle.borderRadius = 24
        containerStyle.border = '1px solid rgba(255, 255, 255, 0.12)'
        imageStyle.objectFit = 'cover'
        break
      }
    }

    return { containerStyle, imageStyle, isCard, isMacro, isFloating }
  }
}

// ─── Visual Beat (for Remotion video storyplan beats) ────────────────────────
// This is the outer beat from VipeeVisualDirector – different from VisualBeat above.

export interface VisualLayerTransform {
  scaleStart: number
  scaleEnd: number
  translateXStart: number
  translateXEnd: number
  translateYStart: number
  translateYEnd: number
}

export interface StoryplanBeat {
  id: string
  segmentId: string
  shotType: ShotType
  startTimeSec: number
  durationSec: number
  visualIntent: string
  cameraMotion: CameraMotionType
  productVisible: boolean
  productRevealDelaySec: number
  layers: {
    background: {
      type: 'ambient_gradient' | 'contextual_environment' | 'broll_video'
      url?: string
      gradientColors?: [string, string]
      transform: VisualLayerTransform
    }
    product: {
      url: string
      cutoutUrl?: string
      shadow: boolean
      hasContactShadow: boolean
      motion: 'none' | 'snap_pop' | 'subtle_hover' | 'macro_slide' | 'smooth_scale'
      transform: VisualLayerTransform
    }
    foreground?: {
      url?: string
      blur: number
      transform: VisualLayerTransform
    }
    typography: {
      badgeText?: string
      subtitleText: string
      emphasisWord?: string
      emphasisRevealDelaySec?: number
    }
  }
  sfxCue: SfxCueType
  sfxDelaySec: number
  sceneTemplate?: 'problem' | 'reveal' | 'benefits' | 'result' | 'offer' | 'cta'
  productDisplayMode?: 'card' | 'cutout' | 'closeup' | 'split' | 'none'
  label?: string
  headline?: string
  supportText?: string
  benefitChips?: string[]
  offer?: {
    price?: string
    voucher?: string
    ctaText?: string
  }
}

// ─── Remotion Video Props ─────────────────────────────────────────────────────

export interface RemotionVideoProps {
  beats: StoryplanBeat[]
  masterAudioUrl: string
  bgmAudioUrl?: string
  bgmVolume?: number
  sfxCues?: Array<{
    id: string
    name?: string
    url: string
    timestampSec: number
    volume: number
  }>
  productName: string
  priceText?: string
  totalDurationFrames: number
  fps: number
}

// ─── Commerce Layout Props ────────────────────────────────────────────────────

export interface CommerceLayoutProps {
  headline?: string
  supportText?: string
  benefitChips?: string[]
  presentation: ProductPresentation
  assetUrl: string
  timeline: VisualBeatTimelineState
  badgeText?: string
  priceText?: string
  voucherText?: string
}
