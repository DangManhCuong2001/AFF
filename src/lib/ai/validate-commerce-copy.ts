import type {ProductFact} from '@/engines/planning/types'
import {normalizeCopy} from '@/engines/planning/commerce-copy'

export interface CopyDraft {text: string; headline?: string; evidenceIds: string[]}
export type CopyPurpose = 'hook' | 'body' | 'cta' | 'question'
const forbidden = /(?:mình|tôi)\s+(?:đã|từng|dùng|thử|mua)|100\s*%|số\s*1|tốt nhất|chữa|trị bệnh|diệt khuẩn|kháng khuẩn|chống nước|chống cháy|freeship|miễn phí vận chuyển|voucher|giảm giá|bảo hành trọn đời|sắp hết|hết hàng|chỉ hôm nay|bán chạy|ai cũng|đang hot|rẻ nhất|giá chỉ|https?:|www\.|zalo|inbox/i
const stop = new Set(['san', 'pham', 'trong', 'anh', 'duoc', 'nhung', 'mot', 'cac', 'voi', 'cho', 'cua', 'nay', 'ban', 'khi', 'truoc', 'chon', 'xem', 'thong', 'tin'])
const tokens = (text: string) => new Set((normalizeCopy(text).match(/[a-z0-9]+/g) || []).filter((word) => word.length >= 3 && !stop.has(word)))
const numbers = (text: string) => normalizeCopy(text).match(/\d+(?:[.,]\d+)?/g)?.map((value) => value.replace(',', '.')) || []
const measures = (text: string) => (normalizeCopy(text).match(/\d+(?:[.,]\d+)?\s*(?:cm|mm|km|met|m\b|ml|lit|l\b|kg|mg|g\b|mah|hz|gb|tb|w\b|v\b|gio|phut|mon|chiec)/g) || []).map((value) => value.replace(',', '.').replace(/\s/g, '').replace(/met$/, 'm').replace(/lit$/, 'l'))
const attributes = ['inox', 'cotton', 'linen', 'silicone', 'nhựa', 'thép', 'gỗ', 'da thật', 'USB-C', 'Type-C', 'Bluetooth', 'iPhone', 'Android', 'Samsung', 'MacBook', 'iPad', 'không dây']
const claims = ['thoai mai', 'ben bi', 'do ben', 'cao cap', 'sac nhanh', 'chong on', 'cach am', 'mem mai', 'an toan', 'tiet kiem', 'khong gay kich ung', 'khong gay dau', 'tuong thich iphone', 'tuong thich android']

/** Mechanical guardrails, not a semantic proof. Uncertain wording falls back to sourced copy. */
export function validateCommerceCopy(draft: CopyDraft, facts: ProductFact[], productName: string, purpose: CopyPurpose, focusFactId?: string): boolean {
  const text = `${draft.text} ${draft.headline || ''}`.trim()
  const count = draft.text.trim().split(/\s+/).length
  if (!draft.text.trim() || count > (purpose === 'hook' ? 18 : 26) || forbidden.test(text) || /\d[\d.,]*\s*(?:k\b|đ|₫|vnd|%)/i.test(text)) return false
  if (draft.evidenceIds.some((id) => !facts.some((fact) => fact.id === id))) return false
  if (focusFactId && (purpose === 'hook' || purpose === 'cta') && !draft.evidenceIds.includes(focusFactId)) return false
  const evidence = facts.filter((fact) => draft.evidenceIds.includes(fact.id))
  if (purpose === 'body' && !evidence.length) return false
  const source = `${productName} ${evidence.map((fact) => fact.text).join(' ')}`
  const sourceNumbers = new Set(numbers(source))
  if (numbers(text).some((number) => !sourceNumbers.has(number))) return false
  const sourceMeasures = new Set(measures(source))
  if (measures(text).some((measure) => !sourceMeasures.has(measure))) return false
  const normalized = normalizeCopy(text)
  const sourceNormalized = normalizeCopy(source)
  if (attributes.some((attribute) => text.toLowerCase().includes(attribute.toLowerCase()) && !source.toLowerCase().includes(attribute.toLowerCase()))) return false
  if (claims.some((claim) => normalized.includes(claim) && !sourceNormalized.includes(claim))) return false
  // Preserve explicit negatives in factual evidence instead of reversing their meaning.
  if (evidence.some((fact) => /\bkhong\b|\bchua\b/.test(normalizeCopy(fact.text))) && !/\bkhong\b|\bchua\b/.test(normalizeCopy(draft.text))) return false
  const anchors = tokens(evidence.length ? evidence.map((fact) => fact.text).join(' ') : productName)
  const used = tokens(draft.text)
  if (anchors.size && ![...anchors].some((word) => used.has(word))) return false
  if (purpose === 'cta' && !/(nhấn|bấm|mở|xem|kiểm tra|đối chiếu|chọn)/i.test(draft.text)) return false
  if (purpose === 'question' && !draft.text.includes('?')) return false
  return true
}
