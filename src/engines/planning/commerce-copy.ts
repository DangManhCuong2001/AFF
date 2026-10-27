import type {ContentAngle, ImageInsight, ProductFact} from './types'

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)
export const normalizeCopy = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
const trimWords = (text: string, limit: number) => words(text).slice(0, limit).join(' ')

const intents = [
  {id: 'compatibility', pattern: /usb|bluetooth|tuong thich|ket noi|cong sac|jack|type.c/, label: 'Kiểu kết nối / tương thích', shortLabel: 'kết nối', cta: 'Kiểm tra tương thích', clickReason: 'Đối chiếu thông tin tương thích trước khi đặt.', check: 'Kiểm tra thiết bị của bạn có phù hợp với kiểu kết nối này.'},
  {id: 'size', pattern: /kich thuoc|so do|chieu dai|day dai|dung tich|\bsize\b|\d\s*(?:cm|mm|met|ml|lit|inch)\b/, label: 'Kích thước cần xem', shortLabel: 'kích thước', cta: 'Kiểm tra kích thước', clickReason: 'Đối chiếu kích thước với nhu cầu của bạn.', check: 'Đối chiếu kích thước với nhu cầu trước khi chọn.'},
  {id: 'contents', pattern: /bo gom|gom \d|phu kien|so luong|kem theo|co .*(?:va|,) .*(?:gia|keo|hop)|\d\s*(?:mon|chiec|cai)\b/, label: 'Thành phần của bộ', shortLabel: 'thành phần bộ', cta: 'Xem thành phần bộ', clickReason: 'Kiểm tra đúng thành phần và số lượng của phiên bản định mua.', check: 'Kiểm tra đúng thành phần bộ và số lượng ở phiên bản bạn định mua.'},
  {id: 'color', pattern: /mau|tong mau|hoa tiet|kieu dang|thiet ke/, label: 'Màu sắc và thiết kế', shortLabel: 'màu và thiết kế', cta: 'Xem màu và phiên bản', clickReason: 'Đối chiếu màu và kiểu dáng với phiên bản bạn chọn.', check: 'Đối chiếu màu và kiểu dáng với ảnh của phiên bản bạn chọn.'},
  {id: 'fit', pattern: /\bform\b|dang om|dang rong|regular fit|oversize/, label: 'Form trang phục', shortLabel: 'form dáng', cta: 'Đối chiếu form và số đo', clickReason: 'Đối chiếu form và số đo với nhu cầu của bạn.', check: 'Đối chiếu form và số đo trước khi chọn.'},
  {id: 'care', pattern: /bao quan|giat|ve sinh|lam sach/, label: 'Cách bảo quản', shortLabel: 'cách bảo quản', cta: 'Xem cách bảo quản', clickReason: 'Đọc hướng dẫn bảo quản của đúng sản phẩm.', check: 'Đọc hướng dẫn bảo quản của sản phẩm.'},
  {id: 'ingredients', pattern: /thanh phan|ingredient|niacinamide|hyaluronic|retinol/, label: 'Thành phần theo mô tả', shortLabel: 'thành phần', cta: 'Xem thông tin thành phần', clickReason: 'Đọc thành phần và lưu ý sử dụng trước khi chọn.', check: 'Đọc thành phần và lưu ý sử dụng theo mô tả.'},
  {id: 'skin', pattern: /da dau|da kho|da nhay cam|loai da|doi tuong su dung/, label: 'Đối tượng sử dụng', shortLabel: 'đối tượng sử dụng', cta: 'Xem đối tượng sử dụng', clickReason: 'Đối chiếu đối tượng sử dụng và lưu ý trên sản phẩm.', check: 'Đối chiếu đối tượng sử dụng theo mô tả.'},
  {id: 'scent', pattern: /mui huong|huong dau|huong giua|huong cuoi|huong hoa|huong go|huong cam/, label: 'Mô tả mùi hương', shortLabel: 'mùi hương', cta: 'Xem mô tả mùi hương', clickReason: 'Đọc mô tả mùi hương trước khi chọn.', check: 'Đối chiếu mô tả mùi hương với sở thích của bạn.'},
  {id: 'concentration', pattern: /nong do|\bedp\b|\bedt\b|eau de/, label: 'Nồng độ nước hoa', shortLabel: 'nồng độ', cta: 'Xem thông tin nồng độ', clickReason: 'Kiểm tra nồng độ của đúng sản phẩm định mua.', check: 'Kiểm tra thông tin nồng độ trên sản phẩm.'},
  {id: 'power', pattern: /cong suat|dien ap|nguon dien|\d\s*(?:w|v|mah)\b/, label: 'Thông số nguồn điện', shortLabel: 'thông số nguồn điện', cta: 'Kiểm tra thông số nguồn điện', clickReason: 'Đối chiếu thông số nguồn điện trước khi chọn.', check: 'Đối chiếu thông số nguồn điện theo mô tả.'},
  {id: 'usage', pattern: /cach dung|cach su dung|huong dan|su dung cho|dung de/, label: 'Hướng dẫn sử dụng', shortLabel: 'cách sử dụng', cta: 'Xem hướng dẫn sử dụng', clickReason: 'Đọc hướng dẫn và lưu ý sử dụng của sản phẩm.', check: 'Đọc hướng dẫn sử dụng theo mô tả.'},
  {id: 'material', pattern: /chat lieu|vai |cotton|linen|inox|thep|nhua|silicone|go /, label: 'Thông tin chất liệu', shortLabel: 'chất liệu', cta: 'Xem thông tin chất liệu', clickReason: 'Kiểm tra chất liệu và cách bảo quản trước khi chọn.', check: 'Đọc kỹ thông tin chất liệu và hướng dẫn bảo quản trước khi chọn.'},
]
const fallbackIntent = {id: 'design', label: 'Chi tiết đáng xem', shortLabel: 'chi tiết', cta: 'Xem chi tiết sản phẩm', clickReason: 'Đối chiếu ảnh, mô tả và lựa chọn trước khi đặt.', check: 'Quan sát chi tiết trong ảnh và đối chiếu với mô tả của shop.'}
export function intentForFact(fact?: ProductFact) {
  const text = fact?.text || ''
  return intents.find((intent) => intent.pattern.test(normalizeCopy(text)) && (intent.id !== 'color' || !/mẫu/i.test(text) || /màu|kiểu dáng|thiết kế|họa tiết/i.test(text))) || fallbackIntent
}

export function createCommerceCopy(name: string, angle: ContentAngle, facts: ProductFact[], preferredFocusId?: string, priorities: string[] = []) {
  // Prefer concise facts that can actually be explained in a short video.
  const candidates = facts.filter((fact) => words(fact.text).length <= 18)
  const ranked = candidates.map((fact, index) => {
    const intent = intentForFact(fact)
    const relevant = angle === 'design' ? ['color', 'material', 'design'] : angle === 'fit' ? ['compatibility', 'size', 'contents'] : ['compatibility', 'size', 'contents', 'material']
    return {fact, score: (relevant.includes(intent.id) ? angle === 'features' ? 3 : 10 : 0) + (angle !== 'design' && priorities.includes(intent.id) ? 30 - priorities.indexOf(intent.id) * 4 : 0) - index / 100}
  }).sort((a, b) => b.score - a.score)
  const focus = ranked.find(({fact}) => fact.id === preferredFocusId)?.fact || ranked[0]?.fact
  const intent = intentForFact(focus)
  const productName = trimWords(name, 6)
  const point = focus?.text || productName
  const detail = point.replace(/[.!?]$/, '').replace(/^Có\s+/i, '').replace(/^[A-ZĐ](?=[a-zà-ỹ])/u, (letter) => letter.toLocaleLowerCase('vi'))
  const withinHook = (text: string, fallback: string) => words(text).length <= 18 ? text : fallback
  const hooks = [
    {id: angle, text: focus ? withinHook(`Cần ${detail}?`, `${point.replace(/[.!?]$/, '')}?`) : `${productName}: nhìn rõ mẫu trong ảnh.`, reasoning: 'Mở bằng một nhu cầu gắn trực tiếp với chi tiết có nguồn.'},
    {id: `${angle}-detail`, text: focus ? withinHook(`${productName}: ${detail}.`, `${point.replace(/[.!?]$/, '')}.`) : `Bạn chọn ${productName} vì kiểu dáng nào?`, reasoning: 'Đưa sản phẩm và đặc điểm cụ thể lên ngay câu đầu.'},
    {id: `${angle}-check`, text: focus ? withinHook(`${detail} — có đúng điều bạn cần?`, `Trước khi chọn ${productName}, xem ${intent.shortLabel}.`) : `Định chọn ${productName}? Xem kỹ ảnh này.`, reasoning: 'Giúp người xem đối chiếu một đặc điểm cụ thể với nhu cầu.'},
  ]
  const ctaHeadline = ({compatibility: 'Khớp thiết bị của bạn?', size: 'Đúng kích thước bạn cần?', contents: 'Đúng bộ bạn đang tìm?', color: 'Đúng màu bạn muốn?', material: 'Đúng chất liệu bạn cần?'} as Record<string, string>)[intent.id] || 'Xem kỹ trước khi chọn'
  const buyerQuestion = ({compatibility: 'Kiểu kết nối này có khớp thiết bị của bạn?', size: 'Kích thước này có phù hợp nhu cầu của bạn?', contents: 'Bộ này có đúng những món bạn cần?', color: 'Màu và kiểu dáng có đúng lựa chọn của bạn?', material: 'Chất liệu này có phù hợp nhu cầu của bạn?'} as Record<string, string>)[intent.id] || `Bạn đã đọc kỹ ${intent.shortLabel} của sản phẩm chưa?`
  return {focus, intent, hooks, ctaHeadline, buyerQuestion, headline: focus ? trimWords(point, 9) : productName,
    cta: focus ? `Nhấn sản phẩm để xem: ${detail}.` : `Nhấn sản phẩm để xem ảnh và mô tả của ${productName}.`,
    orderedFacts: focus ? [focus, ...ranked.map(({fact}) => fact).filter((fact) => fact.id !== focus.id)] : ranked.map(({fact}) => fact)}
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
