import { StoryboardScene } from '@/engines/core/types'
import { upgradeTikTokImageUrl } from '@/lib/tiktok/image-utils'
import {
  InfographicCardData,
  InfographicTheme,
  ProductCategory,
  ProductInfographicDeck,
} from './types'

// Theme palettes tailored for different product categories
export const THEMES: Record<ProductCategory, InfographicTheme> = {
  kitchen: {
    id: 'kitchen',
    name: 'Muji Warm Kitchen',
    backgroundUrl: '/backgrounds/kitchen_modern.png',
    surfaceBg: '#FAF8F5',
    cardBg: '#FFFFFF',
    accentColor: '#B45309', // Warm Caramel Amber
    accentHover: '#92400E',
    accentBgLight: '#FEF3C7',
    textPrimary: '#1C1917',
    textSecondary: '#57534E',
    borderColor: '#E7E5E4',
    badgeBg: '#292524',
  },
  desk_tech: {
    id: 'desk_tech',
    name: 'Minimalist Workspace',
    backgroundUrl: '/backgrounds/desk_workspace.png',
    surfaceBg: '#F8FAFC',
    cardBg: '#FFFFFF',
    accentColor: '#2563EB', // Sleek Royal Blue
    accentHover: '#1D4ED8',
    accentBgLight: '#DBEAFE',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    borderColor: '#E2E8F0',
    badgeBg: '#1E293B',
  },
  cleaning_home: {
    id: 'cleaning_home',
    name: 'Fresh Clean Living',
    backgroundUrl: '/backgrounds/minimal_lifestyle.png',
    surfaceBg: '#F0FDF4',
    cardBg: '#FFFFFF',
    accentColor: '#059669', // Emerald Fresh
    accentHover: '#047857',
    accentBgLight: '#D1FAE5',
    textPrimary: '#064E3B',
    textSecondary: '#374151',
    borderColor: '#D1D5DB',
    badgeBg: '#065F46',
  },
  bathroom_care: {
    id: 'bathroom_care',
    name: 'Aqua Minimal Bath',
    backgroundUrl: '/backgrounds/minimal_lifestyle.png',
    surfaceBg: '#F0F9FF',
    cardBg: '#FFFFFF',
    accentColor: '#0284C7', // Pure Sky Aqua
    accentHover: '#0369A1',
    accentBgLight: '#E0F2FE',
    textPrimary: '#0C4A6E',
    textSecondary: '#4B5563',
    borderColor: '#E5E7EB',
    badgeBg: '#075985',
  },
  lifestyle_utility: {
    id: 'lifestyle_utility',
    name: 'Modern Lifestyle',
    backgroundUrl: '/backgrounds/minimal_lifestyle.png',
    surfaceBg: '#FAFAF9',
    cardBg: '#FFFFFF',
    accentColor: '#D97706', // Warm Amber
    accentHover: '#B45309',
    accentBgLight: '#FEF3C7',
    textPrimary: '#18181B',
    textSecondary: '#52525B',
    borderColor: '#E4E4E7',
    badgeBg: '#27272A',
  },
}

export class InfographicEngine {
  /**
   * Detects product category based on product title and keywords
   */
  public detectCategory(productName: string): ProductCategory {
    const lower = productName.toLowerCase()

    if (
      lower.includes('gia vị') ||
      lower.includes('hũ') ||
      lower.includes('bếp') ||
      lower.includes('nồi') ||
      lower.includes('chảo') ||
      lower.includes('dao') ||
      lower.includes('thớt') ||
      lower.includes('bát') ||
      lower.includes('đĩa') ||
      lower.includes('hộp cơm') ||
      lower.includes('bình giữ nhiệt') ||
      lower.includes('rửa chén')
    ) {
      return 'kitchen'
    }

    if (
      lower.includes('sạc') ||
      lower.includes('cáp') ||
      lower.includes('dây') ||
      lower.includes('tai nghe') ||
      lower.includes('chuột') ||
      lower.includes('bàn phím') ||
      lower.includes('laptop') ||
      lower.includes('kẹp dây') ||
      lower.includes('giá đỡ') ||
      lower.includes('đèn bàn') ||
      lower.includes('máy tính')
    ) {
      return 'desk_tech'
    }

    if (
      lower.includes('lau nhà') ||
      lower.includes('chổi') ||
      lower.includes('hút bụi') ||
      lower.includes('tẩy') ||
      lower.includes('khăn lau') ||
      lower.includes('sọt rác') ||
      lower.includes('giặt') ||
      lower.includes('vệ sinh')
    ) {
      return 'cleaning_home'
    }

    if (
      lower.includes('tắm') ||
      lower.includes('toilet') ||
      lower.includes('bồn cầu') ||
      lower.includes('bàn chải') ||
      lower.includes('khăn mặt') ||
      lower.includes('kệ dán tường') ||
      lower.includes('xà phòng')
    ) {
      return 'bathroom_care'
    }

    return 'lifestyle_utility'
  }

  /**
   * Generates a tailored Infographic Deck for ANY product.
   * If `scenes` from storyboard are provided, generates exactly {N} layouts
   * corresponding to the {N} video scenes (e.g. 5 scenes for 15s, 6 for 30s, 9 for 45s).
   */
  public generateDeck(params: {
    productName: string
    price?: number | string
    primaryImageUrl: string
    secondaryImageUrl?: string
    galleryImages?: string[]
    customCategory?: ProductCategory | string
    scenes?: StoryboardScene[]
    duration?: number
    problemSolved?: string
    benefits?: string[]
  }): ProductInfographicDeck {
    const { productName, primaryImageUrl, secondaryImageUrl, galleryImages, scenes } = params
    
    // Safely resolve category: validate against THEMES keys, otherwise fallback to detectCategory
    let category: ProductCategory = 'kitchen'
    if (params.customCategory && THEMES[params.customCategory as ProductCategory]) {
      category = params.customCategory as ProductCategory
    } else {
      category = this.detectCategory(productName)
    }

    const theme = THEMES[category] || THEMES.kitchen

    // Pool of available product images (upgraded to Ultra HD origin-jpeg)
    const availableImages = [
      primaryImageUrl,
      secondaryImageUrl,
      ...(galleryImages || []),
    ]
      .filter(Boolean)
      .map((url) => upgradeTikTokImageUrl(url as string))

    const img1 = availableImages[0] || (primaryImageUrl ? upgradeTikTokImageUrl(primaryImageUrl) : '')
    const img2 = availableImages[1] || availableImages[0] || img1

    // Format clean price text
    let priceNumber = ''
    let priceUnit = ''

    if (params.price) {
      const pNum = Number(String(params.price).replace(/[^\d]/g, ''))
      if (!isNaN(pNum) && pNum > 0) {
        if (pNum >= 1000) {
          priceNumber = `${Math.round(pNum / 1000)}K`
        } else {
          priceNumber = `${pNum}đ`
        }
      }
    }

    if (!priceNumber) {
      priceNumber = 'Giá tốt'
      priceUnit = 'hôm nay'
    } else {
      const lowerName = productName.toLowerCase()
      if (lowerName.includes('bộ') || lowerName.includes('set')) {
        priceUnit = '/ bộ'
      } else if (lowerName.includes('combo')) {
        priceUnit = '/ combo'
      } else if (lowerName.includes('hộp') || lowerName.includes('hũ')) {
        priceUnit = '/ hũ'
      } else if (lowerName.includes('chiếc')) {
        priceUnit = '/ chiếc'
      } else {
        priceUnit = '/ cái'
      }
    }

    // Category-specific content generation (fallbacks)
    const content = this.generateCategoryContent(category, productName)

    // DYNAMIC CASE: If scenes are provided from storyboard planning, map each scene to an Infographic layout!
    if (scenes && scenes.length > 0) {
      const cards: InfographicCardData[] = scenes.map((scene, idx) => {
        const isFirst = idx === 0
        const isLast = idx === scenes.length - 1
        const stepNumber = idx + 1
        const cardImg = availableImages[idx % availableImages.length] || img1

        let stepLabel = `BƯỚC ${stepNumber}`
        let layoutVariant: import('./types').LayoutVariant = 'solution_chips_top'
        let accentEffect: 'rays' | 'sparkles' | 'none' = 'rays'
        let hasHandInteraction = false

        switch (scene.type) {
          case 'hook':
            stepLabel = 'GÂY CHÚ Ý'
            layoutVariant = 'problem_stickers'
            accentEffect = 'none'
            break
          case 'problem':
            stepLabel = 'VẤN ĐỀ HAY GẶP'
            layoutVariant = 'problem_stickers'
            accentEffect = 'none'
            break
          case 'product_hero':
            stepLabel = 'GIẢI PHÁP MỚI'
            layoutVariant = 'solution_chips_top'
            accentEffect = 'rays'
            break
          case 'demo':
            stepLabel = 'CÁCH DÙNG TIỆN LỢI'
            layoutVariant = 'solution_asymmetric'
            accentEffect = 'rays'
            hasHandInteraction = true
            break
          case 'before_after':
            stepLabel = 'TRƯỚC & SAU'
            layoutVariant = 'result_human_touch'
            accentEffect = 'rays'
            break
          case 'benefit':
            stepLabel = 'ƯU ĐIỂM NỔI BẬT'
            layoutVariant = 'solution_chips_top'
            accentEffect = 'rays'
            break
          case 'result':
            stepLabel = 'KẾT QUẢ THỰC TẾ'
            layoutVariant = 'result_macro_detail'
            accentEffect = 'rays'
            hasHandInteraction = true
            break
          case 'price':
            stepLabel = 'ƯU ĐÃI DEAL HỜI'
            layoutVariant = 'offer_huge_price'
            accentEffect = 'rays'
            break
          case 'cta':
            stepLabel = 'ƯU ĐÃI & GIỎ HÀNG'
            layoutVariant = 'offer_huge_price'
            accentEffect = 'rays'
            break
          default:
            if (isFirst) {
              stepLabel = 'VẤN ĐỀ'
              layoutVariant = 'problem_stickers'
              accentEffect = 'none'
            } else if (isLast) {
              stepLabel = 'ƯU ĐÃI'
              layoutVariant = 'offer_huge_price'
              accentEffect = 'rays'
            } else {
              stepLabel = 'TÍNH NĂNG'
              layoutVariant = idx % 2 === 0 ? 'solution_chips_top' : 'result_human_touch'
              accentEffect = 'rays'
            }
        }

        // Force last card to be offer card for TikTok commerce conversion
        if (isLast) {
          layoutVariant = 'offer_huge_price'
          stepLabel = 'ƯU ĐÃI & GIỎ HÀNG'
        }

        // Headline & Highlight word
        let headline = scene.headline || `Khám phá ${productName}`
        let highlightWord: string | undefined = undefined

        if (layoutVariant === 'offer_huge_price') {
          headline = `${priceNumber} ${priceUnit}`
          highlightWord = priceNumber
        } else {
          // Auto detect highlight word: last 2-3 words or strong keyword
          const words = headline.trim().split(' ')
          if (words.length >= 3) {
            highlightWord = words.slice(-2).join(' ')
          }
        }

        // Subtitle from subheadline or voice
        let subtitle = scene.subheadline || scene.voice || ''
        if (subtitle.length > 70) {
          subtitle = subtitle.slice(0, 68) + '...'
        }
        if (layoutVariant === 'offer_huge_price') {
          subtitle = 'Giá ưu đãi độc quyền hôm nay trên TikTok Shop, bấm xem ngay ở giỏ hàng.'
        }

        // Stickers for problem cards
        let stickers = undefined
        if (layoutVariant === 'problem_stickers') {
          if (scene.keywords && scene.keywords.length >= 2) {
            stickers = [
              { text: scene.keywords[0], topPercent: 44, leftPercent: 20, rotationDeg: -6 },
              { text: scene.keywords[1], topPercent: 54, leftPercent: 68, rotationDeg: 8 },
              { text: scene.keywords[2] || 'Khó chịu', topPercent: 78, leftPercent: 18, rotationDeg: -4 },
            ]
          } else {
            stickers = content.card1.stickers
          }
        }

        // Feature chips for solution/benefit/demo cards
        let featureChips = undefined
        if (
          layoutVariant === 'solution_chips_top' ||
          layoutVariant === 'solution_asymmetric' ||
          layoutVariant === 'result_human_touch' ||
          layoutVariant === 'result_macro_detail'
        ) {
          if (scene.keywords && scene.keywords.length >= 3) {
            const icons = ['shield', 'touch', 'sparkle', 'box', 'zap', 'leaf']
            featureChips = scene.keywords.slice(0, 3).map((kw, kIdx) => ({
              id: `chip-${idx}-${kIdx}`,
              iconName: icons[kIdx % icons.length],
              title: kw,
            }))
          } else if (idx % 2 === 0) {
            featureChips = content.card2.chips
          } else {
            featureChips = content.card3.chips
          }
        }

        // Offer details for offer card
        let offer = undefined
        if (layoutVariant === 'offer_huge_price') {
          offer = {
            priceNumber,
            priceUnit,
            voucherTag: 'Voucher giảm 10K',
            subNote: '* Giá có thể thay đổi theo chương trình ưu đãi hôm nay',
            ctaText: 'Xem ở giỏ hàng >',
          }
        }

        return {
          stepNumber,
          stepLabel,
          headline,
          highlightWord,
          subtitle,
          layoutVariant,
          productImageUrl: cardImg,
          stickers,
          featureChips,
          offer,
          accentEffect,
          hasHandInteraction,
        }
      })

      return {
        productName,
        category,
        theme,
        cards,
      }
    }

    // FALLBACK CASE: When scenes are not passed yet, generate standard 4 cards
    const cards: InfographicCardData[] = [
      // -------------------------------------------------------------
      // CARD 1: VẤN ĐỀ HAY GẶP
      // -------------------------------------------------------------
      {
        stepNumber: 1,
        stepLabel: 'VẤN ĐỀ HAY GẶP',
        headline: content.card1.headline,
        highlightWord: content.card1.highlightWord,
        subtitle: content.card1.subtitle,
        layoutVariant: 'problem_stickers',
        productImageUrl: img1,
        stickers: content.card1.stickers,
        accentEffect: 'none',
      },

      // -------------------------------------------------------------
      // CARD 2: GIẢI PHÁP
      // -------------------------------------------------------------
      {
        stepNumber: 2,
        stepLabel: 'GIẢI PHÁP',
        headline: content.card2.headline,
        highlightWord: content.card2.highlightWord,
        subtitle: content.card2.subtitle,
        layoutVariant: 'solution_chips_top',
        productImageUrl: img1,
        featureChips: content.card2.chips,
        accentEffect: 'rays',
      },

      // -------------------------------------------------------------
      // CARD 3: KẾT QUẢ / TRẢI NGHIỆM
      // -------------------------------------------------------------
      {
        stepNumber: 3,
        stepLabel: 'KẾT QUẢ',
        headline: content.card3.headline,
        highlightWord: content.card3.highlightWord,
        subtitle: content.card3.subtitle,
        layoutVariant: 'result_human_touch',
        productImageUrl: img2,
        featureChips: content.card3.chips,
        accentEffect: 'rays',
        hasHandInteraction: true,
      },

      // -------------------------------------------------------------
      // CARD 4: ƯU ĐÃI & KÊU GỌI HÀNH ĐỘNG
      // -------------------------------------------------------------
      {
        stepNumber: 4,
        stepLabel: 'ƯU ĐÃI',
        headline: `${priceNumber} ${priceUnit}`,
        highlightWord: priceNumber,
        subtitle: content.card4.subtitle,
        layoutVariant: 'offer_huge_price',
        productImageUrl: img1,
        accentEffect: 'rays',
        offer: {
          priceNumber,
          priceUnit,
          voucherTag: 'Voucher giảm 10K',
          subNote: '* Có thể thay đổi theo khuyến mãi hôm nay',
          ctaText: 'Xem ở giỏ hàng >',
        },
      },
    ]

    return {
      productName,
      category,
      theme,
      cards,
    }
  }

  private generateCategoryContent(category: ProductCategory, productName: string) {
    switch (category) {
      case 'kitchen':
        return {
          card1: {
            headline: 'Bếp núc bừa bộn & khó tìm',
            highlightWord: 'bừa bộn & khó tìm',
            subtitle: 'Đồ dùng để lung tung khiến việc nấu nướng mất thời gian và bực mình.',
            stickers: [
              { text: 'Bừa bộn', topPercent: 44, leftPercent: 20, rotationDeg: -6 },
              { text: 'Bất tiện', topPercent: 54, leftPercent: 68, rotationDeg: 8 },
              { text: 'Khó tìm', topPercent: 78, leftPercent: 18, rotationDeg: -4 },
            ],
          },
          card2: {
            headline: `Dùng ${productName.slice(0, 18)}`,
            highlightWord: productName.slice(0, 15),
            subtitle: 'Gọn gàng, dễ dùng và nâng cấp không gian bếp hiện đại.',
            chips: [
              { id: 'c1', iconName: 'shield', title: 'Chất liệu tốt' },
              { id: 'c2', iconName: 'touch', title: 'Dễ sử dụng' },
              { id: 'c3', iconName: 'box', title: 'Gọn gàng' },
            ],
          },
          card3: {
            headline: 'Gọn gàng và sạch đẹp hơn hẳn',
            highlightWord: 'gọn gàng và sạch đẹp',
            subtitle: 'Sắp xếp ngăn nắp, sinh hoạt và nấu nướng tiện lợi mỗi ngày.',
            chips: [
              { id: 'c4', iconName: 'sparkle', title: 'Dễ vệ sinh' },
              { id: 'c5', iconName: 'box', title: 'Tiết kiệm chỗ' },
              { id: 'c6', iconName: 'leaf', title: 'Bền đẹp' },
            ],
          },
          card4: {
            subtitle: 'Ưu đãi đặc quyền TikTok Shop hôm nay, bấm xem ngay ở giỏ hàng.',
          },
        }

      case 'desk_tech':
        return {
          card1: {
            headline: 'Bàn làm việc rối tinh rối mù',
            highlightWord: 'rối tinh rối mù',
            subtitle: 'Dây sạc lộn xộn, hay rơi xuống gầm và rất nhanh gãy đứt.',
            stickers: [
              { text: 'Dễ đứt gãy', topPercent: 44, leftPercent: 20, rotationDeg: -6 },
              { text: 'Rối tung', topPercent: 54, leftPercent: 70, rotationDeg: 8 },
              { text: 'Rơi gầm bàn', topPercent: 76, leftPercent: 22, rotationDeg: -4 },
            ],
          },
          card2: {
            headline: 'Đổi sang giải pháp này',
            highlightWord: 'giải pháp này',
            subtitle: 'Gọn gàng mép bàn, với tay là sạc được ngay lập tức.',
            chips: [
              { id: 'c1', iconName: 'zap', title: 'Gọn bàn' },
              { id: 'c2', iconName: 'shield', title: 'Chống đứt' },
              { id: 'c3', iconName: 'touch', title: 'Tiện lợi' },
            ],
          },
          card3: {
            headline: 'Góc làm việc chuẩn Minimalist',
            highlightWord: 'chuẩn Minimalist',
            subtitle: 'Tăng 100% cảm hứng làm việc, không còn phát bực vì dây nhợ.',
            chips: [
              { id: 'c4', iconName: 'sparkle', title: 'Thẩm mỹ cao' },
              { id: 'c5', iconName: 'box', title: 'Dễ lắp đặt' },
              { id: 'c6', iconName: 'clock', title: 'Bền bỉ' },
            ],
          },
          card4: {
            subtitle: 'Deal tốt hôm nay trên TikTok Shop, bấm xem ngay ở giỏ hàng.',
          },
        }

      case 'cleaning_home':
        return {
          card1: {
            headline: 'Lau nhà mệt mỏi & vắt bẩn tay',
            highlightWord: 'mệt mỏi & vắt bẩn tay',
            subtitle: 'Cây lau thông thường vừa nặng vừa khó lau sạch các góc khuất.',
            stickers: [
              { text: 'Bẩn tay', topPercent: 44, leftPercent: 22, rotationDeg: -6 },
              { text: 'Đau lưng', topPercent: 54, leftPercent: 68, rotationDeg: 8 },
              { text: 'Khó vắt', topPercent: 76, leftPercent: 20, rotationDeg: -4 },
            ],
          },
          card2: {
            headline: 'Dùng thử cây lau này',
            highlightWord: 'cây lau này',
            subtitle: 'Tự vắt thông minh, lau nhẹ nhàng một đường là sạch bong.',
            chips: [
              { id: 'c1', iconName: 'sparkle', title: 'Tự vắt sạch' },
              { id: 'c2', iconName: 'touch', title: 'Nhẹ tay' },
              { id: 'c3', iconName: 'box', title: 'Xoay 360°' },
            ],
          },
          card3: {
            headline: 'Sàn nhà bóng loáng tinh tươm',
            highlightWord: 'bóng loáng tinh tươm',
            subtitle: 'Tiết kiệm một nửa thời gian dọn dẹp, nhà cửa luôn thơm tho.',
            chips: [
              { id: 'c4', iconName: 'leaf', title: 'Tiết kiệm sức' },
              { id: 'c5', iconName: 'clock', title: 'Lau siêu nhanh' },
              { id: 'c6', iconName: 'shield', title: 'Bền chắc' },
            ],
          },
          card4: {
            subtitle: 'Đang có mã giảm giá kèm freeship, bấm xem ngay ở giỏ hàng nhé.',
          },
        }

      case 'bathroom_care':
        return {
          card1: {
            headline: 'Phòng tắm chật chội & ẩm ướt',
            highlightWord: 'chật chội & ẩm ướt',
            subtitle: 'Chai lọ để bừa bãi đọng nước, rất nhanh đóng cặn mốc.',
            stickers: [
              { text: 'Đọng nước', topPercent: 44, leftPercent: 20, rotationDeg: -6 },
              { text: 'Bừa bãi', topPercent: 54, leftPercent: 70, rotationDeg: 8 },
              { text: 'Ẩm mốc', topPercent: 76, leftPercent: 22, rotationDeg: -4 },
            ],
          },
          card2: {
            headline: 'Lắp ngay kệ này',
            highlightWord: 'kệ này',
            subtitle: 'Dán tường siêu dính không cần khoan, thoát nước thông minh.',
            chips: [
              { id: 'c1', iconName: 'shield', title: 'Không khoan' },
              { id: 'c2', iconName: 'sparkle', title: 'Thoát nước' },
              { id: 'c3', iconName: 'box', title: 'Chịu lực tốt' },
            ],
          },
          card3: {
            headline: 'Góc tắm gọn gàng như khách sạn',
            highlightWord: 'như khách sạn',
            subtitle: 'Tất cả đồ dùng ngăn nắp, khô ráo và sạch sẽ mỗi ngày.',
            chips: [
              { id: 'c4', iconName: 'leaf', title: 'Khô ráo' },
              { id: 'c5', iconName: 'box', title: 'Tiết kiệm chỗ' },
              { id: 'c6', iconName: 'touch', title: 'Dễ lau chùi' },
            ],
          },
          card4: {
            subtitle: 'Sắp hết deal hời hôm nay, bấm xem ngay ở giỏ hàng góc trái.',
          },
        }

      default:
        return {
          card1: {
            headline: 'Bất tiện & tốn nhiều thời gian',
            highlightWord: 'bất tiện & tốn thời gian',
            subtitle: 'Mỗi lần cần dùng lại loay hoay tìm kiếm rất phiền phức.',
            stickers: [
              { text: 'Bất tiện', topPercent: 44, leftPercent: 22, rotationDeg: -6 },
              { text: 'Mất thời gian', topPercent: 54, leftPercent: 66, rotationDeg: 8 },
              { text: 'Hay hỏng', topPercent: 76, leftPercent: 20, rotationDeg: -4 },
            ],
          },
          card2: {
            headline: 'Đổi sang món đồ này',
            highlightWord: 'món đồ này',
            subtitle: 'Nhỏ gọn thông minh, giải quyết triệt để vấn đề hàng ngày.',
            chips: [
              { id: 'c1', iconName: 'sparkle', title: 'Tiện lợi' },
              { id: 'c2', iconName: 'touch', title: 'Dễ dùng' },
              { id: 'c3', iconName: 'box', title: 'Gọn gàng' },
            ],
          },
          card3: {
            headline: 'Dùng một lần là ưng ý liền',
            highlightWord: 'ưng ý liền',
            subtitle: 'Cuộc sống tiện nghi hơn hẳn, chất lượng 10 điểm.',
            chips: [
              { id: 'c4', iconName: 'shield', title: 'Bền đẹp' },
              { id: 'c5', iconName: 'clock', title: 'Nhanh gọn' },
              { id: 'c6', iconName: 'leaf', title: 'Thẩm mỹ' },
            ],
          },
          card4: {
            subtitle: 'Xem ngay giá ưu đãi ở giỏ hàng góc trái màn hình nhé.',
          },
        }
    }
  }
}
