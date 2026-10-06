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

  return NextResponse.json(status)
}

export async function DELETE() {
  try {
    await disconnectTikTok()
    return NextResponse.json({ success: true, message: 'Disconnected TikTok account successfully' })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
