import { ProductInput } from '@/engines/core/types'

export type CTAVariant =
  | 'soft'
  | 'value'
  | 'price'
  | 'voucher'
  | 'curiosity'
  | 'problem-reminder'

export interface VerifiedOfferInfo {
  hasPrice: boolean
  displayPriceText?: string
  spokenPriceText?: string
  priceComparisonContext?: string
  hasDiscount: boolean
  discountPercent?: number
  hasVoucher: boolean
  voucherText?: string
  hasFreeShipping: boolean
  ctaVariants: Record<CTAVariant, { voiceText: string; displayText: string }>
  recommendedCta: {
    variant: CTAVariant
    voiceText: string
    displayText: string
  }
}

export class OfferEngine {
  /**
   * Strictly extracts verified offer information from ProductInput without inventing discounts
   */
  static analyzeOffer(product: ProductInput): VerifiedOfferInfo {
    const rawPrice = product.price
    const numericPrice = typeof rawPrice === 'number' ? rawPrice : Number(String(rawPrice || '').replace(/[^0-9]/g, ''))
    const hasPrice = !isNaN(numericPrice) && numericPrice > 0

    let displayPriceText: string | undefined
    let spokenPriceText: string | undefined
    let priceComparisonContext: string | undefined

    if (hasPrice) {
      displayPriceText = `${numericPrice.toLocaleString('vi-VN')}đ`
      
      if (numericPrice < 100000) {
        const kValue = Math.round(numericPrice / 1000)
        spokenPriceText = `${kValue} nghìn`
        if (numericPrice <= 40000) {
          priceComparisonContext = 'tầm một cốc nước'
        } else if (numericPrice <= 80000) {
          priceComparisonContext = 'bằng một bữa ăn sáng'
        }
      } else {
        spokenPriceText = `${numericPrice.toLocaleString('vi-VN')} đồng`
      }
    }

    // Check verified discount from input if provided
    const rawOriginalPrice = product.originalPrice
    const numericOriginalPrice = typeof rawOriginalPrice === 'number' ? rawOriginalPrice : Number(String(rawOriginalPrice || '').replace(/[^0-9]/g, ''))
    const hasDiscount = hasPrice && !isNaN(numericOriginalPrice) && numericOriginalPrice > numericPrice
    const discountPercent = hasDiscount ? Math.round(((numericOriginalPrice - numericPrice) / numericOriginalPrice) * 100) : undefined

    // Check verified voucher/freeship only if explicitly in description or features
    const fullText = `${product.description || ''} ${(product.features || []).join(' ')}`.toLowerCase()
    const hasFreeShipping = fullText.includes('freeship') || fullText.includes('miễn phí vận chuyển')
    const hasVoucher = fullText.includes('voucher') || fullText.includes('mã giảm')

    const shortName = product.name.length > 25 ? product.name.slice(0, 25) + '...' : product.name

    // 6 Authentic CTA variants
    const ctaVariants: Record<CTAVariant, { voiceText: string; displayText: string }> = {
      soft: {
        voiceText: 'Nếu góc nhà của bạn cũng đang cần sắp xếp lại, mình để thông tin ở giỏ hàng góc trái nhé.',
        displayText: 'Xem chi tiết ở giỏ hàng góc trái',
      },
      value: {
        voiceText: hasPrice && spokenPriceText
          ? `${spokenPriceText} mà giải quyết được chuyện khó chịu này mỗi ngày thì mình thấy rất đáng thử.`
          : `Giải quyết được sự bừa bộn này mỗi ngày thì mình thấy rất xứng đáng để thử.`,
        displayText: 'Đáng thử cho góc nhà gọn gàng',
      },
      price: {
        voiceText: hasPrice && spokenPriceText
          ? `Mức giá hiện tại là ${spokenPriceText}. Bạn có thể bấm vào giỏ hàng góc trái để xem chi tiết nhé.`
          : 'Bạn có thể bấm vào giỏ hàng góc trái để xem chi tiết mức giá nhé.',
        displayText: 'Bấm giỏ hàng góc trái xem ưu đãi',
      },
      voucher: {
        voiceText: hasVoucher
          ? 'Shop đang có hỗ trợ voucher, nếu còn lượt thì bạn nhớ bấm lưu trước khi đặt nhé.'
          : 'Bạn bấm vào giỏ hàng góc trái xem mã ưu đãi hôm nay nhé.',
        displayText: 'Kiểm tra voucher tại giỏ hàng',
      },
      curiosity: {
        voiceText: 'Ai muốn xem các góc chụp thực tế hoặc trải nghiệm của người mua trước thì bấm vào giỏ hàng nhé.',
        displayText: 'Xem đánh giá thực tế trong giỏ hàng',
      },
      'problem-reminder': {
        voiceText: `Nếu bạn cũng chán cảnh bừa bộn mỗi ngày như mình lúc trước thì tham khảo ${shortName} ở góc trái nhé.`,
        displayText: `Tham khảo ${shortName} ở góc trái`,
      },
    }

    // Determine prioritized recommendation
    let recommendedVariant: CTAVariant = 'soft'
    if (hasVoucher) {
      recommendedVariant = 'voucher'
    } else if (hasDiscount) {
      recommendedVariant = 'value'
    } else if (hasPrice && numericPrice < 100000) {
      recommendedVariant = 'value'
    } else {
      recommendedVariant = 'problem-reminder'
    }

    return {
      hasPrice,
      displayPriceText,
      spokenPriceText,
      priceComparisonContext,
      hasDiscount,
      discountPercent,
      hasVoucher,
      hasFreeShipping,
      ctaVariants,
      recommendedCta: {
        variant: recommendedVariant,
        ...ctaVariants[recommendedVariant],
      },
    }
  }
}
