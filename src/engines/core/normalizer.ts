import { NormalizedProduct, ProductInput, VerifiedVoucher } from './contracts'

// Known high-risk marketing claims that must NEVER be hallucinated without explicit seller input
const HIGH_RISK_CLAIM_PATTERNS = [
  'chống ẩm',
  'chống nước',
  'kháng nước',
  'diệt khuẩn',
  'kháng khuẩn',
  'tải trọng',
  'chịu lực',
  'bảo hành trọn đời',
  'vĩnh cửu',
  'chống cháy',
  'y tế',
  'chữa bệnh',
  'freeship',
  'miễn phí vận chuyển',
]

/**
 * Normalizes raw ProductInput into a strict, verified NormalizedProduct.
 * Ensures that no marketing claim can be fabricated downstream without source verification.
 */
export function normalizeProduct(input: ProductInput): NormalizedProduct {
  const name = (input.name || '').trim()
  const category = (input.category || 'home').trim()
  const subcategory = input.subcategory ? input.subcategory.trim() : undefined

  // 1. Sanitize Numeric Prices
  let price: number | undefined
  if (typeof input.price === 'number') {
    price = input.price > 0 ? input.price : undefined
  } else if (typeof input.price === 'string') {
    const cleanNum = Number(input.price.replace(/[^0-9]/g, ''))
    price = cleanNum > 0 ? cleanNum : undefined
  }

  let originalPrice: number | undefined
  if (typeof input.originalPrice === 'number') {
    originalPrice = input.originalPrice > 0 ? input.originalPrice : undefined
  } else if (typeof input.originalPrice === 'string') {
    const cleanNum = Number(input.originalPrice.replace(/[^0-9]/g, ''))
    originalPrice = cleanNum > 0 ? cleanNum : undefined
  }

  // 2. Normalize Voucher (Only if explicitly present with verified conditions)
  let verifiedVoucher: VerifiedVoucher | undefined
  if (input.voucher && (input.voucher.value || input.voucher.label)) {
    verifiedVoucher = {
      value: input.voucher.value,
      label: input.voucher.label?.trim(),
      condition: input.voucher.condition?.trim(),
    }
  }

  // 3. Extract Verified Features and Benefits from provided input
  const rawFeatures = input.features || []
  const verifiedFeatures = rawFeatures
    .map((f) => f.trim())
    .filter((f) => f.length > 0)

  const rawBenefits = input.benefits || []
  const verifiedBenefits = rawBenefits
    .map((b) => b.trim())
    .filter((b) => b.length > 0)

  // Combine full verified text context
  const fullContextText = [
    name,
    input.description || '',
    input.problemSolved || '',
    ...verifiedFeatures,
    ...verifiedBenefits,
  ]
    .join(' ')
    .toLowerCase()

  // 4. Verify Claims: Segregate allowed vs strictly forbidden claims
  const allowedClaims: string[] = []
  const forbiddenClaims: string[] = []

  // Add all verified features and benefits to allowed claims
  for (const f of verifiedFeatures) {
    if (!allowedClaims.includes(f)) allowedClaims.push(f)
  }
  for (const b of verifiedBenefits) {
    if (!allowedClaims.includes(b)) allowedClaims.push(b)
  }

  // Check each high risk claim against context text
  for (const pattern of HIGH_RISK_CLAIM_PATTERNS) {
    if (fullContextText.includes(pattern)) {
      if (!allowedClaims.includes(pattern)) allowedClaims.push(pattern)
    } else {
      if (!forbiddenClaims.includes(pattern)) forbiddenClaims.push(pattern)
    }
  }

  // 5. Determine Claims Source
  const claimsSource: 'user_input' | 'verified_catalog' | 'tiktok_shop_api' = input.shopProductId
    ? 'tiktok_shop_api'
    : 'user_input'

  return {
    id: input.id || `prod-${Date.now()}`,
    name,
    category,
    subcategory,
    price,
    originalPrice,
    currency: input.currency || 'VND',
    verifiedVoucher,
    verifiedFeatures,
    verifiedBenefits,
    problemSolved: input.problemSolved ? input.problemSolved.trim() : undefined,
    assets: input.assets || [],
    claimsSource,
    allowedClaims,
    forbiddenClaims,
  }
}
