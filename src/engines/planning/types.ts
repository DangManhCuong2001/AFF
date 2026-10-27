export type ContentFormat = 'design-showcase' | 'feature-explainer' | 'buying-guide' | 'problem-solution'
export type ContentAngle = 'design' | 'features' | 'fit'
export interface ImageFocus { x: number; y: number; width: number; height: number }
export interface ImageInsight {
  assetId: string
  role: 'primary' | 'detail' | 'lifestyle' | 'packaging'
  observation?: string
  focus?: ImageFocus
  productBounds?: ImageFocus
  source: 'vision' | 'metadata'
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
export interface ContentPlan {
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
