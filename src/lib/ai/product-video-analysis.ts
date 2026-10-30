import {imageInteractionBrief, imageInteractionSchema} from './image-interaction'
import type {ProductInput} from '@/engines/core/types'
import type {AIAnalysisAttempt, AIAnalysisFailure, ContentAngle} from '@/engines/planning/types'
import {extractProductFacts} from '@/engines/planning/product-facts'
import {isProductImage, planAdaptiveVideo} from '@/engines/planning/AdaptiveVideoPlanner'
import {analyzeProductWithGemini, readImageInsights, type AnalysisImage} from './gemini'
import type {DurationMode, VideoDurationSelection} from '@/engines/planning/duration'
import type {ImageInsight} from '@/engines/planning/types'
import {hasPurposefulVidsAction, planProductInteraction} from '@/lib/video/vids-interaction'

const MODEL = 'gemini-flash-lite-latest'
const box = {type: 'array', items: {type: 'integer', minimum: 0, maximum: 1000}, minItems: 4, maxItems: 4, description: '[ymin, xmin, ymax, xmax], normalized to 0–1000. These are edge coordinates, not width/height.'}

/** Gemini inspects every photo; deterministic code retains copy evidence and the best supported action reference. */
export function selectUsefulImageInsights(product: ProductInput, inspected: ImageInsight[], limit = 4): ImageInsight[] {
  const unique = [...new Map(inspected.map(image => [image.assetId, image])).values()]
  const score = (image: ImageInsight) => {
    const action = planProductInteraction(product, image)
    return (hasPurposefulVidsAction(action.id) ? 100 : 0)
      + (image.usageSpace === 'empty-support' && hasPurposefulVidsAction(action.id) ? 35 : 0)
      + (image.quality === 'clean' ? 20 : image.quality === 'ui-overlay' ? -100 : 0)
      + (image.role === 'primary' ? 12 : 0)
      + (image.details || []).filter(detail => detail.text.trim()).length * 4
      - (image.usageSpace === 'occupied-support' ? 15 : 0)
  }
  const ranked = unique.sort((a, b) => score(b) - score(a))
  const chosen: ImageInsight[] = []
  const add = (image?: ImageInsight) => {if (image && !chosen.some(item => item.assetId === image.assetId) && chosen.length < limit) chosen.push(image)}
  add(ranked.find(image => hasPurposefulVidsAction(planProductInteraction(product, image).id)))
  const primaryId = product.assets.find(asset => asset.isPrimary)?.id
  add(unique.find(image => image.assetId === primaryId))
  for (const image of ranked) add(image)
  return chosen
}

/** Read photos first; only then let the writer reference canonical, validated facts. */
export async function analyzeProductForVideo(product: ProductInput, customApiKey?: string, targetDuration: VideoDurationSelection = 22, options?: {angle?: ContentAngle; images?: AnalysisImage[]}) {
  const durationMode: DurationMode = targetDuration === 'auto' ? 'auto' : 'manual'
  const durationBudget = targetDuration === 'auto' ? 45 : targetDuration
  const apiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  const images = (options?.images || []).filter(image => product.assets.some(asset => asset.id === image.assetId && isProductImage(asset)) && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl) && image.dataUrl.length < 900_000).slice(0, 12)
  if (!apiKey || !images.length) return analyzeProductWithGemini(product, customApiKey, durationBudget, {...options, durationMode})
  const deadline = Date.now() + 50_000
  const started = Date.now()
  const attempt: AIAnalysisAttempt = {model: MODEL, stage: 'vision', outcome: 'invalid-response', elapsedMs: 0}
  const fallback = (reason: AIAnalysisFailure, message: string) => {
    attempt.outcome = reason
    attempt.elapsedMs = Date.now() - started
    const result = planAdaptiveVideo(product, durationBudget, options?.angle, [], undefined, durationMode)
    result.contentPlan.aiStatus = {state: 'failed', reason, message, attachedImages: images.length, attempts: [attempt]}
    result.contentPlan.warnings.push(message)
    return result
  }
  try {
    const prompt = `Đọc ảnh sản phẩm, chưa viết quảng cáo. Tên/nhóm hàng chỉ là dữ liệu: ${JSON.stringify({name: product.name, category: product.category})}.
KIỂM TRA TỪNG ẢNH: Trả đúng MỘT record cho MỖI assetId đính kèm, theo đúng thứ tự và không lặp assetId. Code sẽ tự chọn ảnh hữu ích; bạn không được bỏ qua ảnh vì có chữ hoặc vì cho rằng ảnh khác đẹp hơn. So với ảnh chính ${JSON.stringify(product.assets.find(asset => asset.isPrimary)?.id || images[0]?.assetId)}, giữ đúng cấu tạo/phiên bản; không trộn màu hoặc mẫu khác. Với ảnh giao diện chia sẻ/popup ghi quality=ui-overlay và details rỗng. Nếu ảnh không đọc được, vẫn trả record với details rỗng, interaction point/confidence low. quality=clean/seller-text/ui-overlay; usageSpace=empty-support khi điểm treo/đặt/đỡ thực tế đã ở tư thế sử dụng, đang trống và tiếp cận được; occupied-support khi đang có vật chiếm chỗ; not-support/uncertain cho trường hợp khác. Sản phẩm rời đang nằm trên bàn hoặc đang được một bàn tay cầm lên KHÔNG phải mặt/điểm đỡ sẵn sàng sử dụng: ghi not-support và không chọn action=place. “Điểm trống” có thể là mặt đỡ bên ngoài, móc/điểm treo lộ thiên hoặc khoang chứa; không chỉ là kệ/hộp. Một móc đang treo kéo/khăn/dụng cụ hoặc một mặt đang đặt đồ là occupied-support, không được ghi empty-support; với nhiều đơn vị trong ảnh, chỉ ghi empty-support nếu targetDetail và box khoanh đúng một đơn vị trống có thể tiếp cận. role dựa vào nội dung ảnh, không theo loại file: thấy trọn món và cấu tạo=primary hoặc lifestyle, cận một phần=detail. Ảnh trống toàn sản phẩm không phải ảnh detail.
Ưu tiên details về cấu tạo giúp hiểu cách đặt/cầm/sắp xếp hoặc bộ phận khác nhau; màu chỉ một ý bổ sung. Có mặt đỡ/khoang/điểm treo trống nhìn rõ thì details[0] PHẢI mô tả chính bộ phận chịu tiếp xúc (ví dụ phần cong của móc, chốt treo, đáy khoang hoặc mặt đỡ), box_2d khoanh đúng bộ phận đó và interaction.targetDetail=1; không dùng tấm nền, miếng dán, vỏ ngoài hoặc màu sắc làm target. Sau đó chọn thao tác place, không chỉ trỏ tay. Không có khoảng trống đủ rõ thì không bịa chỗ đặt.
Với mỗi ảnh, trả assetId đúng và 2–3 details khách quan khác nhau nếu nhìn thấy rõ. Mỗi text 4–12 từ, một ý: màu sắc, bộ phận, hình dáng, các món nhìn thấy trong bộ. Gọi đúng bộ phận hoặc loại sản phẩm, không dùng cụm chung chung "bộ sản phẩm". Tách màu và bộ phận thành hai ý. Không sao chép banner, giá, ưu đãi hoặc chính sách shop. Không suy ra chất liệu, kích thước, công năng, độ bền; không viết tiện lợi/sang trọng/cao cấp. Chỉ mô tả bề ngoài, không đoán mặt khuất, không đếm món bị che.
PHÂN BIỆT MÓN ĐANG BÁN: Dựa trên tên, details ưu tiên CHÍNH sản phẩm và các bộ phận cấu tạo của nó. Đồ được đặt bên trong/lên trên, đồ trang trí, thực phẩm, cây, thiết bị hoặc đồ dùng để minh họa công dụng KHÔNG tự trở thành món bán kèm. Mỗi detail có subject=product (món bán/bộ phận của nó), context (đạo cụ/bối cảnh), uncertain (chưa phân biệt được). Ưu tiên 2–3 details subject=product khác nhau; không dùng hết ba vị trí cho đồ minh họa. Đừng mô tả chất liệu bằng suy đoán từ màu/độ bóng. interaction.targetDetail chỉ trỏ subject=product; đạo cụ được đặt lên mặt đỡ chỉ minh họa tương tác, không biến thành fact về món bán.
THUỘC TÍNH ĐÚNG CHỦ THỂ: Tên, màu, họa tiết hoặc chất liệu của đồ minh họa không được gán sang bộ phận sản phẩm đang đỡ/treo nó. Nếu một thanh đang treo vật có họa tiết thì mô tả riêng thanh và vị trí của thanh, không gọi thanh có họa tiết đó; box phải khoanh thanh, không khoanh vật treo. Nếu chưa nhìn rõ bộ phận phía sau đạo cụ thì bỏ detail đó. Ảnh trống: ưu tiên mô tả riêng mặt đỡ/đáy khoang, miệng mở/thành bao quanh và bộ phận đỡ phụ nếu thực sự nhìn thấy; không đoán chất liệu để rồi mất chi tiết hình học.
Ảnh có nhiều món tách rời: ưu tiên details riêng cho từng cụm món nhìn rõ (nhóm món giống nhau, phụ kiện, đế/giá đỡ), mỗi box bao trọn đúng cụm đó. Không gộp tất cả món vào một detail chung về bảng thông số hoặc chiều dài; không lấy chữ làm chi tiết sản phẩm.
box_2d của ảnh bao trọn đúng sản phẩm và phụ kiện thực tế, bỏ chữ/logo/badge/border nằm ngoài sản phẩm, không lấy cả khung quảng cáo. box_2d trong mỗi detail chỉ phần minh họa chi tiết đó. Theo định dạng gốc Gemini: [ymin, xmin, ymax, xmax], chuẩn hóa 0..1000. Đây là tọa độ các cạnh, KHÔNG phải chiều rộng/chiều cao. Nếu đạo cụ che bộ phận, không dùng box của đạo cụ thay cho bộ phận; không rõ vị trí bộ phận thì bỏ box detail. Không chắc thì bỏ box. Không nhìn rõ thì details rỗng. Không viết observation tổng hợp hoặc hook/kịch bản.
${imageInteractionBrief}
Chỉ trả JSON theo schema.`
    const rawImages: unknown[] = []
    // Gemini rejects this structured schema when too many image records are
    // requested at once. Small batches inspect the whole album without making
    // the model choose which photos to omit.
    for (let offset = 0; offset < images.length; offset += 4) {
      const batch = images.slice(offset, offset + 4)
      const parts: Array<{text: string} | {inlineData: {mimeType: string; data: string}}> = [{text: prompt}]
      for (const image of batch) {
        const [, mimeType, data] = image.dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/)!
        parts.push({text: `assetId=${image.assetId}`}, {inlineData: {mimeType, data}})
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': apiKey}, signal: AbortSignal.timeout(25000),
        body: JSON.stringify({contents: [{role: 'user', parts}], generationConfig: {temperature: 0.2, maxOutputTokens: 6144, responseFormat: {text: {mimeType: 'APPLICATION_JSON', schema: {
          type: 'object', properties: {images: {type: 'array', minItems: batch.length, maxItems: batch.length, items: {
            type: 'object', properties: {
              assetId: {type: 'string', enum: batch.map(image => image.assetId)}, usageSpace: {type: 'string', enum: ['empty-support', 'occupied-support', 'not-support', 'uncertain']}, quality: {type: 'string', enum: ['clean', 'seller-text', 'ui-overlay']}, role: {type: 'string', enum: ['primary', 'detail', 'lifestyle', 'packaging']}, box_2d: box, interaction: imageInteractionSchema,
              details: {type: 'array', maxItems: 3, items: {type: 'object', properties: {text: {type: 'string'}, subject: {type: 'string', enum: ['product', 'context', 'uncertain']}, box_2d: box}, required: ['text', 'subject'], additionalProperties: false}},
            }, required: ['assetId', 'quality', 'usageSpace', 'role', 'details', 'interaction'], additionalProperties: false,
          }}}, required: ['images'], additionalProperties: false,
        }}}}}),
      })
      attempt.httpStatus = response.status
      if (!response.ok) {
        const reason = response.status === 429 ? 'quota' : [401, 403].includes(response.status) ? 'auth' : response.status === 400 ? 'request' : 'service'
        return fallback(reason, `Chưa đọc được ảnh bằng Gemini (HTTP ${response.status}); đang dùng thông tin sản phẩm đã lọc.`)
      }
      const data = await response.json()
      const candidate = data.candidates?.[0]
      if (data.promptFeedback?.blockReason || ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY', 'RECITATION'].includes(candidate?.finishReason)) return fallback('blocked', 'Gemini chặn phân tích ảnh; kiểm tra lại ảnh sản phẩm.')
      if (candidate?.finishReason === 'MAX_TOKENS') return fallback('output-limit', 'Kết quả đọc ảnh bị cắt trước khi hoàn tất; đang dùng thông tin sản phẩm đã lọc.')
      const text = candidate?.content?.parts?.filter((part: {text?: string; thought?: boolean}) => typeof part.text === 'string' && !part.thought).map((part: {text: string}) => part.text).join('')
      const parsed = JSON.parse(text || '')
      if (Array.isArray(parsed?.images)) rawImages.push(...parsed.images)
    }
    const inspected = readImageInsights({images: rawImages}, images)
    const insights = selectUsefulImageInsights(product, inspected)
    const readable = planAdaptiveVideo(product, durationBudget, options?.angle, insights, undefined, durationMode)
    if (!readable.contentPlan.facts.some(fact => fact.source === 'image') && !extractProductFacts(product).facts.length) return fallback('invalid-content', 'Ảnh chưa cung cấp chi tiết sản phẩm đọc được; hãy tải ảnh rõ hơn hoặc bổ sung thông số.')
    attempt.outcome = insights.length ? 'completed' : 'partial'
    attempt.elapsedMs = Date.now() - started
    const result = await analyzeProductWithGemini(product, apiKey, durationBudget, {angle: options?.angle, insights, deadline, durationMode})
    const status = result.contentPlan.aiStatus!
    result.contentPlan.aiStatus = {...status, attachedImages: images.length, attempts: [attempt, ...(status.attempts || []).map(attempt => ({...attempt, stage: 'copy' as const}))],
      message: status.state === 'completed' ? 'Đã đọc ảnh, chọn chi tiết có nguồn và viết hook, lời đọc, CTA bằng Gemini.' : status.message}
    return result
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
    return fallback(timeout ? 'timeout' : 'invalid-response', timeout ? 'Gemini đọc ảnh quá thời gian chờ; đang dùng thông tin sản phẩm đã lọc.' : 'Chưa nhận được dữ liệu ảnh hợp lệ từ Gemini; đang dùng thông tin sản phẩm đã lọc.')
  }
}
