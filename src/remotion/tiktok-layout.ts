/** Conservative studio preset, not a guarantee for every TikTok device/caption. */
export const TIKTOK_FRAME = {width: 1080, height: 1920}
export const TIKTOK_SAFE = {left: 120, top: 240, right: 180, bottom: 660}
export const COMMERCE_LAYOUT = {
  left: TIKTOK_SAFE.left,
  width: TIKTOK_FRAME.width - TIKTOK_SAFE.left - TIKTOK_SAFE.right,
  label: {top: 248, height: 24},
  headline: {top: 294, height: 100},
  subheadline: {top: 408, height: 64},
  image: {top: 488, height: 536},
  annotation: {top: 1040, height: 52},
  cta: {top: 1104, height: 60},
  caption: {top: 1180, height: 64},
  progress: {top: 1254, height: 4},
}

/** Approximate Arial widths conservatively; all text remains present, never ellipsized. */
export function fitCommerceText(text: string, width: number, height: number, maxFontSize: number, lineHeight = 1.2): number {
  const units = (value: string) => Array.from(value.normalize('NFC')).reduce((total, char) => total + (/\s/.test(char) ? 0.32 : /[MW@%]/.test(char) ? 0.98 : /[ilI.,:!|'’]/.test(char) ? 0.32 : 0.68), 0)
  for (let font = maxFontSize; font >= 10; font--) {
    let lines = 1
    let used = 0
    const limit = width / font
    for (const word of text.trim().split(/\s+/)) {
      const length = units(word)
      if (used && used + 0.32 + length > limit) {lines++; used = 0}
      if (length > limit) {
        lines += Math.ceil(length / limit) - 1
        used = length % limit || limit
      } else {used += (used ? 0.32 : 0) + length}
    }
    if (lines * font * lineHeight <= height) return font
  }
  return 10
}
