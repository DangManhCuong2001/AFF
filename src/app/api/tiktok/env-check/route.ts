import { NextResponse } from 'next/server'
import { getTikTokConfig } from '@/lib/tiktok/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { clientKey, clientSecret, redirectUri } = getTikTokConfig()

  return NextResponse.json({
    hasClientKey: Boolean(clientKey),
    clientKeyPrefix: clientKey ? clientKey.slice(0, 4) + '...' : null,
    hasClientSecret: Boolean(clientSecret),
    redirectUri,
    appUrl: process.env.APP_URL || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  })
}
