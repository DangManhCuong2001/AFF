import { NextResponse } from 'next/server'
import { generateOAuthState, getAuthorizationUrl } from '@/lib/tiktok/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const state = generateOAuthState()
    const url = getAuthorizationUrl(state)

    const response = NextResponse.redirect(url)

    // Store state in httpOnly cookie to prevent CSRF attacks
    response.cookies.set('tiktok_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes
    })

    return response
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || 'Failed to initialize TikTok OAuth'
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}
