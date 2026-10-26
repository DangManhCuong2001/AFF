import type {ContentAngle, ImageInsight, ProductFact} from './types'

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)
export const normalizeCopy = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
const trimWords = (text: string, limit: number) => words(text).slice(0, limit).join(' ')

const intents = [
  {id: 'compatibility', pattern: /usb|bluetooth|tuong thich|ket noi|cong sac|jack|type.c/, label: 'Kiểu kết nối / tương thích', shortLabel: 'kết nối', cta: 'Kiểm tra tương thích', clickReason: 'Đối chiếu thông tin tương thích trước khi đặt.', check: 'Kiểm tra thiết bị của bạn có phù hợp với kiểu kết nối này.'},
  {id: 'size', pattern: /kich thuoc|so do|chieu dai|day dai|dung tich|\bsize\b|\d\s*(?:cm|mm|met|ml|lit|inch)\b/, label: 'Kích thước cần xem', shortLabel: 'kích thước', cta: 'Kiểm tra kích thước', clickReason: 'Đối chiếu kích thước với nhu cầu của bạn.', check: 'Đối chiếu kích thước với nhu cầu trước khi chọn.'},
  {id: 'contents', pattern: /bo gom|gom \d|phu kien|so luong|kem theo|co .*(?:va|,) .*(?:gia|keo|hop)|\d\s*(?:mon|chiec|cai)\b/, label: 'Thành phần của bộ', shortLabel: 'thành phần bộ', cta: 'Xem thành phần bộ', clickReason: 'Kiểm tra đúng thành phần và số lượng của phiên bản định mua.', check: 'Kiểm tra đúng thành phần bộ và số lượng ở phiên bản bạn định mua.'},
  {id: 'color', pattern: /mau|tong mau|hoa tiet|kieu dang|thiet ke/, label: 'Màu sắc và thiết kế', shortLabel: 'màu và thiết kế', cta: 'Xem màu và phiên bản', clickReason: 'Đối chiếu màu và kiểu dáng với phiên bản bạn chọn.', check: 'Đối chiếu màu và kiểu dáng với ảnh của phiên bản bạn chọn.'},
  {id: 'material', pattern: /chat lieu|vai |cotton|linen|inox|thep|nhua|silicone|go /, label: 'Thông tin chất liệu', shortLabel: 'chất liệu', cta: 'Xem thông tin chất liệu', clickReason: 'Kiểm tra chất liệu và cách bảo quản trước khi chọn.', check: 'Đọc kỹ thông tin chất liệu và hướng dẫn bảo quản trước khi chọn.'},
]
const fallbackIntent = {id: 'design', label: 'Chi tiết đáng xem', shortLabel: 'chi tiết', cta: 'Xem chi tiết sản phẩm', clickReason: 'Đối chiếu ảnh, mô tả và lựa chọn trước khi đặt.', check: 'Quan sát chi tiết trong ảnh và đối chiếu với mô tả của shop.'}
export function intentForFact(fact?: ProductFact) {
  const text = fact?.text || ''
  return intents.find((intent) => intent.pattern.test(normalizeCopy(text)) && (intent.id !== 'color' || !/mẫu/i.test(text) || /màu|kiểu dáng|thiết kế|họa tiết/i.test(text))) || fallbackIntent
}

export function createCommerceCopy(name: string, angle: ContentAngle, facts: ProductFact[], preferredFocusId?: string) {
  // Prefer concise facts that can actually be explained in a short video.
  const candidates = facts.filter((fact) => words(fact.text).length <= 18)
  const ranked = candidates.map((fact, index) => {
    const intent = intentForFact(fact)
    const relevant = angle === 'design' ? ['color', 'material', 'design'] : angle === 'fit' ? ['compatibility', 'size', 'contents'] : ['compatibility', 'size', 'contents', 'material']
    return {fact, score: (relevant.includes(intent.id) ? 10 : 0) - index / 100}
  }).sort((a, b) => b.score - a.score)
  const focus = ranked.find(({fact}) => fact.id === preferredFocusId)?.fact || ranked[0]?.fact
  const intent = intentForFact(focus)
  const productName = trimWords(name, 6)
  const point = focus?.text || productName
  const hooks = [
    {id: angle, text: focus ? `Chọn ${productName}? Xem ${intent.shortLabel}.` : `${productName}: nhìn kỹ trước khi chọn.`, reasoning: 'Mở bằng sản phẩm và chi tiết sẽ được giải thích trong video.'},
    {id: `${angle}-detail`, text: focus ? `${trimWords(point, 10)} — có đúng điều bạn cần?` : `Bạn chọn ${productName} vì kiểu dáng nào?`, reasoning: 'Đưa đặc điểm có nguồn lên trước để người xem tự đối chiếu nhu cầu.'},
    {id: `${angle}-check`, text: focus ? `Trước khi chọn ${productName}, kiểm tra ${intent.shortLabel}.` : `Định chọn ${productName}? Xem kỹ ảnh này.`, reasoning: 'Mở bằng một việc cần kiểm tra trước khi chọn mua.'},
  ]
  const ctaHeadline = ({compatibility: 'Khớp thiết bị của bạn?', size: 'Đúng kích thước bạn cần?', contents: 'Đúng bộ bạn đang tìm?', color: 'Đúng màu bạn muốn?', material: 'Đúng chất liệu bạn cần?'} as Record<string, string>)[intent.id] || 'Xem kỹ trước khi chọn'
  return {focus, intent, hooks, ctaHeadline, headline: focus ? trimWords(point, 9) : productName,
    cta: `Nhấn sản phẩm trong giỏ hàng. ${intent.clickReason}`,
    orderedFacts: focus ? [focus, ...facts.filter((fact) => fact.id !== focus.id)] : facts}
}

const stopWords = new Set(['san', 'pham', 'trong', 'anh', 'thiet', 'ke', 'nhung', 'duoc', 'mot', 'cac', 'voi', 'cho', 'cua', 'nay', 'mau'])
export function visualMatch(fact: ProductFact, insight?: ImageInsight): number {
  if (!insight?.observation || insight.source !== 'vision') return 0
  if (fact.assetId === insight.assetId) return 100
  const tokens = normalizeCopy(fact.text).match(/[a-z0-9]+/g) || []
  const observation = new Set(normalizeCopy(insight.observation).match(/[a-z0-9]+/g) || [])
  return [...new Set(tokens)].filter((word) => word.length >= 3 && !stopWords.has(word) && observation.has(word)).length
}

export function factKeywords(text: string): string[] {
  return [...new Set(text.match(/\b(?:USB[- ]?C|Type[- ]?C|Bluetooth|[A-Z]{2,}(?:-\w+)?|\d+(?:[.,]\d+)?(?:\s?(?:cm|mm|ml|mét|lít|inch|GB|W))?)/g) || [])].slice(0, 4)
}
