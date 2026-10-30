import {z} from 'zod'
import type {ImageInteraction} from '@/engines/planning/types'

const choices = {
  action: ['pick-place', 'lift', 'place', 'touch', 'point'],
  contact: ['handle', 'rim', 'body', 'surface'],
  mobility: ['handheld', 'fixed', 'unknown'],
  arrangement: ['separate', 'stacked', 'occluded', 'unknown'],
  confidence: ['high', 'low'],
  prop: ['none', 'phone', 'book', 'small-item', 'loop-item', 'sponge', 'bottle', 'cloth', 'cup'],
  restingPose: ['upright', 'flat', 'leaning', 'unknown'],
  supportState: ['empty', 'occupied', 'unclear'],
  access: ['clear', 'blocked', 'unclear'],
  supportUse: ['storage', 'drainage', 'unclear'],
} as const
const schema = z.object({
  action: z.enum(choices.action), targetDetail: z.number().int().min(1).max(3),
  contact: z.enum(choices.contact), mobility: z.enum(choices.mobility),
  arrangement: z.enum(choices.arrangement), confidence: z.enum(choices.confidence), prop: z.enum(choices.prop),
  restingPose: z.enum(choices.restingPose).optional(),
  supportState: z.enum(choices.supportState).optional(), access: z.enum(choices.access).optional(),
  supportUse: z.enum(choices.supportUse).optional(),
}).strict()

export const imageInteractionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    ...Object.fromEntries(Object.entries(choices).map(([key, values]) => [key, {type: 'string', enum: values}])),
    targetDetail: {type: 'integer', minimum: 1, maximum: 3},
  },
  required: [...Object.keys(choices), 'targetDetail'],
}

// Shared by both vision entry points. No product-name dictionary, free-form
// motion instructions, extra Gemini request or automatic video generation.
export const imageInteractionBrief = `DÀN CẢNH TƯƠNG TÁC: Với mỗi ảnh, thêm interaction để chọn MỘT thao tác có điểm bắt đầu, thực hiện và kết thúc rõ, giúp hiểu cách cầm/đặt hoặc cấu trúc sản phẩm; không chỉ vẫy tay trang trí. Dựa trên cấu trúc thực sự nhìn thấy, không tra thao tác theo tên nhóm hàng. targetDetail là vị trí 1..3 trong details của ĐÚNG ảnh này, mô tả rõ món/bộ phận sẽ tương tác cùng vị trí của nó trong 4–12 từ. details chỉ mô tả ảnh hiện tại; không thêm câu về thao tác tương lai, khả năng cầm bằng một tay hoặc chất liệu suy đoán vào text. Nếu bộ nhiều món, chọn đúng một món rời nhìn trọn vẹn; trạng thái arrangement/mobility mô tả món đó, không phải cả bộ. Không biến đề xuất này thành fact hoặc lời quảng cáo.
Chọn action: pick-place (cầm một món nhỏ rời nhìn rõ, chuyển tới vị trí chuẩn bị ở phía trước và đặt nhẹ lên mặt bàn trung tính), lift (nhấc nhẹ và đưa điểm cầm ra trước để giới thiệu khi đặt xuống đòi hỏi lộ mặt khuất), place (đặt một đạo cụ nhẹ lên mặt đỡ/điểm treo lộ thiên đã nhìn rõ), touch (chạm nhẹ phần ngoài), point (chỉ chi tiết). Ưu tiên pick-place hoặc place khi ảnh đủ căn cứ cho một tình huống chuẩn bị/sắp xếp rõ ràng. contact là điểm tiếp xúc thấy được: handle/cán hoặc quai, rim/viền, body/thân, surface/bề mặt. mobility=handheld chỉ khi có căn cứ món đủ nhỏ để một tay cầm; đồ lớn/gắn cố định=fixed; không rõ=unknown. arrangement=separate chỉ khi món rời và điểm tiếp xúc rõ; xếp chồng=stacked; bị che/đang cắm/lồng vào món khác=occluded; không rõ=unknown. confidence=high chỉ khi các điều này rõ trên ảnh, còn lại low.
restingPose là tư thế của đúng món sẽ cầm: upright (đứng thẳng), flat (nằm phẳng), leaning (tựa nghiêng), unknown (chưa rõ). Với món tựa nghiêng hoặc chưa rõ tư thế, chọn lift và giữ nguyên hướng; không ép đặt nằm xuống vì phải dựng mặt khuất. pick-place/lift không dành cho món xếp chồng, gắn/cắm/lồng, bị che, đồ lớn, ảnh cận chỉ một phần hoặc bao bì. pick-place chỉ đổi vị trí nhẹ, giữ hướng nhìn gốc; nếu phải lật/nghiêng làm lộ mặt khuất để đặt xuống, dùng lift. Không suy đoán thao tác cắt, đổ, mở nắp, kích hoạt điện, kéo giãn, phun/thoa, công dụng hoặc kết quả. place chỉ khi thấy mặt đỡ, điểm treo lộ thiên hoặc đáy khoang trống phù hợp, toàn bộ kết cấu đỡ và đường hạ đạo cụ không vướng; không bịa mặt kệ/khe/cổng. Với một điểm treo/chốt/móc lộ thiên đang trống, targetDetail phải mô tả và khoanh đúng phần cong/chốt chịu tiếp xúc, mobility=fixed, action=place, contact=surface, supportState=empty, access=clear, supportUse=storage và prop=loop-item; không target tấm nền/miếng dán phía sau. Nếu đang có vật treo thì supportState=occupied và không chọn place. prop chỉ là đạo cụ trung tính: phone, book, sponge, bottle, cloth, cup, small-item hoặc loop-item (một vòng nhỏ để hạ lên điểm treo); chọn đạo cụ phù hợp với mặt đỡ/điểm treo/khoang thực sự nhìn thấy, không xem là món bán kèm. Mọi action khác prop=none. Với ảnh chỉ bao bì hoặc không đủ căn cứ, dùng point, confidence=low và prop=none. Với place, supportState=empty/occupied/unclear xác nhận mặt đỡ/điểm treo/khoang thực sự trống; access=clear/blocked/unclear cho đường hạ đạo cụ. Đáy dạng nan cũng là mặt đỡ nếu thấy rõ có thể đặt một đạo cụ nhỏ lên; không cần là tấm kín. supportUse=storage chỉ mặt đỡ/khoang/điểm treo dùng để giữ vật; khay hứng nước bên dưới khoang là drainage, không chọn làm nơi đặt đồ. Đây là trạng thái mặt đỡ, không phải việc bộ phận có gắn vào sản phẩm hay không. Các action khác có thể dùng unclear. Không cần có đủ mọi loại action giữa các sản phẩm.`

export function readImageInteraction(raw: unknown, details: {text: string}[]): ImageInteraction | undefined {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return undefined
  const target = details[parsed.data.targetDetail - 1]?.text
  if (typeof target !== 'string' || target.trim().length < 3 || target.length > 120) return undefined
  return parsed.data
}
