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
  const savedReturnTo = request.cookies.get('tiktok_oauth_return_to')?.value || '/create'

  if (error) {
    const redirectUrl = new URL(savedReturnTo, baseUrl)
    redirectUrl.searchParams.set('error', error)
    if (errorDescription) {
      redirectUrl.searchParams.set('error_description', errorDescription)
    }
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete('tiktok_oauth_return_to')
    return response
  }

  if (!code) {
    const redirectUrl = new URL(savedReturnTo, baseUrl)
    redirectUrl.searchParams.set('error', 'missing_code')
    redirectUrl.searchParams.set('error_description', 'No authorization code returned from TikTok')
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete('tiktok_oauth_return_to')
    return response
  }

  // Validate state to prevent CSRF
  const savedState = request.cookies.get('tiktok_oauth_state')?.value
  if (!state || !savedState || state !== savedState) {
    const redirectUrl = new URL(savedReturnTo, baseUrl)
    redirectUrl.searchParams.set('error', 'invalid_state')
    redirectUrl.searchParams.set('error_description', 'CSRF state verification failed')
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete('tiktok_oauth_return_to')
    return response
  }

  try {
    const tokenData = await exchangeCodeForTokens(code)

    const redirectUrl = new URL(savedReturnTo, baseUrl)
    redirectUrl.searchParams.set('auth', 'success')

    const response = NextResponse.redirect(redirectUrl)
    // Clear state & return cookies
    response.cookies.delete('tiktok_oauth_state')
    response.cookies.delete('tiktok_oauth_return_to')

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
    const redirectUrl = new URL(savedReturnTo, baseUrl)
    if (err instanceof TikTokApiError) {
      redirectUrl.searchParams.set('error', String(err.code))
      redirectUrl.searchParams.set('error_description', err.message)
      if (err.logId) redirectUrl.searchParams.set('log_id', err.logId)
    } else {
      redirectUrl.searchParams.set('error', 'token_exchange_failed')
      redirectUrl.searchParams.set('error_description', (err as Error)?.message || 'Unknown error')
    }
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete('tiktok_oauth_return_to')
    return response
  }
}
