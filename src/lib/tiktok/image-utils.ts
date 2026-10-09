/**
 * Browser-safe and server-safe utility to upgrade TikTok CDN images to origin Ultra HD JPEG.
 * Safe to import in both Client Components and Server Components.
 */

export function upgradeTikTokImageUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl
  let url = rawUrl.trim().replace(/&amp;/g, '&')

  const isByteDanceCdn =
    url.includes('ibyteimg.com') ||
    url.includes('byteimg.com') ||
    url.includes('tiktokcdn.com') ||
    url.includes('tos-maliva') ||
    url.includes('tos-alisg') ||
    url.includes('tos-useast')

  if (isByteDanceCdn) {
    const defaultTpl = url.includes('tos-alisg') ? 'aphluv4xwc' : 'o3syd03w52'

    // 1. If URL contains template ~tplv-{tplId}-... replace with origin-jpeg preserving exact template ID
    const tplMatch = url.match(/~tplv-([a-zA-Z0-9]+)-/i)
    if (tplMatch && tplMatch[1]) {
      return url.replace(/~tplv-[^?#]+/i, `~tplv-${tplMatch[1]}-origin-jpeg.jpeg`)
    }
    if (url.includes('~tplv-')) {
      return url.replace(/~tplv-[^?#]+/i, `~tplv-${defaultTpl}-origin-jpeg.jpeg`)
    }
    // 2. If URL contains crop/resize tags like ~c5_ or ~resize- or ~crop-
    if (url.includes('~c5_') || url.includes('~resize-') || url.includes('~crop-')) {
      return url.replace(/~[^?#]+/i, `~tplv-${defaultTpl}-origin-jpeg.jpeg`)
    }
    // 3. If URL contains a 32-hex hash on tos-maliva
    const hashMatch = url.match(/\/tos-maliva[a-zA-Z0-9_\-]+\/([a-f0-9]{32})/i)
    if (hashMatch && hashMatch[1]) {
      return `https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/${hashMatch[1]}~tplv-o3syd03w52-origin-jpeg.jpeg`
    }
    // 4. If URL contains a 32-hex hash on tos-alisg
    const alisgHash = url.match(/\/tos-alisg[a-zA-Z0-9_\-]+\/([a-f0-9]{32})/i)
    if (alisgHash && alisgHash[1]) {
      return `https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/${alisgHash[1]}~tplv-aphluv4xwc-origin-jpeg.jpeg`
    }
  }

  return url
}
