import {
  ProductInput,
  ProductAnalysis,
  VideoStrategy,
  VideoStoryboard,
  StoryboardSceneType,
} from '@/engines/core/types'
import { HomeUtilityEngine } from '@/engines/home/HomeUtilityEngine'

export interface GeminiAnalysisResponse {
  analysis: ProductAnalysis
  strategy: VideoStrategy
  storyboard: VideoStoryboard
  suggestedCaption: string
  suggestedHashtags: string[]
}

const GEMINI_SYSTEM_PROMPT = `Bạn là Đạo diễn Video & Chuyên gia Tăng trưởng TikTok UGC hàng đầu cho TikTok Shop Affiliate tại Việt Nam.
Nhiệm vụ của bạn: Nhận thông tin sản phẩm và phân tích chiến lược, viết kịch bản video TikTok 15 giây (5 phân cảnh, mỗi cảnh 3 giây) có tỷ lệ chuyển đổi cao nhất.

CÁC NGUYÊN TẮC BẮT BUỘC:
1. REAL PRODUCT FIRST: Bám sát đặc tính thực tế của sản phẩm từ mô tả. Không bịa đặt tính năng không có thật.
2. 3-SECOND ORGANIC HOOK: 3 giây đầu phải chạm đúng nỗi đau (pain point) hoặc thói quen khó chịu thường ngày của người dùng. Tránh văn phong quảng cáo truyền thống, hãy dùng văn phong người dùng thật chia sẻ kinh nghiệm ("Bực mình nhất là...", "Ai hay bị...", "Đừng vội mua... nếu chưa biết cái này").
3. 5 PHÂN CẢNH (15 GIÂY):
   - Scene 1 (0-3s, type: "hook"): Hook giật gân, khơi gợi vấn đề.
   - Scene 2 (3-6s, type: "problem"): Nỗi đau & tình trạng lộn xộn/khó khăn khi chưa có sản phẩm.
   - Scene 3 (6-9s, type: "demo"): Cơ chế sản phẩm giải quyết vấn đề (cách hoạt động thực tế).
   - Scene 4 (9-12s, type: "benefit"): Lợi ích, cảm giác tiện lợi & gọn gàng sau khi dùng.
   - Scene 5 (12-15s, type: "cta"): Kêu gọi hành động (CTA) nhẹ nhàng, tự nhiên cho Affiliate.
4. LỜI THOẠI (VOICEOVER): Tiếng Việt tự nhiên, súc tích, ngắt nghỉ hợp lý, độ dài mỗi câu từ 10 - 18 từ để đọc vừa vặn trong 3 giây.
5. TIÊU ĐỀ CHỮ (HEADLINE): Ngắn gọn, giật tít, viết hoa từ khóa quan trọng để hiển thị trên màn hình dọc 9:16.

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG ĐÚNG ĐỊNH DẠNG JSON THEO SCHEMA ĐÃ ĐỊNH.`

export async function analyzeProductWithGemini(
  product: ProductInput,
  customApiKey?: string
): Promise<GeminiAnalysisResponse> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY

  if (!apiKey || apiKey.trim() === '') {
    // Graceful fallback to algorithmic HomeUtilityEngine if no API key is provided
    return fallbackToAlgorithmicEngine(product)
  }

  const prompt = `Phân tích sản phẩm sau đây cho ngành hàng Home & Utility (Đồ gia dụng / Đồ tiện ích):
- Tên sản phẩm: ${product.name}
- Giá bán: ${product.price ? product.price.toLocaleString('vi-VN') + ' đ' : 'Chưa rõ'}
- Mô tả / Tính năng: ${product.description || 'Sản phẩm tiện ích gia dụng'}
- Đối tượng hướng tới: ${product.targetAudience || 'Người đi làm, gia đình, học sinh sinh viên'}
- Danh mục: ${product.category}

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
    "targetDuration": 15,
    "cta": "Bấm vào giỏ hàng góc trái màn hình nhé",
    "visualDirection": {
      "mood": "sáng sủa, gọn gàng",
      "lighting": "tự nhiên",
      "palette": ["#f8fafc", "#0f172a"],
      "environment": "bàn làm việc hiện đại"
    }
  },
  "storyboard": {
    "scenes": [
      {
        "id": "scene-1",
        "type": "hook",
        "duration": 3,
        "headline": "Tiêu đề chữ ngắn gọn giật tít",
        "subheadline": "Mô tả phụ",
        "voice": "Lời đọc tiếng Việt 3 giây",
        "visualPrompt": "Mô tả góc máy",
        "motionPreset": "zoom-in"
      },
      {
        "id": "scene-2",
        "type": "problem",
        "duration": 3,
        "headline": "Tiêu đề cảnh 2",
        "subheadline": "Mô tả phụ",
        "voice": "Lời đọc cảnh 2",
        "visualPrompt": "Mô tả góc máy cảnh 2",
        "motionPreset": "pan-right"
      },
      {
        "id": "scene-3",
        "type": "demo",
        "duration": 3,
        "headline": "Tiêu đề cảnh 3",
        "subheadline": "Mô tả phụ",
        "voice": "Lời đọc cảnh 3",
        "visualPrompt": "Mô tả góc máy cảnh 3",
        "motionPreset": "zoom-in"
      },
      {
        "id": "scene-4",
        "type": "benefit",
        "duration": 3,
        "headline": "Tiêu đề cảnh 4",
        "subheadline": "Mô tả phụ",
        "voice": "Lời đọc cảnh 4",
        "visualPrompt": "Mô tả góc máy cảnh 4",
        "motionPreset": "static"
      },
      {
        "id": "scene-5",
        "type": "cta",
        "duration": 3,
        "headline": "Tiêu đề cảnh 5 CTA",
        "subheadline": "Mô tả phụ",
        "voice": "Lời đọc cảnh 5",
        "visualPrompt": "Mô tả góc máy cảnh 5",
        "motionPreset": "zoom-out"
      }
    ]
  },
  "suggestedCaption": "Nội dung caption TikTok tự nhiên kèm icon",
  "suggestedHashtags": ["#dogiadung", "#meovat", "#tiktokmademebuyit", "#giadungthongminh", "#reviewgiadung"]
}`

  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
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
        targetDuration: parsed.strategy?.targetDuration || 15,
        cta: parsed.strategy?.cta || 'Bấm vào góc trái màn hình nhé',
        visualDirection: parsed.strategy?.visualDirection || {
          mood: 'gọn gàng, sáng sủa',
          lighting: 'tự nhiên',
          palette: ['#0f172a', '#f8fafc'],
          environment: 'không gian nhà hiện đại, ngăn nắp',
        },
      },
      storyboard: {
        totalDuration: 15,
        scenes: mappedScenes,
      },
      suggestedCaption: parsed.suggestedCaption || `${product.name} nhỏ gọn mà tiện bất ngờ!`,
      suggestedHashtags: Array.isArray(parsed.suggestedHashtags)
        ? parsed.suggestedHashtags
        : ['#dogiadung', '#meovat', '#reviewgiadung', '#tiktokmademebuyit'],
      }
    } catch (error) {
      console.warn(`[Gemini API] Error with model ${model}:`, error)
    }
  }

  console.warn('[Gemini API] All candidate models exhausted, falling back to algorithmic engine:', lastError)
  return fallbackToAlgorithmicEngine(product)
}

async function fallbackToAlgorithmicEngine(product: ProductInput): Promise<GeminiAnalysisResponse> {
  const engine = new HomeUtilityEngine()
  const analysis = await engine.analyzeProduct(product)
  const strategy = await engine.generateStrategy(product, analysis)
  const storyboard = await engine.generateStoryboard(product, strategy)

  return {
    analysis,
    strategy,
    storyboard,
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
