import {
  ProductInput,
  ProductAnalysis,
  VideoStrategy,
  VideoStoryboard,
  StoryboardSceneType,
} from '@/engines/core/types'
import { HomeUtilityEngine } from '@/engines/home/HomeUtilityEngine'
import { CreativePlan } from '@/engines/creative/types'
import { VipeeCreativeDirector } from '@/engines/creative/VipeeCreativeDirector'

export interface GeminiAnalysisResponse {
  analysis: ProductAnalysis
  strategy: VideoStrategy
  storyboard: VideoStoryboard
  suggestedCaption: string
  suggestedHashtags: string[]
  creativePlan?: CreativePlan
}

const GEMINI_SYSTEM_PROMPT = `Bạn là Đạo diễn Video & Chuyên gia Tăng trưởng TikTok UGC hàng đầu cho TikTok Shop Affiliate tại Việt Nam.
Nhiệm vụ của bạn: Nhận thông tin sản phẩm và phân tích chiến lược, viết kịch bản video TikTok chuyển đổi cao với độ dài theo yêu cầu (15 giây, 30 giây hoặc 45 giây).

CÁC NGUYÊN TẮC BẮT BUỘC:
1. REAL PRODUCT FIRST: Bám sát đặc tính thực tế của sản phẩm từ mô tả. Không bịa đặt tính năng không có thật.
2. 3-SECOND ORGANIC HOOK: 3 giây đầu phải chạm đúng nỗi đau (pain point) hoặc thói quen khó chịu thường ngày của người dùng. Tránh văn phong quảng cáo truyền thống, hãy dùng văn phong người dùng thật chia sẻ kinh nghiệm ("Bực mình nhất là...", "Ai hay bị...", "Đừng vội mua... nếu chưa biết cái này").
3. QUY ĐỊNH THỜI LƯỢNG VÀ PHÂN CẢNH:
   - Thời lượng 15 giây: 5 phân cảnh, mỗi cảnh 3 giây (Hook -> Problem -> Demo -> Benefit -> CTA).
   - Thời lượng 30 giây: 6 phân cảnh, mỗi cảnh 5 giây (Hook -> Problem -> Chi tiết sản phẩm -> Demo giải pháp -> Lợi ích -> CTA).
   - Thời lượng 45 giây: 9 phân cảnh, mỗi cảnh 5 giây (Hook -> Problem -> Chi tiết -> Cách dùng -> Cơ chế -> Lợi ích -> So sánh/Độ bền -> Đánh giá người dùng -> CTA).
   Tổng duration của các cảnh phải bằng đúng thời lượng yêu cầu.
4. TUYỆT ĐỐI KHÔNG NÓI HOẶC HIỂN THỊ TRỰC TIẾP GIÁ TIỀN (SỐ TIỀN CỤ THỂ):
   - Không được viết hoặc đọc số tiền (như "150k", "155.000đ") vì giá TikTok Shop liên tục thay đổi theo Flash Sale và Voucher.
   - Thay vào đó, hãy dùng lời kêu gọi tò mò: "Đang có deal cực hời kèm freeship", "Bấm ngay vào giỏ hàng góc trái săn ưu đãi nhé", "Xem giá ưu đãi hôm nay ở giỏ hàng góc trái".
5. LỜI THOẠI (VOICEOVER): Tiếng Việt tự nhiên, súc tích, ngắt nghỉ hợp lý, khớp với thời lượng từng phân cảnh (khoảng 3 - 4 từ mỗi giây).
6. TIÊU ĐỀ CHỮ (HEADLINE): Ngắn gọn (dưới 35 ký tự), giật tít, viết hoa từ khóa quan trọng để hiển thị trên màn hình dọc 9:16.

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG ĐÚNG ĐỊNH DẠNG JSON THEO SCHEMA ĐÃ ĐỊNH.`

export async function analyzeProductWithGemini(
  product: ProductInput,
  customApiKey?: string,
  targetDuration: 15 | 30 | 45 = 15
): Promise<GeminiAnalysisResponse> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY

  if (!apiKey || apiKey.trim() === '') {
    // Graceful fallback to algorithmic HomeUtilityEngine if no API key is provided
    return fallbackToAlgorithmicEngine(product, targetDuration)
  }

  const sceneCount = targetDuration === 45 ? 9 : targetDuration === 30 ? 6 : 5
  const sceneSec = targetDuration === 15 ? 3 : 5

  const prompt = `Phân tích sản phẩm sau đây cho ngành hàng Home & Utility (Đồ gia dụng / Đồ tiện ích):
- Tên sản phẩm: ${product.name}
- Mô tả / Tính năng: ${product.description || 'Sản phẩm tiện ích gia dụng'}
- Đối tượng hướng tới: ${product.targetAudience || 'Người đi làm, gia đình, học sinh sinh viên'}
- Danh mục: ${product.category}
- THỜI LƯỢNG YÊU CẦU: ${targetDuration} GIÂY (Gồm chính xác ${sceneCount} phân cảnh, mỗi cảnh ${sceneSec} giây).
- NGUYÊN TẮC: TUYỆT ĐỐI KHÔNG ghi số tiền hoặc nói giá tiền cụ thể trong kịch bản. Thay vào đó hãy kêu gọi bấm vào giỏ hàng góc trái màn hình nhận giá ưu đãi.

Hãy trả về kết quả JSON với cấu trúc chính xác:
{
  "analysis": {
    "productType": "${product.name}",
    "mainProblem": "Nỗi đau / vấn đề lớn nhất sản phẩm giải quyết",
    "mainBenefit": "Lợi ích lớn nhất mang lại",
    "secondaryBenefits": ["Lợi ích 1", "Lợi ích 2"],
    "targetAudience": "Mô tả đối tượng mua tiềm năng",
    "sellingMechanism": "Cơ chế hoặc tính năng cốt lõi giúp giải quyết",
    "visualDemoPotential": "high",
    "recommendedFormat": "problem-solution",
    "reasoningSummary": "Lý do lựa chọn format này",
    "claimsAllowed": ["Gọn gàng", "Dễ lắp đặt"],
    "claimsToAvoid": ["Chữa bách bệnh", "Vĩnh cửu"]
  },
  "strategy": {
    "concept": "Khái niệm video",
    "format": "problem-solution",
    "hook": "Câu mở đầu 3s giật gân, tự nhiên",
    "angle": "Góc tiếp cận bán hàng",
    "tone": "thân thiện, hữu ích",
    "targetDuration": ${targetDuration},
    "cta": "Bấm vào giỏ hàng góc trái săn ưu đãi nhé",
    "visualDirection": {
      "mood": "sáng sủa, gọn gàng",
      "lighting": "tự nhiên",
      "palette": ["#f8fafc", "#0f172a"],
      "environment": "không gian gia đình hiện đại"
    }
  },
  "storyboard": {
    "scenes": [
      {
        "id": "scene-1",
        "type": "hook",
        "duration": ${sceneSec},
        "headline": "Tiêu đề chữ ngắn gọn giật tít",
        "subheadline": "Mô tả phụ",
        "voice": "Lời đọc tiếng Việt",
        "visualPrompt": "Mô tả góc máy",
        "motionPreset": "zoom-in"
      }
    ]
  },
  "suggestedCaption": "Nội dung caption TikTok tự nhiên kèm icon (không ghi giá tiền)",
  "suggestedHashtags": ["#dogiadung", "#meovat", "#tiktokmademebuyit", "#giadungthongminh", "#reviewgiadung"]
}`

  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
  ]
  let lastError = ''

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${GEMINI_SYSTEM_PROMPT}\n\n${prompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      })

      if (!res.ok) {
        lastError = await res.text()
        console.warn(`[Gemini API] Model ${model} returned ${res.status}, trying next...`)
        continue
      }

      const data = await res.json()
      const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!contentText) {
        continue
      }

      const parsed = JSON.parse(contentText)

    const rawScenes = parsed.storyboard?.scenes || []
    const mappedScenes = rawScenes.map((s: Record<string, unknown>, idx: number) => {
      const sceneType = (s.type as StoryboardSceneType) || 'hook'
      const voiceText = String(s.voice || '')
      return {
        id: String(s.id || `scene-${idx + 1}`),
        type: sceneType,
        duration: Number(s.duration) || 3,
        headline: String(s.headline || ''),
        subheadline: s.subheadline ? String(s.subheadline) : undefined,
        voice: voiceText,
        tts: voiceText,
        productAssetIds: [],
        backgroundType: 'color',
        visualPrompt: s.visualPrompt ? String(s.visualPrompt) : undefined,
        motionPreset: s.motionPreset ? String(s.motionPreset) : 'zoom-in',
      }
    })

    return {
      analysis: {
        productType: product.name,
        mainProblem: parsed.analysis?.mainProblem || 'Bừa bộn, mất thời gian dọn dẹp',
        mainBenefit: parsed.analysis?.mainBenefit || 'Không gian gọn gàng và tiện lợi',
        secondaryBenefits: Array.isArray(parsed.analysis?.secondaryBenefits)
          ? parsed.analysis.secondaryBenefits
          : ['Dễ sử dụng', 'Thẩm mỹ cao'],
        targetAudience: parsed.analysis?.targetAudience || 'Khách hàng quan tâm nhà cửa gọn gàng',
        sellingMechanism: parsed.analysis?.sellingMechanism || 'Thiết kế thông minh, giải quyết tức thì',
        visualDemoPotential: parsed.analysis?.visualDemoPotential || 'high',
        recommendedFormat: parsed.analysis?.recommendedFormat || 'problem-solution',
        reasoningSummary: parsed.analysis?.reasoningSummary || 'Phù hợp nhất với tâm lý khách hàng gia dụng',
        claimsAllowed: Array.isArray(parsed.analysis?.claimsAllowed) ? parsed.analysis.claimsAllowed : [],
        claimsToAvoid: Array.isArray(parsed.analysis?.claimsToAvoid) ? parsed.analysis.claimsToAvoid : [],
      },
      strategy: {
        concept: parsed.strategy?.concept || `Giải pháp tiện lợi với ${product.name}`,
        format: parsed.strategy?.format || 'problem-solution',
        hook: parsed.strategy?.hook || `Đừng bỏ qua ${product.name} nếu bạn thích sự gọn gàng, tiện lợi!`,
        angle: parsed.strategy?.angle || 'Giải pháp tiện lợi cho gia đình',
        tone: parsed.strategy?.tone || 'hữu ích, tự nhiên',
        targetDuration: Number(parsed.strategy?.targetDuration) || targetDuration,
        cta: parsed.strategy?.cta || 'Bấm vào góc trái màn hình nhé',
        visualDirection: parsed.strategy?.visualDirection || {
          mood: 'gọn gàng, sáng sủa',
          lighting: 'tự nhiên',
          palette: ['#0f172a', '#f8fafc'],
          environment: 'không gian nhà hiện đại, ngăn nắp',
        },
      },
      storyboard: {
        totalDuration: targetDuration,
        scenes: mappedScenes,
      },
      suggestedCaption: parsed.suggestedCaption || `${product.name} nhỏ gọn mà tiện bất ngờ!`,
      suggestedHashtags: Array.isArray(parsed.suggestedHashtags)
        ? parsed.suggestedHashtags
        : ['#dogiadung', '#meovat', '#reviewgiadung', '#tiktokmademebuyit'],
      creativePlan: await new VipeeCreativeDirector().createCreativePlan(
        product,
        {
          productType: product.name,
          mainProblem: parsed.analysis?.mainProblem || 'Bừa bộn, mất thời gian dọn dẹp',
          mainBenefit: parsed.analysis?.mainBenefit || 'Không gian gọn gàng và tiện lợi',
          secondaryBenefits: Array.isArray(parsed.analysis?.secondaryBenefits) ? parsed.analysis.secondaryBenefits : [],
          targetAudience: parsed.analysis?.targetAudience || 'Gia đình, người đi làm',
          sellingMechanism: parsed.analysis?.sellingMechanism || 'Thiết kế thông minh, giải quyết tức thì',
          visualDemoPotential: 'high',
          recommendedFormat: parsed.strategy?.format || 'problem-solution',
          reasoningSummary: '',
          claimsAllowed: [],
          claimsToAvoid: [],
        },
        { targetDuration, geminiApiKey: apiKey }
      ),
      }
    } catch (error) {
      console.warn(`[Gemini API] Error with model ${model}:`, error)
    }
  }

  console.warn('[Gemini API] All candidate models exhausted, falling back to algorithmic engine:', lastError)
  return fallbackToAlgorithmicEngine(product, targetDuration)
}

async function fallbackToAlgorithmicEngine(
  product: ProductInput,
  targetDuration: 15 | 30 | 45 = 15
): Promise<GeminiAnalysisResponse> {
  const engine = new HomeUtilityEngine()
  const analysis = await engine.analyzeProduct(product)
  const strategy = await engine.generateStrategy(product, analysis, targetDuration)
  const storyboard = await engine.generateStoryboard(product, strategy, targetDuration)
  const creativePlan = await new VipeeCreativeDirector().createCreativePlan(product, analysis, { targetDuration })

  return {
    analysis,
    strategy,
    storyboard,
    creativePlan,
    suggestedCaption: `${strategy.hook} 😅 ${analysis.mainBenefit}. Nhỏ mà tiện hơn mình nghĩ nhiều!`,
    suggestedHashtags: [
      '#dogiadung',
      '#giadungthongminh',
      '#organizer',
      '#meovatgiadinh',
      '#reviewgiadung',
    ],
  }
}
