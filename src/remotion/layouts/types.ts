import { ProductPresentation, VisualBeatTimelineState } from '../remotion-types'

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
