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
    analysis: ProductAnalysis
  ): Promise<VideoStrategy> {
    const format = analysis.recommendedFormat || 'problem-solution'
    const nameLower = (product.name || '').toLowerCase()
    const isCable = nameLower.includes('dây sạc') || nameLower.includes('cable') || nameLower.includes('kẹp dây')
    const isKitchen = nameLower.includes('gia vị') || nameLower.includes('bếp') || nameLower.includes('hũ') || nameLower.includes('nồi') || nameLower.includes('dao')
    
    // Natural TikTok organic hook tailored for Home & Utility
    let hook = `Ai thích nhà cửa gọn gàng, tiện lợi thì xem ngay món này nhé.`
    if (isCable) {
      hook = `Nhà ai dây sạc cứ rơi xuống gầm bàn như này thì thử miếng kẹp này xem.`
    } else if (isKitchen) {
      hook = `Góc bếp mà lộn xộn gia vị nấu nướng thì xem ngay giải pháp này nhé.`
    } else if (product.problemSolved) {
      hook = `${product.problemSolved} thì xem ngay cách giải quyết này nhé.`
    } else if (product.name) {
      hook = `Bạn đã biết đến ${product.name} cực kỳ tiện lợi này chưa?`
    }

    const ctaText = isKitchen
      ? 'Muốn góc bếp gọn gàng hơn thì mình để sản phẩm ở giỏ hàng góc trái nhé.'
      : 'Mình để thông tin và giá ưu đãi ở giỏ hàng góc trái màn hình nhé.'

    return {
      concept: `Giải quyết vấn đề bất tiện thực tế tại nhà với ${product.name}`,
      format,
      hook,
      angle: 'Góc nhìn chân thật người dùng trải nghiệm thực tế tại nhà (Organic TikTok UGC)',
      tone: 'Gần gũi, thực tế, trò chuyện tự nhiên, không quảng cáo nói quá',
      targetDuration: 15,
      cta: ctaText,
      visualDirection: {
        mood: 'Sáng sủa, hiện đại, sạch sẽ và ngăn nắp',
        lighting: 'Ánh sáng ban ngày tự nhiên mềm mại',
        palette: ['#FFFFFF', '#F3F4F6', '#E5E7EB', '#111827'],
        environment: isKitchen ? 'Góc bếp hiện đại, sạch sẽ và ngăn nắp' : 'Không gian gia đình hiện đại tối giản',
      },
    }
  }

  /**
   * Generate structured 15-second storyboard
   */
  async generateStoryboard(
    product: ProductInput,
    strategy: VideoStrategy
  ): Promise<VideoStoryboard> {
    const assets = product.assets || []
    const primaryAssetId = assets.find((a) => a.isPrimary)?.id || assets[0]?.id || 'asset-1'
    const secondaryAssetId = assets[1]?.id || primaryAssetId

    const nameLower = (product.name || '').toLowerCase()
    const isCable = nameLower.includes('dây sạc') || nameLower.includes('cable') || nameLower.includes('kẹp dây')
    const isKitchen = nameLower.includes('gia vị') || nameLower.includes('bếp') || nameLower.includes('hũ')

    const scene1Headline = isKitchen
      ? 'Góc bếp lộn xộn gia vị?'
      : isCable
      ? 'Dây sạc cứ rơi xuống sàn?'
      : 'Nhà bừa bộn tìm đồ khó?'

    const scene1Keywords = isKitchen
      ? ['bếp bừa bộn', 'gia vị', 'bất tiện']
      : isCable
      ? ['bừa bộn', 'dây sạc', 'bất tiện']
      : ['bừa bộn', 'bất tiện', 'tìm đồ']

    const scene2Voice = isKitchen
      ? `Đây là ${product.name}, thiết kế trong suốt cực kỳ thông minh và tiện dụng.`
      : isCable
      ? `Đây là miếng kẹp giữ dây ${product.name}, nhỏ mà cực kỳ hữu ích.`
      : `Đây là ${product.name}, món đồ nhỏ mà cực kỳ hữu ích cho gia đình.`

    const scene3Voice = isKitchen
      ? `Nắp bật thông minh mở một chạm, kèm muỗng múc tiện lợi chống ẩm mốc hoàn toàn.`
      : isCable
      ? `Chỉ cần dán mép bàn là giữ cùng lúc các loại dây cáp cố định luôn tại chỗ.`
      : `Thiết kế thông minh, giải quyết ngay vấn đề bừa bộn chỉ trong một nốt nhạc.`

    const scene3Headline = isKitchen
      ? 'Nắp bật một chạm tiện lợi'
      : isCable
      ? 'Cố định mọi loại dây cáp'
      : 'Sắp xếp nhanh chóng tiện lợi'

    const scene4Voice = isKitchen
      ? `Gian bếp nhìn gọn gàng sang xịn hẳn lên, nấu nướng cần gia vị gì lấy ngay tức thì.`
      : isCable
      ? `Bàn làm việc nhìn gọn hơn hẳn, dây sạc cần là với tay lấy được ngay.`
      : `Không gian nhà gọn gàng, đẹp mắt hơn hẳn, cần dùng là thấy ngay.`

    const scenes: StoryboardScene[] = [
      {
        id: 'scene-1',
        type: 'hook',
        duration: 2.5,
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
        duration: 3.5,
        voice: scene2Voice,
        tts: scene2Voice,
        headline: product.name.slice(0, 30),
        subheadline: 'Thiết kế thông minh, bám dính chắc chắn',
        keywords: [product.name, 'chắc chắn', 'tiện lợi'],
        productAssetIds: [primaryAssetId],
        backgroundType: 'clean_surface',
        visualPrompt: 'bright clean surface, warm sunlight, minimal Scandinavian interior, vertical 9:16',
        motionPreset: 'parallax_float',
      },
      {
        id: 'scene-3',
        type: 'demo',
        duration: 4.5,
        voice: scene3Voice,
        tts: scene3Voice,
        headline: scene3Headline,
        subheadline: 'Không còn cảnh bừa bộn tìm đồ',
        keywords: ['gọn gàng', 'cố định', 'tiện dụng'],
        productAssetIds: [secondaryAssetId],
        backgroundType: 'setup_action',
        visualPrompt: 'aesthetic space edge, clean minimalist apartment, vertical 9:16',
        motionPreset: 'subtle_zoom',
      },
      {
        id: 'scene-4',
        type: 'result',
        duration: 2.5,
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
        duration: 2.0,
        voice: strategy.cta,
        tts: strategy.cta,
        headline: 'Xem chi tiết ở góc trái',
        subheadline: product.price ? `Giá ưu đãi chỉ ${typeof product.price === 'number' ? product.price.toLocaleString('vi-VN') : product.price}đ` : 'Xem trong giỏ hàng',
        keywords: ['giỏ hàng', 'ưu đãi', 'mua ngay'],
        productAssetIds: [primaryAssetId],
        backgroundType: 'cta_gradient',
        visualPrompt: 'soft neutral gradient background with warm indoor ambiance, 9:16',
        motionPreset: 'scale_up',
      },
    ]

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
