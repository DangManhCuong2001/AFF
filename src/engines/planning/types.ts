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
export interface SceneRenderPlan {
  contextImageUrl?: string
  purpose: string
  assetId: string
  assetIndex: number
  framing: 'full' | 'detail'
  crop?: ImageFocus
  annotation?: string
  evidenceIds: string[]
}
export interface ContentPlan {
  format: ContentFormat
  formatReason: string
  angle: ContentAngle
  primaryBuyingReason: string
  inputMode: 'image-only' | 'images-and-details' | 'details-only'
  images: ImageInsight[]
  facts: ProductFact[]
  missingInformation: string[]
  warnings: string[]
  recommendedDuration: number
  source: 'rules' | 'gemini'
}
