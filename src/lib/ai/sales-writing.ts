import type {ProductFact} from '@/engines/planning/types'
import {sellingContextForFact} from '@/engines/planning/commerce-copy'

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
Thân đầu tiên nối chi tiết có nguồn với ý nghĩa chọn mua: tại sao một người có nhu cầu đó nên cân nhắc mẫu này. Đưa câu giải thích trước hoặc cùng căn cứ, không đọc lại hook. Cảnh tiếp theo thêm một chi tiết có nguồn khác; không thêm một câu hỏi kiểm tra cho mỗi thông số. Nối ý thành cuộc nói chuyện, tránh ba câu cùng một cấu trúc. Không lạm dụng "đáng cân nhắc nếu bạn ưu tiên" như một câu đệm; hãy diễn đạt sở thích hoặc nhu cầu cụ thể, chẳng hạn phối đồ cùng tông hoặc bố trí theo khoảng cách.
MẠCH LỜI ĐỌC: Đọc thử toàn bộ scenes.voice như một đoạn nói từ đầu đến cuối. Mỗi cảnh kết thúc trọn ý, không dừng ở dấu phẩy hoặc các từ "và", "nhưng", "vì", "để", "nếu", "với" rồi nối nửa câu sang cảnh khác. Dùng chuyển ý ngắn chỉ khi cần; không mở mỗi cảnh bằng một câu hỏi độc lập. Chủ thể vẫn là đúng sản phẩm, không chuyển sang một món khác hoặc thêm ý mới ở CTA.
ĐƯỢC: diễn đạt lại tự nhiên và đặt tình huống giả định liên quan trực tiếp đến nguồn. Với chiều dài dây đã có trong nguồn, liên hệ nhu cầu bố trí dây xa thiết bị và đọc đúng thông số; không cam kết dây chắc chắn vươn tới mọi vị trí. Với màu/kiểu dáng, liên hệ sở thích tông màu, không suy ra công năng. Với chất liệu, nêu lựa chọn chất liệu, không tự suy ra mát, bền hoặc an toàn.
Chỉ nói "không phải mua riêng" khi mô tả xác nhận món đó được kèm trong bộ bán; thấy món đó trong ảnh chưa đủ. Không tự hứa cắt sắc, chống gỉ, cầm chắc, dễ vệ sinh, chữa bệnh hay trải nghiệm đã dùng. Ảnh bối cảnh AI không phải bằng chứng công năng.
CTA: một lời mời tự nhiên để người xem quyết định. Nhắc nhóm thông tin cần xem (kích thước, thành phần bộ, kiểu kết nối, chất liệu, màu...), không đọc lại nguyên chi tiết đã nói. Có thể thêm "và giá hiện tại"; không tự nêu giá, giảm giá, khan hiếm hoặc khẳng định có nhiều phiên bản. Có thể mở bằng "Nếu thích..." rồi "nhấn sản phẩm"; vẫn phải có hành động mở sản phẩm/giỏ hàng. Nhãn CTA ngắn, đúng thông tin sẽ xem.
Tình huống gợi ý để biên tập, KHÔNG PHẢI nguồn tính năng mới; không bắt buộc dùng nguyên văn: ${JSON.stringify(situations)}
Mỗi cảnh một ý, thường 10–20 từ, tối đa 26 từ; hook tối đa 18 từ. Giữ tổng số từ phù hợp thời lượng. Ưu tiên lời đọc liền mạch, cụ thể và đáng tin hơn tính từ quảng cáo.`
}
