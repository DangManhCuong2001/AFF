export type ProductCategory =
  | 'kitchen'
  | 'desk_tech'
  | 'cleaning_home'
  | 'bathroom_care'
  | 'lifestyle_utility'

export interface InfographicTheme {
  id: ProductCategory
  name: string
  backgroundUrl: string
  surfaceBg: string
  cardBg: string
  accentColor: string
  accentHover: string
  accentBgLight: string
  textPrimary: string
  textSecondary: string
  borderColor: string
  badgeBg: string
}

export type LayoutVariant =
  | 'problem_stickers'
  | 'problem_warning_card'
  | 'solution_chips_top'
  | 'solution_chips_bottom'
  | 'solution_asymmetric'
  | 'result_human_touch'
  | 'result_macro_detail'
  | 'offer_huge_price'
  | 'offer_bundle_deal'

export interface FeatureChip {
  id: string
  iconName: string // e.g. 'shield', 'touch', 'box', 'sparkle', 'zap', 'clock', 'check', 'leaf'
  title: string
}

export interface ProblemSticker {
  text: string
  topPercent: number
  leftPercent: number
  rotationDeg: number
  variant?: 'warning' | 'neutral'
}

export interface InfographicCardData {
  stepNumber: number // 1, 2, 3, 4
  stepLabel: string // 'VẤN ĐỀ HAY GẶP', 'GIẢI PHÁP', 'KẾT QUẢ', 'ƯU ĐÃI'
  headline: string
  highlightWord?: string
  subtitle: string
  layoutVariant: LayoutVariant
  productImageUrl: string
  featureChips?: FeatureChip[]
  stickers?: ProblemSticker[]
  accentEffect?: 'rays' | 'sparkles' | 'none'
  hasHandInteraction?: boolean
  offer?: {
    priceNumber: string // '39K', '149K', '89K'
    priceUnit: string // '/ bộ', '/ chiếc', '/ combo 2 cái'
    voucherTag?: string // 'Voucher giảm 10K', 'Freeship đơn 0Đ'
    subNote?: string // '* Có thể thay bằng giá / voucher thật'
    ctaText: string // 'Xem ở giỏ hàng >'
  }
}

export interface ProductInfographicDeck {
  productName: string
  category: ProductCategory
  theme: InfographicTheme
  cards: InfographicCardData[]
}
