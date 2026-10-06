export type ProductCategory =
  | 'home'
  | 'fashion'
  | 'accessories'
  | 'beauty'
  | 'perfume'
  | 'tech'

export type ProductAssetType =
  | 'PRODUCT_IMAGE'
  | 'PRODUCT_VIDEO'
  | 'DEMO_VIDEO'
  | 'DETAIL_IMAGE'

export interface ProductAsset {
  id: string
  url: string
  name: string
  size: number
  type: ProductAssetType
  isPrimary?: boolean
  width?: number
  height?: number
  durationSec?: number
  file?: File
}

export interface ProductInput {
  id: string
  name: string
  category: ProductCategory
  price?: string | number
  originalPrice?: string | number
  currency?: string
  description?: string
  features?: string[]
  benefits?: string[]
  problemSolved?: string
  howToUse?: string
  targetAudience?: string
  productUrl?: string
  shopProductId?: string
  assets: ProductAsset[]
}

export type VisualDemoPotential = 'high' | 'medium' | 'low'

export interface ProductAnalysis {
  productType: string
  mainProblem: string
  mainBenefit: string
  secondaryBenefits: string[]
  targetAudience: string
  sellingMechanism: string
  visualDemoPotential: VisualDemoPotential
  recommendedFormat: string
  reasoningSummary: string
  claimsAllowed: string[]
  claimsToAvoid: string[]
}

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
  backgroundType: string
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

export interface VideoProject {
  id: string
  createdAt: string
  updatedAt: string
  product: ProductInput
  analysis?: ProductAnalysis
  strategy?: VideoStrategy
  storyboard?: VideoStoryboard
  generatedAssets?: GeneratedAssets
  voiceAudio?: VoiceAudioTrack
  musicAudio?: MusicAudioTrack
  caption?: string
  hashtags?: string[]
  coverImageUrl?: string
  renderedVideo?: RenderedVideo
  publishStatus?: {
    status: string
    publishId?: string
    publishedAt?: string
    logId?: string
  }
  status: ProjectStatus
}
