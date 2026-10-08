import { ProductPresentation } from '@/engines/core/contracts'
import { VisualBeatTimelineState } from '@/engines/visual/VisualBeatEngine'

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
