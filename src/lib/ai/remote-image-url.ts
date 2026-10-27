/** Only the product CDNs used by the TikTok importer may be fetched by the server. */
export function isAllowedProductImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['ibyteimg.com', 'byteimg.com', 'tiktokcdn.com', 'ibytedtos.com'].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
  } catch {return false}
}
