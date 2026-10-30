import type {ProductInput} from '../core/types'
import type {ProductFact} from './types'
import {equivalentCopy} from './copy-novelty'

const normalized = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
const merchantCopy = /cham soc khach hang|dich vu khach hang|ho tro khach hang|\bcskh\b|bao hanh|doi tra|hoan tra|hoan tien|chinh sach|giao hang|van chuyen|freeship|free ship|ship cod|voucher|ma giam gia|khuyen mai|uu dai|dam bao chat luong|cam ket|chinh hang|uy tin|chat luong (?:cao|tot|hang dau)|cam on|ung ho shop|danh gia\s*(?:5|nam)\s*sao|inbox|nhan tin|lien he|hotline|zalo|tu van|kiem hang|quay video.*(?:mo|boc) hop|tiktok shop|customer (?:service|care|support)|warranty|return policy|refund|free shipping|quality (?:assurance|guarantee)|money.back/i
const sectionLabel = /^(?:cac\s+)?(?:thong tin|mo ta|gioi thieu|dac diem|tinh nang|uu diem|thong so(?: ky thuat)?|chi tiet|hinh anh|quy cach|dac tinh|huong dan(?: su dung| bao quan)?)(?:\s+(?:san pham|noi bat|co ban|chi tiet))*$/
const emptyAttribute = /^(?:chat lieu|kich thuoc|mau sac|cong suat|dung tich|thanh phan|so luong|cach su dung|cach bao quan)$/
// Generic promises do not describe a verifiable attribute or justify a hook.
const genericSalesClaim = /phu hop (?:voi )?moi (?:khong gian|gia dinh|doi tuong)|hoan hao cho|tiet kiem [^.!?]{0,35}thoi gian|tang tinh tham my|de dang truy cap|giu .*luon sach se|co the dat o nhieu vi tri|giup .*gon gang|sap xep .*co to chuc/
const intrinsic = /chat lieu|kich thuoc|mau sac|tong mau|thiet ke|kieu dang|hoa tiet|cong suat|dien ap|ket noi|usb|bluetooth|type.c|jack|dung tich|khoi luong|trong luong|thanh phan|bo gom|gom \d|huong dan|cach dung|cach su dung|bao quan|ve sinh|lam sach|dung de|giu .*day|silicon|cotton|linen|inox|thep|nhua|vai |form |mui huong|nong do|\d+(?:[.,]\d+)?\s*(?:cm|mm|m\b|met|ml|lit|kg|g\b|w\b|mah|mon|chiec|cai|ranh|tang|ngan)\b/

export const isMerchantCopy = (text: string) => merchantCopy.test(normalized(text))
// JavaScript \b treats Vietnamese accented letters as non-word characters:
// "1 kéo" is not "1k", and "1 đế" is not a price in đồng.
export const hasPriceOrDiscount = (text: string) => /(?:₫|vnd|vnđ)\s*\d[\d.,]*|\d[\d.,]*\s*(?:k(?:đ|₫|vnd)?(?![\p{L}\p{N}])|đ(?:ồng)?(?![\p{L}\p{N}])|₫|vnd(?![\p{L}\p{N}])|vnđ(?![\p{L}\p{N}])|%)/iu.test(text)
export function isProductDetail(text: string): boolean {
  const value = text.trim()
  const plain = normalized(value).replace(/[:\s]+$/, '')
  return value.length > 2 && /[\p{L}]/u.test(value) && !isMerchantCopy(value) && !genericSalesClaim.test(plain) && !sectionLabel.test(plain) && !emptyAttribute.test(plain) && !value.endsWith(':') && !hasPriceOrDiscount(value)
}

function clean(text: string) {
  return text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]/gu, ' ')
    .replace(/(^|\n)\s*\d{1,2}[.)]\s+/g, '$1')
}

/** Keep product information even when it follows a long merchant-policy block. */
export function extractProductFacts(product: ProductInput) {
  let excludedCount = 0
  const parse = (raw: string) => {
    let inMerchantSection = false
    const accepted: string[] = []
    const clauses = clean(raw).split(/\n|;|[.!?](?=\s|$)|,(?=\s*(?:bảo hành|đổi trả|hoàn trả|chăm sóc|chính sách|màu sắc|chất liệu|kích thước|công suất))/i)
    for (const clause of clauses) {
      let text = clause.replace(/^[\s\-–—•●▪*#>✓✔]+/u, '').replace(/\s+/g, ' ').trim()
      if (!text) continue
      if (sectionLabel.test(normalized(text))) {inMerchantSection = false; excludedCount++; continue}
      const colon = text.indexOf(':')
      if (colon >= 0) {
        const label = text.slice(0, colon).trim(), tail = text.slice(colon + 1).trim()
        if (isMerchantCopy(label)) {
          inMerchantSection = true
          if (!tail || !intrinsic.test(normalized(tail))) {excludedCount++; continue}
          text = tail
        } else if (sectionLabel.test(normalized(label))) {
          inMerchantSection = false
          text = tail
        }
      }
      if (!text || !isProductDetail(text) || (inMerchantSection && !intrinsic.test(normalized(text)))) {excludedCount++; continue}
      accepted.push(text)
    }
    return accepted
  }
  const features = (product.features || []).flatMap(parse)
  const benefits = (product.benefits || []).flatMap(parse)
  const description = parse(product.description || '').filter(text => normalized(text) !== normalized(product.name))
  const howToUse = parse(product.howToUse || '')
  const all = [...features, ...benefits, ...description, ...howToUse]
  const unique = all.filter((text, index) => !all.slice(0, index).some((previous) => equivalentCopy(previous, text)))
  // Select specific details before the eight-fact cap, retaining original source order/IDs.
  const selected = unique.map((text, index) => ({text, index, score: intrinsic.test(normalized(text)) ? 2 : 1}))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 8).sort((a, b) => a.index - b.index)
  const facts: ProductFact[] = selected.map(({text}, index) => ({id: `fact-${index + 1}`, text, source: 'user_input'}))
  return {facts, excludedCount, cleaned: {features, benefits, description: description.join('\n'), howToUse: howToUse.join('\n')}}
}
