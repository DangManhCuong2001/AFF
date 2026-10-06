import crypto from 'node:crypto'
import { TikTokTokenData, TikTokApiError } from './types'
import { oauthTokenResponseSchema } from './schemas'
import { tikTokTokenStore } from './token-store'

const TIKTOK_AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize/'
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

export function getTikTokConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim() || ''
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() || ''
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim() || ''

  return { clientKey, clientSecret, redirectUri }
}

export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString('hex')
}

export function getAuthorizationUrl(state: string): string {
  const { clientKey, redirectUri } = getTikTokConfig()

  if (!clientKey || !redirectUri) {
    throw new Error(
      'Missing TIKTOK_CLIENT_KEY or TIKTOK_REDIRECT_URI in environment variables.'
    )
  }

  const scopes = ['user.info.basic', 'video.publish', 'video.upload'].join(',')

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: scopes,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  })

  return `${TIKTOK_AUTH_BASE}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<TikTokTokenData> {
  const { clientKey, clientSecret, redirectUri } = getTikTokConfig()

  if (!clientKey || !clientSecret || !redirectUri) {
    throw new TikTokApiError({
      code: 'CONFIG_MISSING',
      message: 'TikTok credentials (CLIENT_KEY, CLIENT_SECRET, REDIRECT_URI) are not configured in environment.',
      httpStatus: 500,
    })
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  })

  const rawJson = await res.json().catch(() => ({}))

  if (!res.ok || rawJson.error) {
    const errorMsg = rawJson.error_description || rawJson.message || rawJson.error || 'Failed to exchange authorization code'
    throw new TikTokApiError({
      code: rawJson.error || 'OAUTH_EXCHANGE_FAILED',
      message: errorMsg,
      logId: rawJson.log_id,
      httpStatus: res.status,
    })
  }

  const parsed = oauthTokenResponseSchema.safeParse(rawJson)
  if (!parsed.success) {
    throw new TikTokApiError({
      code: 'INVALID_TOKEN_RESPONSE',
      message: `Invalid token payload received from TikTok: ${parsed.error.message}`,
      httpStatus: 502,
    })
  }

  const data = parsed.data
  const tokenData: TikTokTokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshExpiresAt: data.refresh_expires_in ? Date.now() + data.refresh_expires_in * 1000 : undefined,
    openId: data.open_id,
    scope: data.scope,
    tokenType: data.token_type,
  }

  await tikTokTokenStore.set(tokenData)
  return tokenData
}

export async function refreshAccessToken(currentRefreshToken: string): Promise<TikTokTokenData> {
  const { clientKey, clientSecret } = getTikTokConfig()

  if (!clientKey || !clientSecret) {
    throw new TikTokApiError({
      code: 'CONFIG_MISSING',
      message: 'TikTok credentials are missing for refreshing token.',
      httpStatus: 500,
    })
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: currentRefreshToken,
  })

  const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  })

  const rawJson = await res.json().catch(() => ({}))

  if (!res.ok || rawJson.error) {
    const errorMsg = rawJson.error_description || rawJson.message || rawJson.error || 'Failed to refresh token'
    throw new TikTokApiError({
      code: rawJson.error || 'TOKEN_REFRESH_FAILED',
      message: errorMsg,
      logId: rawJson.log_id,
      httpStatus: res.status,
    })
  }

  const parsed = oauthTokenResponseSchema.safeParse(rawJson)
  if (!parsed.success) {
    throw new TikTokApiError({
      code: 'INVALID_TOKEN_RESPONSE',
      message: `Invalid refresh token response: ${parsed.error.message}`,
      httpStatus: 502,
    })
  }

  const data = parsed.data
  const tokenData: TikTokTokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshExpiresAt: data.refresh_expires_in ? Date.now() + data.refresh_expires_in * 1000 : undefined,
    openId: data.open_id,
    scope: data.scope,
    tokenType: data.token_type,
  }

  await tikTokTokenStore.set(tokenData)
  return tokenData
}

export async function getValidAccessToken(): Promise<string> {
  const tokenData = await tikTokTokenStore.get()
  if (!tokenData || !tokenData.accessToken) {
    throw new TikTokApiError({
      code: 'NOT_CONNECTED',
      message: 'TikTok is not connected. Please connect your TikTok account first.',
      httpStatus: 401,
    })
  }

  // Check if expired or about to expire in the next 60 seconds
  const now = Date.now()
  if (now >= tokenData.expiresAt - 60000) {
    if (!tokenData.refreshToken) {
      throw new TikTokApiError({
        code: 'TOKEN_EXPIRED_NO_REFRESH',
        message: 'TikTok access token has expired and no refresh token is available. Please reconnect.',
        httpStatus: 401,
      })
    }
    const refreshed = await refreshAccessToken(tokenData.refreshToken)
    return refreshed.accessToken
  }

  return tokenData.accessToken
}

export async function disconnectTikTok(): Promise<void> {
  const tokenData = await tikTokTokenStore.get()
  if (tokenData?.accessToken) {
    const { clientKey, clientSecret } = getTikTokConfig()
    try {
      const body = new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        token: tokenData.accessToken,
      })
      await fetch(`${TIKTOK_API_BASE}/oauth/revoke/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
    } catch {
      // Best effort revoke
    }
  }
  await tikTokTokenStore.clear()
}
