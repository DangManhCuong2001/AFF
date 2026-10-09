import { ProductVideoEngine } from '../core/ProductVideoEngine'
import {
  ProductInput,
  ProductAnalysis,
  VideoStrategy,
  VideoStoryboard,
  GeneratedAssets,
  RenderedVideo,
  VideoProject,
  ProductCategory,
  StoryboardScene,
} from '../core/types'
import { HOME_FORMAT_DEFINITIONS } from './formats'
import { HomeVideoFormat } from './types'

export class HomeUtilityEngine implements ProductVideoEngine {
  readonly id = 'home-utility'
  readonly name = 'Home & Utility Engine'
  readonly category: ProductCategory = 'home'

  /**
   * Analyze Home & Utility product
   * (Ground logic for Phase 2, hooked to Gemini in Phase 3)
   */
  async analyzeProduct(product: ProductInput): Promise<ProductAnalysis> {
    const assets = product.assets || []
    const hasVideoAsset = assets.some(
      (a) => a.type === 'PRODUCT_VIDEO' || a.type === 'DEMO_VIDEO'
    )

    // Determine default recommended format based on available assets and product problem
    let recommendedFormat: HomeVideoFormat = 'problem-solution'
    if (product.problemSolved?.toLowerCase().includes('bừa bộn') || product.problemSolved?.toLowerCase().includes('ngăn kéo')) {
      recommendedFormat = 'before-after'
    } else if (hasVideoAsset && product.problemSolved?.toLowerCase().includes('bụi')) {
      recommendedFormat = 'product-test'
    } else if (hasVideoAsset) {
      recommendedFormat = 'satisfying-demo'
    } else {
      recommendedFormat = 'problem-solution'
    }

    return {
      productType: product.name || 'Đồ gia dụng tiện ích',
      mainProblem: product.problemSolved || 'Không gian gia đình bừa bộn và bất tiện khi sử dụng hàng ngày.',
      mainBenefit: product.benefits?.[0] || 'Giúp sắp xếp gọn gàng, tiết kiệm không gian và tiện lợi tức thì.',
      secondaryBenefits: product.benefits?.slice(1) || [
        'Dễ dàng sử dụng và sắp xếp gọn gàng',
        'Chất liệu bền đẹp, phù hợp mọi không gian',
      ],
      targetAudience: product.targetAudience || 'Người nội trợ, dân văn phòng, người ở trọ và gia đình hiện đại',
      sellingMechanism: 'PROBLEM_SOLVE_DEMO',
      visualDemoPotential: hasVideoAsset ? 'high' : 'medium',
      recommendedFormat,
      reasoningSummary: `Sản phẩm ${product.name} giải quyết trực diện vấn đề bất tiện thường ngày. Định dạng ${HOME_FORMAT_DEFINITIONS[recommendedFormat]?.name || 'Problem-Solution'} giúp người xem thấy ngay giá trị thực tế trong 3 giây đầu.`,
      claimsAllowed: [
        'Giữ vật dụng cố định và gọn gàng',
        'Thiết kế thông minh, kích thước nhỏ gọn',
        product.price ? `Giá chỉ từ ${typeof product.price === 'number' ? product.price.toLocaleString('vi-VN') : product.price}đ` : 'Giá ưu đãi',
      ],
      claimsToAvoid: [
        'Cam kết hiệu quả 100% khi chưa có video chứng minh',
        'Quảng cáo sai lệch tính năng khi mô tả không đề cập',
        'Dùng từ ngữ cấm như "siêu phẩm số 1", "cam kết trị dứt điểm"',
      ],
    }
  }

  /**
   * Generate video angle and hook strategy
   */
  async generateStrategy(
    product: ProductInput,
    analysis: ProductAnalysis,
    targetDuration: number = 15
  ): Promise<VideoStrategy> {
    const format = analysis.recommendedFormat || 'problem-solution'
    // Natural TikTok organic hook tailored for product
    let hook = `Ai thích nhà cửa gọn gàng, tiện lợi thì xem ngay món này nhé.`
    if (product.problemSolved) {
      hook = `Ai mà hay gặp tình trạng ${product.problemSolved.toLowerCase()} thì xem ngay giải pháp này nhé.`
    } else if (product.name) {
      hook = `Bạn đã biết đến ${product.name} cực kỳ tiện lợi này chưa?`
    }

    const ctaText = 'Mình để thông tin và ưu đãi ở giỏ hàng góc trái màn hình, nhanh tay bấm vào nhận mã freeship nhé.'

    return {
      concept: `Giải quyết vấn đề bất tiện thực tế tại nhà với ${product.name}`,
      format,
      hook,
      angle: 'Góc nhìn chân thật người dùng trải nghiệm thực tế tại nhà (Organic TikTok UGC)',
      tone: 'Gần gũi, thực tế, trò chuyện tự nhiên, không quảng cáo nói quá',
      targetDuration,
      cta: ctaText,
      visualDirection: {
        mood: 'Sáng sủa, hiện đại, sạch sẽ và ngăn nắp',
        lighting: 'Ánh sáng ban ngày tự nhiên mềm mại',
        palette: ['#FFFFFF', '#F3F4F6', '#E5E7EB', '#111827'],
        environment: 'Không gian sống hiện đại, sạch sẽ và ngăn nắp',
      },
    }
  }

  /**
   * Generate structured storyboard (15s, 30s, or 45s)
   */
  async generateStoryboard(
    product: ProductInput,
    strategy: VideoStrategy,
    targetDuration: number = 15
  ): Promise<VideoStoryboard> {
    const assets = product.assets || []
    const primaryAssetId = assets.find((a) => a.isPrimary)?.id || assets[0]?.id || 'asset-1'
    const secondaryAssetId = assets[1]?.id || primaryAssetId

    const mainProblem = product.problemSolved || 'đồ đạc bừa bộn và bất tiện mỗi khi sử dụng'
    const mainBenefit = product.benefits?.[0] || 'sắp xếp gọn gàng và tiện lợi tức thì'
    const secondaryBenefit = product.benefits?.[1] || 'chất liệu cao cấp, dùng bền đẹp theo thời gian'

    const scene1Headline = `Giải pháp cho ${product.name.slice(0, 20)}`
    const scene1Keywords = [product.name.slice(0, 15), 'tiện lợi', 'gọn gàng']

    const scene2Voice = `Đây là ${product.name}, thiết kế thông minh và cực kỳ tiện dụng cho gia đình.`
    const scene3Voice = `Điểm ưng ý nhất là ${mainBenefit.toLowerCase()}, giải quyết triệt để vấn đề chỉ trong vài giây.`
    const scene3Headline = 'Thiết kế thông minh tiện lợi'
    const scene4Voice = `Không gian nhìn gọn gàng sang xịn hẳn lên nhờ ${secondaryBenefit.toLowerCase()}, ưng cái bụng 10 điểm luôn!`

    let scenes: StoryboardScene[] = []

    if (targetDuration === 30) {
      // 30 seconds = 6 scenes x 5 seconds
      scenes = [
        {
          id: 'scene-1',
          type: 'hook',
          duration: 5,
          voice: strategy.hook,
          tts: strategy.hook,
          headline: scene1Headline,
          subheadline: 'Bực mình nhất mỗi lần tìm đồ',
          keywords: scene1Keywords,
          productAssetIds: [primaryAssetId],
          backgroundType: 'cluttered_desk_context',
          visualPrompt: 'modern minimalist home context with clean ambient light, 9:16 vertical, no product, soft shadow',
          motionPreset: 'slow_push_in',
        },
        {
          id: 'scene-2',
          type: 'problem',
          duration: 5,
          voice: `Bình thường ${mainProblem.toLowerCase()}, vừa mất thời gian lại dễ cáu gắt mỗi khi cần dùng gấp.`,
          tts: `Bình thường ${mainProblem.toLowerCase()}, vừa mất thời gian lại dễ cáu gắt mỗi khi cần dùng gấp.`,
          headline: 'Vấn đề thường gặp',
          subheadline: 'Bực mình mỗi ngày',
          keywords: ['bừa bộn', 'bất tiện', 'phiền phức'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_surface',
          motionPreset: 'parallax_float',
        },
        {
          id: 'scene-3',
          type: 'product_hero',
          duration: 5,
          voice: scene2Voice,
          tts: scene2Voice,
          headline: product.name.slice(0, 30),
          subheadline: 'Chất liệu cao cấp, độ bền vượt trội',
          keywords: [product.name.slice(0, 15), 'chắc chắn', 'tiện lợi'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_surface',
          visualPrompt: 'bright clean surface, warm sunlight, minimal interior, vertical 9:16',
          motionPreset: 'parallax_float',
        },
        {
          id: 'scene-4',
          type: 'demo',
          duration: 5,
          voice: scene3Voice,
          tts: scene3Voice,
          headline: scene3Headline,
          subheadline: 'Thao tác dễ dàng trong 1 giây',
          keywords: ['gọn gàng', 'tiện dụng', 'dễ dùng'],
          productAssetIds: [secondaryAssetId],
          backgroundType: 'setup_action',
          visualPrompt: 'aesthetic space edge, clean apartment, vertical 9:16',
          motionPreset: 'subtle_zoom',
        },
        {
          id: 'scene-5',
          type: 'benefit',
          duration: 5,
          voice: scene4Voice,
          tts: scene4Voice,
          headline: 'Không gian gọn gàng 100%',
          subheadline: 'Nâng tầm thẩm mỹ cho ngôi nhà',
          keywords: ['ngăn nắp', 'thẩm mỹ', 'gọn gàng'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_organized_result',
          visualPrompt: 'modern tidy aesthetic setup, warm daylight, vertical 9:16',
          motionPreset: 'slow_pan',
        },
        {
          id: 'scene-6',
          type: 'cta',
          duration: 5,
          voice: strategy.cta,
          tts: strategy.cta,
          headline: 'Xem ưu đãi trong giỏ hàng',
          subheadline: 'Bấm góc trái để săn deal và freeship',
          keywords: ['giỏ hàng', 'ưu đãi', 'mua ngay'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'cta_gradient',
          visualPrompt: 'soft neutral gradient background with warm indoor ambiance, 9:16',
          motionPreset: 'scale_up',
        },
      ]
    } else if (targetDuration === 45) {
      // 45 seconds = 9 scenes x 5 seconds
      scenes = [
        {
          id: 'scene-1',
          type: 'hook',
          duration: 5,
          voice: strategy.hook,
          tts: strategy.hook,
          headline: scene1Headline,
          subheadline: 'Bực mình nhất mỗi lần tìm đồ',
          keywords: scene1Keywords,
          productAssetIds: [primaryAssetId],
          backgroundType: 'cluttered_desk_context',
          visualPrompt: 'modern minimalist home context, 9:16 vertical',
          motionPreset: 'slow_push_in',
        },
        {
          id: 'scene-2',
          type: 'problem',
          duration: 5,
          voice: `Trước đây lúc nào cũng khó chịu vì ${mainProblem.toLowerCase()}, tìm kiếm mất thời gian mà lại nhanh hỏng hóc đồ dùng.`,
          tts: `Trước đây lúc nào cũng khó chịu vì ${mainProblem.toLowerCase()}, tìm kiếm mất thời gian mà lại nhanh hỏng hóc đồ dùng.`,
          headline: 'Nỗi đau bừa bộn kéo dài',
          subheadline: 'Làm mất thời gian quý báu',
          keywords: ['bừa bộn', 'bất tiện', 'phiền phức'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_surface',
          motionPreset: 'parallax_float',
        },
        {
          id: 'scene-3',
          type: 'product_hero',
          duration: 5,
          voice: scene2Voice,
          tts: scene2Voice,
          headline: product.name.slice(0, 30),
          subheadline: 'Giải pháp hoàn hảo cho mọi gia đình',
          keywords: [product.name.slice(0, 15), 'thông minh', 'bền đẹp'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_surface',
          motionPreset: 'parallax_float',
        },
        {
          id: 'scene-4',
          type: 'demo',
          duration: 5,
          voice: scene3Voice,
          tts: scene3Voice,
          headline: scene3Headline,
          subheadline: 'Trải nghiệm sử dụng cực đã',
          keywords: ['tiện lợi', 'dễ dùng', 'nhanh chóng'],
          productAssetIds: [secondaryAssetId],
          backgroundType: 'setup_action',
          motionPreset: 'subtle_zoom',
        },
        {
          id: 'scene-5',
          type: 'demo',
          duration: 5,
          voice: `Được hoàn thiện từ chất liệu cao cấp với độ bền vượt trội, thiết kế tinh xảo và tiện dụng cho mọi gia đình.`,
          tts: `Được hoàn thiện từ chất liệu cao cấp với độ bền vượt trội, thiết kế tinh xảo và tiện dụng cho mọi gia đình.`,
          headline: 'Chất liệu cao cấp',
          subheadline: 'An toàn và bền đẹp dài lâu',
          keywords: ['chất liệu', 'cao cấp', 'an toàn'],
          productAssetIds: [secondaryAssetId],
          backgroundType: 'setup_action',
          motionPreset: 'subtle_zoom',
        },
        {
          id: 'scene-6',
          type: 'benefit',
          duration: 5,
          voice: scene4Voice,
          tts: scene4Voice,
          headline: 'Không gian gọn gàng 100%',
          subheadline: 'Nâng cấp trải nghiệm sống',
          keywords: ['gọn gàng', 'sạch đẹp', 'hiện đại'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_organized_result',
          motionPreset: 'slow_pan',
        },
        {
          id: 'scene-7',
          type: 'benefit',
          duration: 5,
          voice: 'Từ ngày có món này, việc nhà trở nên nhẹ nhàng hơn hẳn, ai đến chơi nhà cũng khen gọn gàng ngăn nắp.',
          tts: 'Từ ngày có món này, việc nhà trở nên nhẹ nhàng hơn hẳn, ai đến chơi nhà cũng khen gọn gàng ngăn nắp.',
          headline: 'Ai nhìn cũng khen',
          subheadline: 'Cuộc sống tiện nghi hơn',
          keywords: ['tiện nghi', 'hài lòng', 'khen ngợi'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_organized_result',
          motionPreset: 'slow_pan',
        },
        {
          id: 'scene-8',
          type: 'benefit',
          duration: 5,
          voice: 'Hàng nghìn người đã mua và đánh giá 5 sao vì độ tiện dụng vượt trội so với các sản phẩm truyền thống.',
          tts: 'Hàng nghìn người đã mua và đánh giá 5 sao vì độ tiện dụng vượt trội so với các sản phẩm truyền thống.',
          headline: 'Đánh giá 5 sao uy tín',
          subheadline: 'Hàng nghìn khách hàng tin chọn',
          keywords: ['uy tín', '5 sao', 'tin cậy'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_organized_result',
          motionPreset: 'slow_pan',
        },
        {
          id: 'scene-9',
          type: 'cta',
          duration: 5,
          voice: strategy.cta,
          tts: strategy.cta,
          headline: 'Xem ưu đãi trong giỏ hàng',
          subheadline: 'Bấm góc trái để săn deal và freeship',
          keywords: ['giỏ hàng', 'ưu đãi', 'mua ngay'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'cta_gradient',
          visualPrompt: 'soft neutral gradient, 9:16',
          motionPreset: 'scale_up',
        },
      ]
    } else {
      // Default: 15 seconds = 5 scenes x 3 seconds
      scenes = [
        {
          id: 'scene-1',
          type: 'hook',
          duration: 3,
          voice: strategy.hook,
          tts: strategy.hook,
          headline: scene1Headline,
          subheadline: 'Bực mình nhất mỗi lần tìm đồ',
          keywords: scene1Keywords,
          productAssetIds: [primaryAssetId],
          backgroundType: 'cluttered_desk_context',
          visualPrompt: 'modern minimalist home context with clean ambient light, 9:16 vertical, no product, soft shadow',
          motionPreset: 'slow_push_in',
        },
        {
          id: 'scene-2',
          type: 'product_hero',
          duration: 3,
          voice: scene2Voice,
          tts: scene2Voice,
          headline: product.name.slice(0, 30),
          subheadline: 'Thiết kế thông minh, độ bền vượt trội',
          keywords: [product.name.slice(0, 15), 'tiện lợi', 'chất lượng'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_surface',
          visualPrompt: 'bright clean surface, warm sunlight, minimal Scandinavian interior, vertical 9:16',
          motionPreset: 'parallax_float',
        },
        {
          id: 'scene-3',
          type: 'demo',
          duration: 3,
          voice: scene3Voice,
          tts: scene3Voice,
          headline: scene3Headline,
          subheadline: 'Trải nghiệm tiện lợi tức thì',
          keywords: ['gọn gàng', 'tiện dụng', 'dễ dùng'],
          productAssetIds: [secondaryAssetId],
          backgroundType: 'setup_action',
          visualPrompt: 'aesthetic space edge, clean minimalist apartment, vertical 9:16',
          motionPreset: 'subtle_zoom',
        },
        {
          id: 'scene-4',
          type: 'benefit',
          duration: 3,
          voice: scene4Voice,
          tts: scene4Voice,
          headline: 'Không gian gọn gàng 100%',
          subheadline: 'Tiết kiệm thời gian, thẩm mỹ cao',
          keywords: ['ngăn nắp', 'thẩm mỹ', 'gọn gàng'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'clean_organized_result',
          visualPrompt: 'modern tidy aesthetic setup, warm daylight, vertical 9:16',
          motionPreset: 'slow_pan',
        },
        {
          id: 'scene-5',
          type: 'cta',
          duration: 3,
          voice: strategy.cta,
          tts: strategy.cta,
          headline: 'Xem ưu đãi trong giỏ hàng',
          subheadline: 'Bấm góc trái để nhận ưu đãi và freeship',
          keywords: ['giỏ hàng', 'ưu đãi', 'mua ngay'],
          productAssetIds: [primaryAssetId],
          backgroundType: 'cta_gradient',
          visualPrompt: 'soft neutral gradient background with warm indoor ambiance, 9:16',
          motionPreset: 'scale_up',
        },
      ]
    }

    const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0)
    return { scenes, totalDuration }
  }

  /**
   * Generate visual and background assets
   */
  async generateAssets(project: VideoProject): Promise<GeneratedAssets> {
    const backgrounds = (project.storyboard?.scenes || []).map((scene) => ({
      sceneId: scene.id,
      url: `/placeholders/bg-${scene.type}.jpg`,
      prompt: scene.visualPrompt,
    }))

    return {
      backgrounds,
      processedProductAssets: project.product.assets.map((a) => ({
        originalId: a.id,
        url: a.url,
      })),
    }
  }

  /**
   * Compose video into final MP4
   */
  async composeVideo(project: VideoProject): Promise<RenderedVideo> {
    const primaryAsset = project.product.assets.find((a) => a.isPrimary) || project.product.assets[0]

    return {
      videoUrl: primaryAsset?.url || '/sample-video.mp4',
      duration: project.storyboard?.totalDuration || 15,
      width: 1080,
      height: 1920,
      format: 'mp4',
      coverImageUrl: primaryAsset?.url,
    }
  }
}

// Auto-register HomeUtilityEngine into the singleton registry
import { engineRegistry } from '../core/engine-registry'
engineRegistry.register(new HomeUtilityEngine())
