/** Shared pronunciation rules for TTS and estimated visual pacing. Browser-safe. */
export function normalizeVietnameseNumbers(text: string): string {
  if (!text) return ''
  // Vietnamese thousands separators must not become decimal pronunciation.
  let result = text.replace(/\b\d{1,3}(?:\.\d{3})+(?!\d)/g, (number) => number.replace(/\./g, ''))
  // Expand measurements before number conversion. Keep the 3M brand case-sensitive.
  const measurementUnits: Record<string, string> = {mm: 'mi li mét', cm: 'xen ti mét', m: 'mét', ml: 'mi li lít', l: 'lít', kg: 'ki lô gam', g: 'gam', W: 'oát', GB: 'ghi ga bai'}
  result = result.replace(/(\d+(?:[.,]\d+)?)\s*(mm|cm|ml|kg|GB|m|l|g|W)(?![\p{L}\d])/gu, (_match, number: string, unit: string) => `${number} ${measurementUnits[unit]}`)
  result = result.replace(/(\d+)[.,](\d+)/g, (_match, whole: string, fraction: string) => `${whole} phẩy ${fraction.split('').join(' ')}`)
  // 1. Percentages: 100% -> 100 phần trăm
  result = result.replace(/(\d+)\s*%/g, '$1 phần trăm')
  // 2. Fractions: 10/10 -> 10 trên 10
  result = result.replace(/(\d+)\/(\d+)/g, '$1 trên $2')
  // 3. Currency / prices: 99k, 199k, 50k
  result = result.replace(/(\d+)\s*[kK](?![\p{L}\p{N}])/gu, '$1 nghìn')

  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const teens: Record<number, string> = {
    10: 'mười', 11: 'mười một', 12: 'mười hai', 13: 'mười ba', 14: 'mười bốn',
    15: 'mười lăm', 16: 'mười sáu', 17: 'mười bảy', 18: 'mười tám', 19: 'mười chín',
  }
  const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi']

  function numToWord(n: number): string {
    if (n === 0) return 'không'
    if (n >= 1 && n <= 9) return units[n]
    if (n >= 10 && n <= 19) return teens[n]
    if (n >= 20 && n <= 99) {
      const d = Math.floor(n / 10)
      const u = n % 10
      if (u === 0) return tens[d]
      if (u === 1) return tens[d] + ' mốt'
      if (u === 5) return tens[d] + ' lăm'
      return tens[d] + ' ' + units[u]
    }
    if (n >= 100 && n < 1000) {
      const remainder = n % 100
      return units[Math.floor(n / 100)] + ' trăm' + (remainder ? ' ' + (remainder < 10 ? 'linh ' : '') + numToWord(remainder) : '')
    }
    return String(n)
  }

  return result.replace(/\b([0-9]{1,3})\b/g, (_m, n) => numToWord(parseInt(n, 10)))
}

