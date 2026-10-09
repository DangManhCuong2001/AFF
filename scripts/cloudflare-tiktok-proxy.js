/**
 * Cloudflare Worker: TikTok Shop Vietnam Reverse Proxy (Free Tier: 100,000 req/day)
 * 
 * Hướng dẫn cài đặt trong 1 phút:
 * 1. Đăng nhập https://dash.cloudflare.com/ -> Chọn "Workers & Pages" -> "Create application" -> "Create Worker".
 * 2. Đặt tên (vd: my-tiktok-proxy) -> Bấm "Deploy".
 * 3. Bấm "Edit code" -> Dán toàn bộ nội dung file này vào -> Bấm "Deploy".
 * 4. Copy đường dẫn Worker (vd: https://my-tiktok-proxy.workers.dev).
 * 5. Trên Vercel: Vào Settings -> Environment Variables -> Thêm:
 *    TIKTOK_SCRAPE_PROXY_URL = https://my-tiktok-proxy.workers.dev
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    }

    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing target url parameter (?url=https://...)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        redirect: 'follow',
      })

      const html = await response.text()

      return new Response(html, {
        status: response.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Proxy fetch failed', message: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }
  },
}
