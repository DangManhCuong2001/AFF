import { ProductAnalysis, ProductInput } from '@/engines/core/types'
import {
  CreativeDirector,
  CreativePlan,
  CreativeScore,
  HookCandidate,
  StoryApproach,
} from './types'
import { OfferEngine } from '@/engines/offer/OfferEngine'

const VIPEE_DIRECTOR_SYSTEM_PROMPT = `Bạn là Vipee Creative Director & Senior Direct-Response TikTok Video Editor hàng đầu.
Nhiệm vụ của bạn: Từ thông tin sản phẩm, KHÔNG viết slideshow quảng cáo nhàm chán ("Đây là sản phẩm...").
Bạn phải tạo một video TikTok UGC chân thật, có nhân vật, có nhịp, có câu chuyện (Storytelling), khiến người xem cảm thấy "Đúng là mình cũng gặp vấn đề này!".

NGUYÊN TẮC BẮT BUỘC:
1. KHÔNG BAO GIỜ BẮT ĐẦU BẰNG: "Đây là sản phẩm...", "Tôi giới thiệu...", "Sản phẩm này có...".
2. BÁN QUA VẤN ĐỀ & CÂU CHUYỆN (Problem -> Curiosity -> Micro-Story -> Demo -> Payoff -> Natural CTA). Sản phẩm xuất hiện như một GIẢI PHÁP, không phải chủ đề quảng cáo.
3. KỊCH BẢN ĐỂ NÓI (SPOKEN VIETNAMESE): Dùng khẩu ngữ tự nhiên, câu ngắn, ngắt nghỉ hợp lý, có nhịp điệu (mix câu ngắn, câu nhỡ, khoảng lặng, ngạc nhiên).
4. TẠO 5 HOOK CANDIDATES và chấm điểm nội bộ để chọn hook điểm cao nhất (tò mò, gần gũi, cụ thể, giàu hình ảnh).
5. TUYỆT ĐỐI KHÔNG BỊA ĐẶT GIẢM GIÁ HOẶC VOUCHER ẢO.
6. HỖ TRỢ ĐA DẠNG APPROACHES: micro-story, problem-solution, curiosity-test, before-after, relatable-moment, unexpected-use, mini-review, pov, three-reasons, satisfying, challenge, comparison, daily-frustration.
`

export class VipeeCreativeDirector implements CreativeDirector {
  async createCreativePlan(
    product: ProductInput,
    analysis: ProductAnalysis,
    options?: {
      targetDuration?: 15 | 30 | 45
      approach?: StoryApproach
      geminiApiKey?: string
    }
  ): Promise<CreativePlan> {
    const duration = options?.targetDuration || 15
    const apiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY
    const chosenApproach = options?.approach || this.determineBestApproach(product, analysis)
    const offerInfo = OfferEngine.analyzeOffer(product)

    if (apiKey && apiKey.trim()) {
      try {
        const plan = await this.generateWithGemini(
          product,
          analysis,
          chosenApproach,
          duration,
          offerInfo,
          apiKey.trim()
        )
        if (plan) return plan
      } catch (err) {
        console.warn('[VipeeCreativeDirector] Gemini generation error, falling back to algorithmic engine:', err)
      }
    }

    // Algorithmic Direct Response Director Fallback
    return this.generateAlgorithmicPlan(product, analysis, chosenApproach, duration, offerInfo)
  }

  /**
   * Automatically select best story approach based on product attributes
   */
  private determineBestApproach(product: ProductInput, analysis: ProductAnalysis): StoryApproach {
    const text = `${product.name} ${product.description || ''} ${product.problemSolved || ''}`.toLowerCase()
    
    if (text.includes('dây sạc') || text.includes('cable') || text.includes('kẹp')) {
      return 'micro-story'
    }
    if (text.includes('gia vị') || text.includes('bếp') || text.includes('hũ') || text.includes('hộp')) {
      return 'daily-frustration'
    }
    if (text.includes('vệ sinh') || text.includes('lau') || text.includes('rửa') || text.includes('chổi')) {
      return 'satisfying'
    }
    if (analysis.recommendedFormat === 'before-after' || text.includes('trước và sau')) {
      return 'before-after'
    }
    if (text.includes('thử') || text.includes('test')) {
      return 'curiosity-test'
    }
    return 'relatable-moment'
  }

  /**
   * Gemini 3.5 Flash powered creative director
   */
  private async generateWithGemini(
    product: ProductInput,
    analysis: ProductAnalysis,
    approach: StoryApproach,
    duration: 15 | 30 | 45,
    offerInfo: ReturnType<typeof OfferEngine.analyzeOffer>,
    apiKey: string
  ): Promise<CreativePlan | null> {
    const models = ['gemini-flash-latest', 'gemini-flash-lite-latest']
    
    const prompt = `Phân tích và đạo diễn kịch bản video TikTok UGC cho sản phẩm:
- Tên sản phẩm: ${product.name}
- Mô tả / Công dụng: ${product.description || analysis.mainBenefit}
- Vấn đề giải quyết: ${analysis.mainProblem}
- Thời lượng: ${duration} giây
- Phong cách câu chuyện yêu cầu: ${approach}
- Thông tin ưu đãi thật: ${offerInfo.hasPrice ? `Giá: ${offerInfo.displayPriceText} (${offerInfo.spokenPriceText})` : 'Không có giá niêm yết'}
  ${offerInfo.hasVoucher ? 'Có voucher thật' : 'Không có voucher'}
  ${offerInfo.hasFreeShipping ? 'Có freeship' : 'Không có freeship'}

Yêu cầu xuất ra JSON chính xác theo cấu trúc:
{
  "concept": "Tên concept độc đáo đánh trúng tâm lý",
  "viewerInsight": "Thấu cảm tâm lý sâu sắc của người xem về phiền toái hàng ngày",
  "sellingMechanism": "Cơ chế biến sản phẩm thành vị cứu tinh giải quyết phiền toái",
  "emotionalArc": ["recognition", "annoyance", "curiosity", "relief", "desire"],
  "storyType": "${approach}",
  "hookCandidates": [
    {
      "id": "h1",
      "text": "Câu hook 1",
      "type": "observation",
      "scores": { "curiosity": 85, "relatability": 90, "specificity": 80, "visualPotential": 85, "clarity": 90, "total": 86 },
      "reasoning": "Lý do điểm cao"
    },
    { "id": "h2", "text": "Câu hook 2", "type": "confession", "scores": { "curiosity": 80, "relatability": 85, "specificity": 75, "visualPotential": 80, "clarity": 85, "total": 81 }, "reasoning": "..." },
    { "id": "h3", "text": "Câu hook 3", "type": "problem", "scores": { "curiosity": 90, "relatability": 92, "specificity": 88, "visualPotential": 89, "clarity": 91, "total": 90 }, "reasoning": "..." },
    { "id": "h4", "text": "Câu hook 4", "type": "curiosity", "scores": { "curiosity": 88, "relatability": 80, "specificity": 85, "visualPotential": 82, "clarity": 87, "total": 84 }, "reasoning": "..." },
    { "id": "h5", "text": "Câu hook 5", "type": "pov", "scores": { "curiosity": 82, "relatability": 88, "specificity": 80, "visualPotential": 84, "clarity": 86, "total": 84 }, "reasoning": "..." }
  ],
  "selectedHookIndex": 2,
  "story": "Tóm tắt mạch câu chuyện súc tích",
  "payoff": "Điểm thăng hoa thỏa mãn khi vấn đề được giải quyết êm đẹp",
  "openLoop": {
    "setup": "Câu tạo tò mò dở dang ở đầu",
    "payoff": "Lời giải đáp thỏa mãn ở giữa video"
  },
  "offerAngle": "Góc nhìn giá trị hợp lý",
  "cta": "Lời kêu gọi hành động tự nhiên (không hét giá ảo)",
  "spokenScenes": [
    { "beat": "hook", "headline": "Tiêu đề giật tít có icon", "voice": "Lời thoại mở đầu tự nhiên, giọng bạn bè chia sẻ (vd: Ai mà hay bị... thì xem ngay nha!)" },
    { "beat": "problem", "headline": "Vấn đề khó chịu", "voice": "Lời thoại bộc lộ sự phiền toái thường ngày chân thật..." },
    { "beat": "solution", "headline": "Cứu tinh xuất hiện", "voice": "Lời thoại hé lộ giải pháp (vd: May mà mình tậu được cái này, nhỏ mà tiện dã man luôn á!)..." },
    { "beat": "demo", "headline": "Trải nghiệm thực tế", "voice": "Lời thoại mô tả tính năng cụ thể khiến người xem thích thú..." },
    { "beat": "cta", "headline": "Bấm giỏ hàng mua ngay", "voice": "Lời thoại chốt đơn tự nhiên, kêu gọi xem giỏ hàng góc trái..." }
  ],
  "creativeScore": {
    "hookScore": 90,
    "relatabilityScore": 92,
    "visualVarietyScore": 88,
    "productClarityScore": 91,
    "storyScore": 89,
    "offerScore": 85,
    "overallQuality": 89
  }
}`

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${VIPEE_DIRECTOR_SYSTEM_PROMPT}\n\n${prompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        })

        if (!res.ok) continue
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) continue

        const parsed = JSON.parse(text)
        const hookCandidates: HookCandidate[] = Array.isArray(parsed.hookCandidates) ? parsed.hookCandidates : []
        const bestHook = hookCandidates.length > 0
          ? hookCandidates.reduce((max, cur) => cur.scores?.total > max.scores?.total ? cur : max, hookCandidates[0])
          : this.generateDefaultHooks(product, approach)[0]

        return {
          concept: parsed.concept || `Giải pháp thông minh cho phiền toái thường ngày`,
          viewerInsight: parsed.viewerInsight || `Người dùng thường chấp nhận sự bất tiện như thói quen cho đến khi thấy giải pháp gọn nhẹ.`,
          sellingMechanism: parsed.sellingMechanism || `Nêu đúng nỗi đau quen thuộc rồi hé lộ giải pháp đơn giản đến bất ngờ.`,
          emotionalArc: Array.isArray(parsed.emotionalArc) ? parsed.emotionalArc : ['recognition', 'annoyance', 'curiosity', 'relief', 'desire'],
          storyType: approach,
          hookCandidates: hookCandidates.length >= 3 ? hookCandidates : this.generateDefaultHooks(product, approach),
          selectedHook: bestHook,
          story: parsed.story || `Nhắc lại phiền toái, chuyển sang trải nghiệm thực tế với ${product.name}, kết thúc bằng sự ngăn nắp.`,
          payoff: parsed.payoff || `Không gian gọn gàng tức thì, không còn cảnh khó chịu mỗi ngày.`,
          openLoop: parsed.openLoop,
          offerAngle: parsed.offerAngle || offerInfo.recommendedCta.displayText,
          cta: parsed.cta || offerInfo.recommendedCta.voiceText,
          duration,
          spokenScenes: Array.isArray(parsed.spokenScenes) ? parsed.spokenScenes : undefined,
          creativeScore: {
            hookScore: parsed.creativeScore?.hookScore || 88,
            relatabilityScore: parsed.creativeScore?.relatabilityScore || 90,
            visualVarietyScore: parsed.creativeScore?.visualVarietyScore || 85,
            productClarityScore: parsed.creativeScore?.productClarityScore || 89,
            storyScore: parsed.creativeScore?.storyScore || 88,
            offerScore: parsed.creativeScore?.offerScore || 86,
            overallQuality: parsed.creativeScore?.overallQuality || 88,
            needsRevision: false,
          },
        }
      } catch (e) {
        console.warn(`[VipeeCreativeDirector] Model ${model} failed:`, e)
      }
    }

    return null
  }

  /**
   * Generates 5 ranked hook candidates natively
   */
  private generateDefaultHooks(product: ProductInput, approach: StoryApproach): HookCandidate[] {
    const nameLower = product.name.toLowerCase()
    const isKitchen = nameLower.includes('gia vị') || nameLower.includes('bếp') || nameLower.includes('hũ')
    const isCable = nameLower.includes('dây sạc') || nameLower.includes('cable') || nameLower.includes('kẹp dây')

    if (isCable) {
      return [
        {
          id: 'h1',
          text: 'Ngày nào cũng có đúng một việc làm mình khó chịu mỗi khi ngồi vào bàn...',
          type: 'observation',
          scores: { curiosity: 92, relatability: 95, specificity: 88, visualPotential: 90, clarity: 92, total: 91 },
          reasoning: 'Gợi mở thói quen bực mình hàng ngày khiến người xem dừng lại để xem chuyện gì.',
        },
        {
          id: 'h2',
          text: 'Có ai ngày nào cũng phải cúi xuống gầm bàn nhặt dây sạc như mình không?',
          type: 'problem',
          scores: { curiosity: 88, relatability: 96, specificity: 92, visualPotential: 94, clarity: 95, total: 93 },
          reasoning: 'Đánh trúng 100% người dùng có bàn làm việc bừa bộn.',
        },
        {
          id: 'h3',
          text: 'Mình đã nghĩ món 39 nghìn này khá vô dụng, cho đến khi dán nó ở mép bàn...',
          type: 'confession',
          scores: { curiosity: 95, relatability: 88, specificity: 89, visualPotential: 86, clarity: 90, total: 90 },
          reasoning: 'Cung cấp góc nhìn nghi ngờ rồi bất ngờ thỏa mãn.',
        },
        {
          id: 'h4',
          text: 'POV: Cuối cùng bàn làm việc của bạn cũng không còn như một cái tổ nhện.',
          type: 'pov',
          scores: { curiosity: 86, relatability: 90, specificity: 84, visualPotential: 92, clarity: 89, total: 88 },
          reasoning: 'Bắt trend POV của giới trẻ TikTok rất tự nhiên.',
        },
        {
          id: 'h5',
          text: 'Bàn làm việc nhìn bừa không phải vì nhiều đồ, mà do bạn chưa biết mẹo này.',
          type: 'curiosity',
          scores: { curiosity: 90, relatability: 89, specificity: 85, visualPotential: 88, clarity: 90, total: 88 },
          reasoning: 'Tạo tò mò định hình lại nhận thức của người xem.',
        },
      ]
    }

    if (isKitchen) {
      return [
        {
          id: 'h1',
          text: 'Mỗi lần nấu ăn mà vội vàng là y như rằng góc bếp lộn xộn như một bãi chiến trường.',
          type: 'problem',
          scores: { curiosity: 90, relatability: 96, specificity: 91, visualPotential: 93, clarity: 94, total: 93 },
          reasoning: 'Nỗi đau bếp núc kinh điển của bất kỳ ai vào bếp.',
        },
        {
          id: 'h2',
          text: 'Nhà ai góc bếp cũng có một mớ gia vị nắp lỏng lẻo dễ ẩm mốc đúng không?',
          type: 'observation',
          scores: { curiosity: 89, relatability: 94, specificity: 90, visualPotential: 90, clarity: 92, total: 91 },
          reasoning: 'Chỉ ra hiện trạng gia vị bị ẩm vón cục gây khó chịu.',
        },
        {
          id: 'h3',
          text: 'Mình từng nghĩ hũ gia vị nào chả như nhau, cho đến khi thử bộ nắp bật một chạm này...',
          type: 'confession',
          scores: { curiosity: 94, relatability: 89, specificity: 88, visualPotential: 91, clarity: 90, total: 90 },
          reasoning: 'Mở đầu phản trực giác kích thích xem tiếp.',
        },
        {
          id: 'h4',
          text: 'Góc bếp nhìn sang xịn lên gấp đôi chỉ nhờ thay đổi đúng một chi tiết nhỏ này.',
          type: 'curiosity',
          scores: { curiosity: 92, relatability: 87, specificity: 86, visualPotential: 92, clarity: 89, total: 89 },
          reasoning: 'Hứa hẹn kết quả nâng cấp thẩm mỹ tức thì.',
        },
        {
          id: 'h5',
          text: 'POV: Bạn nấu ăn mà không phải loay hoay tìm muỗng hay cạy từng cái nắp gia vị.',
          type: 'pov',
          scores: { curiosity: 87, relatability: 91, specificity: 85, visualPotential: 89, clarity: 88, total: 88 },
          reasoning: 'Trải nghiệm mượt mà không va vấp.',
        },
      ]
    }

    // Generic home utility hooks
    return [
      {
        id: 'h1',
        text: `Nhà ai cũng có một góc bừa bộn tìm mãi không thấy đồ đúng không?`,
        type: 'observation',
        scores: { curiosity: 89, relatability: 94, specificity: 86, visualPotential: 88, clarity: 91, total: 90 },
        reasoning: 'Khơi gợi sự đồng cảm tức thì.',
      },
      {
        id: 'h2',
        text: `Một món đồ nhỏ thôi nhưng lại giải quyết đúng thứ làm mình bực mình cả năm qua.`,
        type: 'curiosity',
        scores: { curiosity: 93, relatability: 91, specificity: 88, visualPotential: 89, clarity: 90, total: 90 },
        reasoning: 'Tạo open loop tò mò cực mạnh.',
      },
      {
        id: 'h3',
        text: `Mình đã chán cảnh đồ đạc cứ lung tung khắp nơi, cho đến khi thử món này...`,
        type: 'confession',
        scores: { curiosity: 91, relatability: 89, specificity: 85, visualPotential: 87, clarity: 90, total: 88 },
        reasoning: 'Tâm sự chân thật người dùng.',
      },
      {
        id: 'h4',
        text: `Không gian nhà gọn gàng hơn hẳn chỉ mất đúng 1 phút sắp xếp lại.`,
        type: 'problem',
        scores: { curiosity: 88, relatability: 90, specificity: 87, visualPotential: 90, clarity: 92, total: 89 },
        reasoning: 'Cam kết giải pháp nhanh chóng.',
      },
      {
        id: 'h5',
        text: `Đừng mua thêm đồ đạc lung tung nữa nếu góc nhà bạn chưa có món này.`,
        type: 'test',
        scores: { curiosity: 92, relatability: 86, specificity: 84, visualPotential: 86, clarity: 88, total: 87 },
        reasoning: 'Cảnh báo ngược tạo tò mò cao.',
      },
    ]
  }

  /**
   * Algorithmic Plan Fallback with zero AI dependence
   */
  private generateAlgorithmicPlan(
    product: ProductInput,
    analysis: ProductAnalysis,
    approach: StoryApproach,
    duration: 15 | 30 | 45,
    offerInfo: ReturnType<typeof OfferEngine.analyzeOffer>
  ): CreativePlan {
    const candidateHooks = this.generateDefaultHooks(product, approach)
    const selectedHook = candidateHooks[0]

    const nameLower = product.name.toLowerCase()
    const isCable = nameLower.includes('dây sạc') || nameLower.includes('cable') || nameLower.includes('kẹp dây')
    const isKitchen = nameLower.includes('gia vị') || nameLower.includes('bếp') || nameLower.includes('hũ')

    const spokenScenes = isCable
      ? [
          { beat: 'hook', headline: '🔥 DÂY SẠC RƠI BỪA BÃI?', voice: selectedHook.text, sticker: 'CẢNH BÁO ⚠️' },
          { beat: 'problem', headline: '😩 CÚI NHẶT MỎI CẢ LƯNG', voice: 'Bình thường cúi xuống gầm bàn nhặt dây vừa bẩn vừa mỏi lưng, dây lại còn nhanh gãy đứt nữa chứ!', sticker: 'PHIỀN TOÁI 😩' },
          { beat: 'solution', headline: '✨ CỨU TINH 10/10 ĐÂY RỒI', voice: `May mà mình tậu được cái miếng kẹp này, nhỏ xíu mà tiện dã man luôn á!`, sticker: 'GIẢI PHÁP ⭐' },
          { beat: 'demo', headline: '🔒 DÁN LÀ DÍNH CHẮC NỊCH', voice: 'Chỉ cần dán mép bàn là giữ ngay ngắn mọi loại dây sạc, cần cái là rút ra dùng cực êm!', sticker: 'SIÊU DÍNH 🔒' },
          { beat: 'cta', headline: '🛒 GIỎ HÀNG GÓC TRÁI', voice: 'Bàn làm việc gọn gàng 10 điểm luôn nha, mọi người bấm ngay giỏ hàng góc trái săn deal nhé!', sticker: 'MUA NGAY 🛍️' },
        ]
      : isKitchen
      ? [
          { beat: 'hook', headline: '🔥 GÓC BẾP LỘN XỘN GIA VỊ?', voice: selectedHook.text, sticker: 'LỘN XỘN ⚠️' },
          { beat: 'problem', headline: '😩 TÌM MÃI KHÔNG THẤY ĐỒ', voice: 'Mỗi lần nấu ăn vội mà gia vị vương vãi lộn xộn, tìm mãi không ra phát bực luôn á!', sticker: 'ẨM MỐC 😩' },
          { beat: 'solution', headline: '✨ NẮP BẬT MỘT CHẠM CỰC ÊM', voice: `Cho đến khi mình thử bộ hũ này, nắp bật một chạm kèm muỗng tiện dã man!`, sticker: 'GIẢI PHÁP ⭐' },
          { beat: 'demo', headline: '🔒 KÍN KHÍ CHỐNG ẨM TUYỆT ĐỐI', voice: 'Kín khí chống ẩm mốc hoàn toàn, nấu nướng một tay mở nắp múc gia vị cực nhanh!', sticker: 'TIỆN LỢI ✨' },
          { beat: 'cta', headline: '🛒 GIỎ HÀNG GÓC TRÁI', voice: 'Góc bếp nhìn sang xịn hẳn lên, mọi người bấm ngay giỏ hàng góc trái săn deal ưu đãi nha!', sticker: 'SĂN DEAL 🛍️' },
        ]
      : [
          { beat: 'hook', headline: '🔥 AI BỊ NHƯ NÀY XEM NGAY!', voice: selectedHook.text, sticker: 'MẸO HAY 🔥' },
          { beat: 'problem', headline: '😩 BỪA BỘN MẤT THỜI GIAN', voice: 'Đồ đạc cứ vứt lung tung mỗi lần tìm phát bực, mất bao nhiêu thời gian luôn đúng không!', sticker: 'BỰC MÌNH 😩' },
          { beat: 'solution', headline: '✨ BẤT NGỜ TIỆN LỢI', voice: `May mà mình tìm được em ${product.name} này, nhỏ gọn mà giải quyết vấn đề cực êm!`, sticker: 'CỨU TINH ⭐' },
          { beat: 'demo', headline: '👌 DÙNG CỰC KỲ DỄ DÀNG', voice: 'Dùng siêu đơn giản, vừa vặn chắc chắn mà không gian nhìn gọn gàng hẳn lên!', sticker: '10 ĐIỂM 💯' },
          { beat: 'cta', headline: '🛒 BẤM GÓC TRÁI MUA NGAY', voice: 'Phòng ốc gọn gàng ưng cái bụng luôn, mọi người bấm ngay giỏ hàng góc trái săn ưu đãi nha!', sticker: 'MUA NGAY 🛍️' },
        ]

    return {
      concept: `Giải pháp giải phóng không gian và phiền toái với ${product.name}`,
      viewerInsight: `Người xem thường cam chịu sự bừa bộn nhỏ nhặt mỗi ngày mà không nhận ra nó làm hao tốn thời gian và tâm trạng.`,
      sellingMechanism: `Chỉ ra cảm giác phiền toái quen thuộc, sau đó hé lộ giải pháp đơn giản, thông minh và giá trị vượt trội.`,
      emotionalArc: ['recognition', 'annoyance', 'curiosity', 'relief', 'desire'],
      storyType: approach,
      hookCandidates: candidateHooks,
      selectedHook,
      story: `Khởi đầu bằng sự khó chịu hàng ngày, hé lộ giải pháp thông minh ${product.name}, trải nghiệm thực tế và kêu gọi xem giỏ hàng.`,
      payoff: `Không gian nhà gọn gàng, tâm trạng thoải mái mỗi khi bước vào phòng.`,
      offerAngle: offerInfo.recommendedCta.displayText,
      cta: offerInfo.recommendedCta.voiceText,
      duration,
      spokenScenes,
      creativeScore: {
        hookScore: selectedHook.scores.total,
        relatabilityScore: 92,
        visualVarietyScore: 88,
        productClarityScore: 90,
        storyScore: 89,
        offerScore: 86,
        overallQuality: 89,
        needsRevision: false,
      },
    }
  }
}
