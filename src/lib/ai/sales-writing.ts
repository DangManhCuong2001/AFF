import type {ProductFact} from '@/engines/planning/types'
import {sellingContextForFact} from '@/engines/planning/commerce-copy'
import {distinctFacts} from '@/engines/planning/copy-novelty'
import {isProductDetail} from '@/engines/planning/product-facts'
import type {StoryboardScene} from '@/engines/core/types'

/** More useful information earns more scenes; duration alone never creates facts. */
export function salesWritingBudget(facts: ProductFact[], seconds: number) {
  const usable = distinctFacts(facts.filter(fact => isProductDetail(fact.text) && fact.text.trim().split(/\s+/).length <= 18))
  const bodyLimit = seconds >= 30 ? 4 : seconds >= 20 ? 3 : 2
  const bodyScenes = Math.min(bodyLimit, Math.max(1, usable.length))
  return {sceneCount: bodyScenes + 2, bodyScenes, wordTarget: Math.floor(seconds * 2.7)}
}

/** Keep whole sourced sentences. Never cut a sentence or pad it with filler. */
export function fitSalesScenes(scenes: StoryboardScene[], maxScenes: number, maxWords: number, firstBodyAlternative?: {voice: string; evidenceIds: string[]}) {
  const fitted = [...scenes]
  const removed: string[] = []
  let compacted = false
  const count = (text: string) => text.trim().split(/\s+/).length
  const total = () => fitted.reduce((sum, scene) => sum + count(scene.voice), 0)
  const removeLastExtra = () => {
    if (fitted.length <= 3) return false
    const [scene] = fitted.splice(fitted.length - 2, 1)
    removed.push(scene.id)
    return true
  }
  while (fitted.length > Math.max(3, maxScenes) && removeLastExtra()) { /* Keep the focus explanation and CTA. */ }
  if (total() > maxWords && firstBodyAlternative && fitted[1]?.type !== 'cta' && count(firstBodyAlternative.voice) < count(fitted[1].voice)) {
    const first = fitted[1]
    fitted[1] = {...first, voice: firstBodyAlternative.voice, tts: firstBodyAlternative.voice, renderPlan: first.renderPlan ? {...first.renderPlan, evidenceIds: firstBodyAlternative.evidenceIds} : undefined}
    compacted = true
  }
  while (total() > maxWords && removeLastExtra()) { /* Drop one complete secondary idea, not half a line. */ }
  return {scenes: fitted, removed, compacted}
}

/** Drop a repeated preference preamble only when narration is over its comfortable
 * word budget. The action and decision information remain the model's own words. */
export function compactDecisionVoice(text: string) {
  const compact = text.replace(/^Nếu (?:bạn )?(?:thích|đang cần|ưu tiên)[^.!?]{1,100},\s*(?:bạn (?:hãy|có thể)\s+)?(?=(?:nhấn|bấm|mở)\s)/i, '')
  return compact ? compact[0].toLocaleUpperCase('vi') + compact.slice(1) : text
}

/** Applied to both photo-first and text-only writing, without another AI request. */
export function salesWritingBrief(facts: ProductFact[]) {
  const situations = facts.flatMap(fact => {
    const context = sellingContextForFact(fact)
    return context ? [{evidenceId: fact.id, hypotheticalNeed: context.need, consideration: context.reason}] : []
  })
  return `CÁCH BÁN HÀNG: Viết như người tư vấn giúp khách chọn, không như đọc danh sách thông số. Một video một nhu cầu chính: NHU CẦU → LÝ DO CÂN NHẮC → CHI TIẾT LÀM CĂN CỨ → HÀNH ĐỘNG.
Hook chạm nhu cầu hoặc sở thích, đồng thời nêu một dấu hiệu nhận ra đúng sản phẩm. Chỉ chọn dấu hiệu ngắn, không nhồi nguyên câu fact vào hook rồi đọc lại nó trong thân bài. Gọi đúng món đang bán: nếu tên là một bộ, phụ kiện chỉ là điểm nhấn, không biến phụ kiện thành món bán riêng. Không bịa vấn đề người xem đang gặp. Có thể hỏi "Bạn đang tìm...", "Nếu bạn thích...", không khẳng định người xem chắc chắn thuộc một nhóm hay đang gặp khó khăn.
MỞ ĐẦU CÓ NGƯỜI XEM: Đặt nhu cầu hoặc tình huống chọn mua lên trước, sau đó nối một dấu hiệu ngắn có nguồn. Không lấy nguyên tên bộ phận rồi thêm "có đáng cân nhắc không?", "có đáng mua không?" làm hook; đó chưa phải nhu cầu cụ thể. Không biến một chi tiết nhỏ thành toàn bộ món đang bán. Có thể dùng 2 câu ngắn trong cùng hook nếu tổng vẫn không quá 18 từ.
Thân đầu tiên nối chi tiết có nguồn với ý nghĩa chọn mua: tại sao một người có nhu cầu đó nên cân nhắc mẫu này. Đưa câu giải thích trước hoặc cùng căn cứ, không đọc lại hook. Cảnh tiếp theo thêm một chi tiết có nguồn khác; không thêm một câu hỏi kiểm tra cho mỗi thông số. Nối ý thành cuộc nói chuyện, tránh ba câu cùng một cấu trúc. Không lạm dụng "đáng cân nhắc nếu bạn ưu tiên" như một câu đệm; hãy diễn đạt sở thích hoặc nhu cầu cụ thể, chẳng hạn phối đồ cùng tông hoặc bố trí theo khoảng cách.
ĐỘ SÂU NỘI DUNG: Khi có đủ dữ liệu cho bản 20–30 giây, ngoài dấu hiệu nhận ra sản phẩm, chọn thêm những ý KHÁC NHAU giúp quyết định: thành phần bộ, bộ phận nhìn thấy, kích thước/kiểu kết nối/chất liệu có nguồn hoặc điểm cần đối chiếu. Không dành toàn bộ thân bài để nhắc lại màu sắc. Mỗi cảnh thân gắn với ảnh hoặc vùng ảnh có đúng chi tiết; ảnh có cùng một góc vẫn là cùng một góc, không gọi là ảnh mặt sau/góc khác. CTA mời mở nhóm thông tin còn cần xem và giá hiện tại, thay vì chỉ nói "xem bộ này". Có số liệu thì đọc chính xác; không đủ nguồn thì giữ ít ý và ngắn hơn.
MẠCH LỜI ĐỌC: Đọc thử toàn bộ scenes.voice như một đoạn nói từ đầu đến cuối. Mỗi cảnh kết thúc trọn ý, không dừng ở dấu phẩy hoặc các từ "và", "nhưng", "vì", "để", "nếu", "với" rồi nối nửa câu sang cảnh khác. Dùng chuyển ý ngắn chỉ khi cần; không mở mỗi cảnh bằng một câu hỏi độc lập. Chủ thể vẫn là đúng sản phẩm, không chuyển sang một món khác hoặc thêm ý mới ở CTA.
Với bản 20–30 giây có ít nhất 3 ý có nguồn, mỗi cảnh thân thường 12–20 từ: giới thiệu chi tiết cùng vị trí/cách bố trí nhìn thấy hoặc điều cần cân nhắc theo nhu cầu. Đừng rút tất cả cảnh thân thành các nhãn 6–8 từ rời rạc. Dùng "Phần...", "Bên dưới...", "Ngoài ra..." để nối đúng quan hệ nhìn thấy khi phù hợp. Không thêm lời khen hoặc câu đệm chỉ để đủ số từ.
ĐƯỢC: diễn đạt lại tự nhiên và đặt tình huống giả định liên quan trực tiếp đến nguồn. Với chiều dài dây đã có trong nguồn, liên hệ nhu cầu bố trí dây xa thiết bị và đọc đúng thông số; không cam kết dây chắc chắn vươn tới mọi vị trí. Với màu/kiểu dáng, liên hệ sở thích tông màu, không suy ra công năng. Với chất liệu, nêu lựa chọn chất liệu, không tự suy ra mát, bền hoặc an toàn.
Chỉ nói "không phải mua riêng" khi mô tả xác nhận món đó được kèm trong bộ bán; thấy món đó trong ảnh chưa đủ. Không tự hứa cắt sắc, chống gỉ, cầm chắc, dễ vệ sinh, chữa bệnh hay trải nghiệm đã dùng. Ảnh bối cảnh AI không phải bằng chứng công năng.
CTA: một lời mời tự nhiên để người xem quyết định. Nhắc nhóm thông tin cần xem (kích thước, thành phần bộ, kiểu kết nối, chất liệu, màu...), không đọc lại nguyên chi tiết đã nói. Có thể thêm "và giá hiện tại"; không tự nêu giá, giảm giá, khan hiếm hoặc khẳng định có nhiều phiên bản. Có thể mở bằng "Nếu thích..." rồi "nhấn sản phẩm"; vẫn phải có hành động mở sản phẩm/giỏ hàng. Nhãn CTA ngắn, đúng thông tin sẽ xem.
Tình huống gợi ý để biên tập, KHÔNG PHẢI nguồn tính năng mới; không bắt buộc dùng nguyên văn: ${JSON.stringify(situations)}
Mỗi cảnh một ý, thường 10–20 từ, tối đa 26 từ; hook tối đa 18 từ. Giữ tổng số từ phù hợp thời lượng. Ưu tiên lời đọc liền mạch, cụ thể và đáng tin hơn tính từ quảng cáo.`
}
