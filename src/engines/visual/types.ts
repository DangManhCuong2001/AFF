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

export interface VisualLayerTransform {
  scaleStart: number
  scaleEnd: number
  translateXStart: number
  translateXEnd: number
  translateYStart: number
  translateYEnd: number
}

export interface VisualBeat {
  id: string
  segmentId: string
  shotType: ShotType
  startTimeSec: number
  durationSec: number
  visualIntent: string
  cameraMotion: CameraMotionType
  productVisible: boolean
  productRevealDelaySec: number // Exact phrase synchronization delay
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
  // Modern Commerce Layout Extensions
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

export interface VisualStoryplan {
  beats: VisualBeat[]
  totalDurationSec: number
  primaryProductUrl: string
  aspectRatio: '9:16'
}

export interface VisualDirector {
  createVisualStoryplan(params: {
    speechTimings: Array<{
      segmentId: string
      text: string
      emotion: string
      startSec: number
      endSec: number
      durationSec: number
      emphasis?: string[]
      syncTriggerPhrase?: string
    }>
    productImages: string[]
    productName: string
    category: string
  }): VisualStoryplan
}
