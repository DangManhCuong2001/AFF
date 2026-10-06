import { NextResponse } from 'next/server'
import { tikTokTokenStore } from '@/lib/tiktok/token-store'
import { disconnectTikTok } from '@/lib/tiktok/auth'
import { TikTokConnectionStatus } from '@/lib/tiktok/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tokenData = await tikTokTokenStore.get()

  if (!tokenData || !tokenData.accessToken) {
    const status: TikTokConnectionStatus = {
      connected: false,
      expired: false,
    }
    return NextResponse.json(status)
  }

  const now = Date.now()
  const isExpired = now >= tokenData.expiresAt
  const expiresInSeconds = Math.max(0, Math.floor((tokenData.expiresAt - now) / 1000))

  const status: TikTokConnectionStatus = {
    connected: true,
    expired: isExpired,
    openId: tokenData.openId,
    scope: tokenData.scope,
    expiresInSeconds,
  }

  const response = NextResponse.json(status)

  if (tokenData && tokenData.accessToken) {
    const base64 = Buffer.from(JSON.stringify(tokenData)).toString('base64')
    response.cookies.set('tiktok_token_session', base64, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600,
    })
  }

  return response
}

export async function DELETE() {
  try {
    await disconnectTikTok()
    const response = NextResponse.json({ success: true, message: 'Disconnected TikTok account successfully' })
    response.cookies.delete('tiktok_token_session')
    return response
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
