// Re-export formal Phase 2 data contracts and normalizer
export * from './contracts'
export * from './normalizer'

// Legacy compatibility types (kept to prevent any breakage across existing codebase)
export type ProductCategory =
  | 'home'
  | 'fashion'
  | 'accessories'
  | 'beauty'
  | 'perfume'
  | 'tech'

export interface VideoStrategyVisualDirection {
  mood: string
  lighting: string
  palette: string[]
  environment: string
}

export interface VideoStrategy {
  concept: string
  format: string
  hook: string
  angle: string
  tone: string
  targetDuration: number
  cta: string
  visualDirection: VideoStrategyVisualDirection
}

export type StoryboardSceneType =
  | 'hook'
  | 'problem'
  | 'product_hero'
  | 'demo'
  | 'before_after'
  | 'benefit'
  | 'result'
  | 'price'
  | 'cta'

export interface StoryboardScene {
  id: string
  type: StoryboardSceneType
  duration: number
  voice: string
  tts: string
  headline: string
  subheadline?: string
  keywords?: string[]
  productAssetIds: string[]
  backgroundType?: string
  visualPrompt?: string
  motionPreset?: string
}

export interface VideoStoryboard {
  scenes: StoryboardScene[]
  totalDuration: number
}

export interface GeneratedBackground {
  sceneId: string
  url: string
  prompt?: string
}

export interface ProcessedProductAsset {
  originalId: string
  url: string
  maskUrl?: string
}

export interface GeneratedAssets {
  backgrounds: GeneratedBackground[]
  processedProductAssets?: ProcessedProductAsset[]
}

export interface RenderedVideo {
  videoUrl: string
  duration: number
  width: number
  height: number
  sizeBytes?: number
  format: 'mp4'
  coverImageUrl?: string
}

export interface VoiceAudioTrack {
  url: string
  duration: number
  provider: string
  voiceId?: string
}

export interface MusicAudioTrack {
  id: string
  url: string
  name: string
  mood: string
  volume: number
}

export type ProjectStatus =
  | 'draft'
  | 'analyzing'
  | 'analyzed'
  | 'generating'
  | 'ready'
  | 'published'
  | 'failed'
