import { z } from 'zod'

// ============================================================================
// 1. PRODUCT ASSET & PRESENTATION CONTRACTS
// ============================================================================

export const ProductAssetRoleSchema = z.enum([
  'primary',
  'detail',
  'demo',
  'packaging',
  'lifestyle',
])
export type ProductAssetRole = z.infer<typeof ProductAssetRoleSchema>

export const ProductAssetTypeSchema = z.enum([
  'image',
  'video',
  'PRODUCT_IMAGE',
  'PRODUCT_VIDEO',
  'DEMO_VIDEO',
  'DETAIL_IMAGE',
])
export type ProductAssetType = z.infer<typeof ProductAssetTypeSchema>

export const ProductAssetSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string().optional(),
  type: ProductAssetTypeSchema,
  role: ProductAssetRoleSchema.optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  isPrimary: z.boolean().optional(),
  file: z.any().optional(),
})
export type ProductAsset = {
  id: string
  url: string
  name?: string
  type: ProductAssetType
  role?: ProductAssetRole
  size?: number
  width?: number
  height?: number
  durationSec?: number
  isPrimary?: boolean
  file?: File
}

export const CropRectSchema = z.object({
  x: z.number().min(0).max(100), // normalized or percentage 0 - 100
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
})
export type CropRect = z.infer<typeof CropRectSchema>

export const Position2DSchema = z.object({
  x: z.number(), // relative offsetX or percentage
  y: z.number(),
})
export type Position2D = z.infer<typeof Position2DSchema>

/**
 * ProductPresentation:
 * Instruction set for Remotion rendering engine to display a source asset dynamically
 * WITHOUT generating static crop PNG files or repeating the same presentation.
 */
export const ProductPresentationTypeSchema = z.enum([
  'hero-card',
  'detail-focus',
  'floating-product',
  'smart-crop',
  'split-view',
  'macro-detail',
])
export type ProductPresentationType = z.infer<typeof ProductPresentationTypeSchema>

export const ProductPresentationSchema = z.object({
  type: ProductPresentationTypeSchema,
  assetId: z.string(),
  crop: CropRectSchema.optional(),
  zoom: z.number().min(0.5).max(3.0).optional().default(1.0),
  position: Position2DSchema.optional(),
  variant: z.enum(['frosted', 'clean_white', 'minimal', 'cutout']).optional().default('clean_white'),
})
export type ProductPresentation = z.infer<typeof ProductPresentationSchema>

// ============================================================================
// 2. PRODUCT INPUT & NORMALIZATION CONTRACTS
// ============================================================================

export const VerifiedVoucherSchema = z.object({
  value: z.number().optional(),
  label: z.string().optional(),
  condition: z.string().optional(),
})
export type VerifiedVoucher = z.infer<typeof VerifiedVoucherSchema>

export const ProductInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
  originalPrice: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional().default('VND'),
  voucher: VerifiedVoucherSchema.optional(),
  features: z.array(z.string()).optional().default([]),
  benefits: z.array(z.string()).optional().default([]),
  problemSolved: z.string().optional(),
  howToUse: z.string().optional(),
  targetAudience: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  productUrl: z.string().optional(),
  shopProductId: z.string().optional(),
  assets: z.array(z.any()).default([]),
})
export interface ProductInput {
  id: string
  name: string
  category: string
  subcategory?: string
  price?: string | number
  originalPrice?: string | number
  currency?: string
  voucher?: VerifiedVoucher
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

/**
 * NormalizedProduct:
 * Sanitized, verified single source of truth.
 * All downstream marketing claims MUST trace back directly to this contract.
 */
export const NormalizedProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  price: z.number().optional(),
  originalPrice: z.number().optional(),
  currency: z.string().default('VND'),
  verifiedVoucher: VerifiedVoucherSchema.optional(),
  verifiedFeatures: z.array(z.string()),
  verifiedBenefits: z.array(z.string()),
  problemSolved: z.string().optional(),
  assets: z.array(ProductAssetSchema),
  claimsSource: z.enum(['user_input', 'verified_catalog', 'tiktok_shop_api']),
  allowedClaims: z.array(z.string()),
  forbiddenClaims: z.array(z.string()),
})
export type NormalizedProduct = z.infer<typeof NormalizedProductSchema>

// ============================================================================
// 3. AI PRODUCT ANALYSIS CONTRACTS
// ============================================================================

export const VisualDemoPotentialSchema = z.enum(['high', 'medium', 'low'])
export type VisualDemoPotential = z.infer<typeof VisualDemoPotentialSchema>

export const ProductAnalysisSchema = z.object({
  productType: z.string(),
  mainProblem: z.string(),
  mainBenefit: z.string(),
  secondaryBenefits: z.array(z.string()).default([]),
  targetAudience: z.string(),
  buyerSituation: z.string().optional().default(''),
  relatableMoment: z.string().optional().default(''),
  sellingMechanism: z.string().optional().default(''),
  visualStrengths: z.array(z.string()).optional().default([]),
  visualWeaknesses: z.array(z.string()).optional().default([]),
  demoPotential: VisualDemoPotentialSchema.optional().default('medium'),
  recommendedStoryApproach: z.string().optional().default('problem-solution'),
  claimsAllowed: z.array(z.string()).default([]),
  claimsForbidden: z.array(z.string()).default([]),
  // Backward compatibility legacy aliases
  visualDemoPotential: VisualDemoPotentialSchema.optional(),
  recommendedFormat: z.string().optional(),
  reasoningSummary: z.string().optional(),
  claimsToAvoid: z.array(z.string()).optional(),
})

export interface ProductAnalysis {
  productType: string
  mainProblem: string
  mainBenefit: string
  secondaryBenefits: string[]
  targetAudience: string
  buyerSituation?: string
  relatableMoment?: string
  sellingMechanism?: string
  visualStrengths?: string[]
  visualWeaknesses?: string[]
  demoPotential?: VisualDemoPotential
  recommendedStoryApproach?: string
  claimsAllowed: string[]
  claimsForbidden?: string[]
  // Backward compatibility legacy aliases
  visualDemoPotential?: VisualDemoPotential
  recommendedFormat?: string
  reasoningSummary?: string
  claimsToAvoid?: string[]
}

// ============================================================================
// 4. CREATIVE DIRECTOR & STORY CONTRACTS
// ============================================================================

export const StoryApproachSchema = z.enum([
  'problem-solution',
  'micro-story',
  'before-after',
  'relatable-moment',
  'curiosity-test',
  'three-benefits',
  'mini-review',
  'pov',
  'satisfying',
  'daily-frustration',
  'unexpected-use',
  'challenge',
  'comparison',
])
export type StoryApproach = z.infer<typeof StoryApproachSchema>

export const CreativePlanSchema = z.object({
  concept: z.string(),
  viewerInsight: z.string(),
  storyApproach: StoryApproachSchema,
  hook: z.string(),
  story: z.string(),
  productRole: z.string(),
  payoff: z.string(),
  offerAngle: z.string(),
  ctaAngle: z.string(),
  tone: z.string().default('natural-commerce'),
  durationTarget: z.number().default(16),
  emotionalArc: z.array(z.string()),
})
export type CreativePlan = z.infer<typeof CreativePlanSchema>

// ============================================================================
// 5. SPEECH PLAN & SEGMENTED TTS (Provider-Agnostic)
// ============================================================================

export const SpeechIntentSchema = z.enum([
  'hook',
  'relatable',
  'annoyed',
  'curious',
  'reveal',
  'satisfied',
  'offer',
  'cta',
])
export type SpeechIntent = z.infer<typeof SpeechIntentSchema>

export const SpeechSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  intent: SpeechIntentSchema,
  pace: z.number().min(0.5).max(2.0).default(1.0),
  energy: z.number().min(0.0).max(1.0).default(0.7),
  pauseBeforeMs: z.number().min(0).default(50),
  pauseAfterMs: z.number().min(0).default(250),
  emphasisWords: z.array(z.string()).default([]),
  displayScript: z.string().optional(),
  ttsScript: z.string().optional(),
  estimatedDurationSec: z.number().optional(),
})
export type SpeechSegment = z.infer<typeof SpeechSegmentSchema>

export const SpeechPlanSchema = z.object({
  voicePreset: z.string(),
  segments: z.array(SpeechSegmentSchema),
  totalEstimatedDurationSec: z.number(),
})
export type SpeechPlan = z.infer<typeof SpeechPlanSchema>

// ============================================================================
// 6. VISUAL BEATS & MOTION TIMING CONTRACTS
// ============================================================================

/**
 * VisualBeat:
 * First-class timeline event model. Enables rich internal motion within scenes
 * so that scenes are alive and never static while voiceover is speaking.
 */
export const VisualBeatTypeSchema = z.enum([
  'headline-enter',
  'support-enter',
  'product-enter',
  'product-focus',
  'benefit-enter',
  'asset-change',
  'camera-change',
  'price-enter',
  'cta-enter',
])
export type VisualBeatType = z.infer<typeof VisualBeatTypeSchema>

export const VisualBeatSchema = z.object({
  id: z.string(),
  atMs: z.number().min(0),
  type: VisualBeatTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
})
export type VisualBeat = z.infer<typeof VisualBeatSchema>

// ============================================================================
// 7. SCENE TYPES & LAYOUT VARIANTS (Separated Dimensions)
// ============================================================================

/**
 * SceneType:
 * The narrative role of the scene in the direct-response commerce story.
 */
export const SceneTypeSchema = z.enum([
  'problem',
  'reveal',
  'benefits',
  'result',
  'offer',
  'detail',
  'demo',
])
export type SceneType = z.infer<typeof SceneTypeSchema>

/**
 * LayoutVariant:
 * The visual composition structure on screen. A single SceneType can be rendered
 * using multiple different LayoutVariants to prevent template fatigue.
 */
export const LayoutVariantSchema = z.enum([
  'editorial-top',
  'editorial-left',
  'hero-center',
  'hero-offset',
  'split-horizontal',
  'split-vertical',
  'detail-focus',
  'commerce-offer',
])
export type LayoutVariant = z.infer<typeof LayoutVariantSchema>

export const SfxCueSchema = z.object({
  id: z.string(),
  name: z.string(),
  atMs: z.number().min(0),
  volume: z.number().min(0).max(1.0).optional().default(0.8),
  url: z.string().optional(),
})
export type SfxCue = z.infer<typeof SfxCueSchema>

/**
 * VideoScene:
 * Concrete scene model combining narrative, visual layout instructions,
 * audio text, product presentation, and timed internal visual beats.
 */
export const VideoSceneSchema = z.object({
  id: z.string(),
  sceneType: SceneTypeSchema,
  layoutVariant: LayoutVariantSchema,
  storyBeat: z.string(),
  voiceText: z.string(),
  ttsText: z.string(),
  visualIntent: z.string(),
  presentation: ProductPresentationSchema,
  headline: z.string().optional(),
  supportText: z.string().optional(),
  benefitChips: z.array(z.string()).optional(),
  emphasisWords: z.array(z.string()).optional(),
  beats: z.array(VisualBeatSchema).default([]),
  cameraMotion: z.string().optional().default('slow-push'),
  transition: z.string().optional().default('fade'),
  musicMood: z.string().optional().default('clean-warm'),
  sfxCues: z.array(SfxCueSchema).optional().default([]),
  durationHintSec: z.number().min(0.5).default(3.0),
})
export type VideoScene = z.infer<typeof VideoSceneSchema>

// ============================================================================
// 8. VIDEO PROJECT OUTPUT CONTRACT
// ============================================================================

export const VideoProjectThemeSchema = z.enum(['modern-clean-commerce'])
export type VideoProjectTheme = z.infer<typeof VideoProjectThemeSchema>

export const VideoProjectSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  product: ProductInputSchema,
  analysis: ProductAnalysisSchema.optional(),
  creativePlan: CreativePlanSchema.optional(),
  speechPlan: SpeechPlanSchema.optional(),
  storyboard: z
    .object({
      scenes: z.array(z.any()),
      totalDurationSec: z.number().optional(),
      totalDuration: z.number().optional(),
    })
    .optional(),
  audio: z
    .object({
      voiceUrl: z.string().optional(),
      musicUrl: z.string().optional(),
      sfxUrls: z.array(z.string()).optional().default([]),
    })
    .optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  cover: z
    .object({
      assetId: z.string(),
      hookText: z.string(),
    })
    .optional(),
  theme: VideoProjectThemeSchema.default('modern-clean-commerce'),
  status: z.string().optional().default('draft'),
  // Legacy project compatibility fields
  strategy: z.any().optional(),
  generatedAssets: z.any().optional(),
  voiceAudio: z.any().optional(),
  musicAudio: z.any().optional(),
  coverImageUrl: z.string().optional(),
  renderedVideo: z.any().optional(),
  publishStatus: z.any().optional(),
})

export interface VideoProject {
  id: string
  createdAt: string
  updatedAt: string
  product: ProductInput
  analysis?: ProductAnalysis
  strategy?: unknown
  creativePlan?: CreativePlan
  speechPlan?: SpeechPlan
  storyboard?: {
    scenes: Array<{
      id: string
      type?: string
      duration?: number
      voice?: string
      headline?: string
      visualPrompt?: string
      [key: string]: unknown
    }>
    totalDurationSec?: number
    totalDuration?: number
  }
  generatedAssets?: unknown
  voiceAudio?: unknown
  musicAudio?: unknown
  audio?: {
    voiceUrl?: string
    musicUrl?: string
    sfxUrls?: string[]
  }
  caption?: string
  hashtags?: string[]
  cover?: {
    assetId: string
    hookText: string
  }
  coverImageUrl?: string
  renderedVideo?: unknown
  publishStatus?: unknown
  theme?: VideoProjectTheme
  status: string
}

