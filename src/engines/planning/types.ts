export type ContentFormat = 'design-showcase' | 'feature-explainer' | 'buying-guide' | 'problem-solution'
export type ContentAngle = 'design' | 'features' | 'fit'
export interface ImageFocus { x: number; y: number; width: number; height: number }
export interface NarrativeVisualStep {
  phrase: string
  assetId: string
  assetIndex: number
  crop?: ImageFocus
  label: string
}
/** Visual staging evidence only; never a product fact or a claimed use/result. */
export interface ImageInteraction {
  action: 'pick-place' | 'lift' | 'place' | 'touch' | 'point'
  targetDetail: number
  contact: 'handle' | 'rim' | 'body' | 'surface'
  mobility: 'handheld' | 'fixed' | 'unknown'
  arrangement: 'separate' | 'stacked' | 'occluded' | 'unknown'
  confidence: 'high' | 'low'
  prop: 'none' | 'phone' | 'book' | 'small-item' | 'loop-item' | 'sponge' | 'bottle' | 'cloth' | 'cup'
  restingPose?: 'upright' | 'flat' | 'leaning' | 'unknown'
  supportState?: 'empty' | 'occupied' | 'unclear'
  access?: 'clear' | 'blocked' | 'unclear'
  supportUse?: 'storage' | 'drainage' | 'unclear'
}
export interface ImageInsight {
  assetId: string
  role: 'primary' | 'detail' | 'lifestyle' | 'packaging'
  observation?: string
  details?: {text: string; focus?: ImageFocus}[]
  focus?: ImageFocus
  productBounds?: ImageFocus
  interaction?: ImageInteraction
  source: 'vision' | 'metadata'
  quality?: 'clean' | 'seller-text' | 'ui-overlay'
  usageSpace?: 'empty-support' | 'occupied-support' | 'not-support' | 'uncertain'
}
export interface ProductFact { id: string; text: string; source: 'user_input' | 'image'; assetId?: string }
export interface CommerceMessage {
  viewerNeed: string
  answer: string
  evidenceIds: string[]
  proof: {sceneId: string; factId: string; assetId?: string; kind: 'image' | 'description'}[]
  nextStep: string
  source: 'gemini' | 'rules'
}
export interface HookEditorialScore {
  relevance: number
  specificity: number
  clarity: number
  support: number
  total: number
}
export interface SceneRenderPlan {
  layout?: 'hero' | 'detail' | 'gallery' | 'spec' | 'decision'
  secondaryAsset?: {assetId: string; assetIndex: number; crop?: ImageFocus}
  spec?: {label: string; value: string; evidenceId: string}
  fullProductCrop?: ImageFocus
  speechTiming?: {offsetSec: number; durationSec: number}
  visualSteps?: NarrativeVisualStep[]
  contextImageUrl?: string
  ctaLabel?: string
  factLabel?: string
  copySource?: 'gemini' | 'rules'
  decisionPrompt?: string
  purpose: string
  assetId: string
  assetIndex: number
  framing: 'full' | 'detail'
  crop?: ImageFocus
  annotation?: string
  evidenceIds: string[]
}
export type AIAnalysisFailure = 'auth' | 'quota' | 'service' | 'request' | 'timeout' | 'blocked' | 'output-limit' | 'invalid-response' | 'invalid-content'
export interface AIAnalysisAttempt {
  model: string
  stage?: 'vision' | 'copy'
  outcome: AIAnalysisFailure | 'completed' | 'partial'
  httpStatus?: number
  elapsedMs: number
}
export interface ContentPlan {
  durationPlan?: {mode: 'auto' | 'manual'; source: 'gemini' | 'rules'; suggestedSeconds: number; reason: string; requestedSeconds?: number; modelSuggestedSeconds?: number}
  aiStatus?: {state: 'not-configured' | 'completed' | 'partial' | 'failed'; reason?: 'missing-key' | AIAnalysisFailure; message: string; attachedImages: number; attempts?: AIAnalysisAttempt[]; review?: {part: string; index: number; reason: string}[]}
  message?: CommerceMessage
  buyingProfile?: {id: string; label: string; priorities: string[]; checks: string[]}
  format: ContentFormat
  formatReason: string
  angle: ContentAngle
  primaryBuyingReason: string
  focusFactId?: string
  clickReason?: string
  ctaLabel?: string
  buyerQuestion?: string
  copySources?: {hooks: 'gemini' | 'mixed' | 'rules'; script: 'gemini' | 'mixed' | 'rules'; cta: 'gemini' | 'rules'}
  inputMode: 'image-only' | 'images-and-details' | 'details-only'
  images: ImageInsight[]
  facts: ProductFact[]
  missingInformation: string[]
  warnings: string[]
  recommendedDuration: number
  source: 'rules' | 'gemini'
}
