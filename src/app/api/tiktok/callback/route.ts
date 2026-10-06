import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/tiktok/auth'
import { TikTokApiError } from '@/lib/tiktok/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = process.env.APP_URL || request.nextUrl.origin

  if (error) {
    const redirectUrl = new URL('/tiktok-test', baseUrl)
    redirectUrl.searchParams.set('error', error)
    if (errorDescription) {
      redirectUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(redirectUrl)
  }

  if (!code) {
    const redirectUrl = new URL('/tiktok-test', baseUrl)
    redirectUrl.searchParams.set('error', 'missing_code')
    redirectUrl.searchParams.set('error_description', 'No authorization code returned from TikTok')
    return NextResponse.redirect(redirectUrl)
  }

  // Validate state to prevent CSRF
  const savedState = request.cookies.get('tiktok_oauth_state')?.value
  if (!state || !savedState || state !== savedState) {
    const redirectUrl = new URL('/tiktok-test', baseUrl)
    redirectUrl.searchParams.set('error', 'invalid_state')
    redirectUrl.searchParams.set('error_description', 'CSRF state verification failed')
    return NextResponse.redirect(redirectUrl)
  }

  try {
    const tokenData = await exchangeCodeForTokens(code)

    const redirectUrl = new URL('/tiktok-test', baseUrl)
    redirectUrl.searchParams.set('auth', 'success')

    const response = NextResponse.redirect(redirectUrl)
    // Clear state cookie
    response.cookies.delete('tiktok_oauth_state')

    // Set persistent httpOnly session cookie for Serverless cross-lambda sharing
    response.cookies.set('tiktok_token_session', Buffer.from(JSON.stringify(tokenData)).toString('base64'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600,
    })

    return response
  } catch (err: unknown) {
    const redirectUrl = new URL('/tiktok-test', baseUrl)
    if (err instanceof TikTokApiError) {
      redirectUrl.searchParams.set('error', String(err.code))
      redirectUrl.searchParams.set('error_description', err.message)
      if (err.logId) redirectUrl.searchParams.set('log_id', err.logId)
    } else {
      redirectUrl.searchParams.set('error', 'token_exchange_failed')
      redirectUrl.searchParams.set('error_description', (err as Error)?.message || 'Unknown error')
    }
    return NextResponse.redirect(redirectUrl)
  }
}
