import { getValidAccessToken } from './auth'
import { TikTokApiError, DebugLogEntry } from './types'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

// In-memory debug log buffer for inspection in development mode UI
const recentDebugLogs: DebugLogEntry[] = []

export function recordDebugLog(entry: DebugLogEntry) {
  recentDebugLogs.unshift(entry)
  if (recentDebugLogs.length > 50) {
    recentDebugLogs.pop()
  }
}

export function getRecentDebugLogs(): DebugLogEntry[] {
  return [...recentDebugLogs]
}

export function clearDebugLogs(): void {
  recentDebugLogs.length = 0
}

interface TikTokRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  requireAuth?: boolean
}

export async function tiktokFetch<T = unknown>(
  endpoint: string,
  options: TikTokRequestOptions = {}
): Promise<{ data: T; logId?: string; raw: unknown }> {
  const { method = 'POST', headers = {}, body, requireAuth = true } = options
  const url = endpoint.startsWith('http') ? endpoint : `${TIKTOK_API_BASE}${endpoint}`

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json; charset=UTF-8',
    ...headers,
  }

  if (requireAuth) {
    const accessToken = await getValidAccessToken()
    requestHeaders['Authorization'] = `Bearer ${accessToken}`
  }

  let requestBodyString: string | undefined
  if (body !== undefined) {
    requestBodyString = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const logEntry: DebugLogEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    method,
    requestSummary: body ? (typeof body === 'object' ? { ...(body as object) } : { body: String(body) }) : undefined,
  }

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBodyString,
    })
  } catch (netErr: unknown) {
    logEntry.errorCode = 'NETWORK_ERROR'
    logEntry.responseSummary = { message: (netErr as Error)?.message || 'Network fetch failed' }
    recordDebugLog(logEntry)
    throw new TikTokApiError({
      code: 'NETWORK_ERROR',
      message: `Failed to connect to TikTok API endpoint (${endpoint}): ${(netErr as Error)?.message}`,
      httpStatus: 0,
    })
  }

  logEntry.status = res.status

  const rawJson = (await res.json().catch(() => ({}))) as Record<string, unknown>
  logEntry.responseSummary = sanitizeLogPayload(rawJson)

  // TikTok API returns error object in the JSON body: { error: { code: '...', message: '...', log_id: '...' } }
  const rawError = rawJson.error as { code?: string | number; message?: string; log_id?: string; sub_code?: string } | undefined
  if (rawError && rawError.code && String(rawError.code).toLowerCase() !== 'ok' && String(rawError.code) !== '0') {
    logEntry.errorCode = rawError.code
    logEntry.logId = rawError.log_id
    recordDebugLog(logEntry)

    throw new TikTokApiError({
      code: rawError.code,
      message: rawError.message || `TikTok API error (${rawError.code})`,
      logId: rawError.log_id,
      subCode: rawError.sub_code,
      httpStatus: res.status,
    })
  }

  if (!res.ok) {
    logEntry.errorCode = `HTTP_${res.status}`
    recordDebugLog(logEntry)
    throw new TikTokApiError({
      code: `HTTP_${res.status}`,
      message: (rawJson.message as string) || `TikTok API responded with HTTP status ${res.status}`,
      httpStatus: res.status,
    })
  }

  recordDebugLog(logEntry)
  return {
    data: (rawJson.data ?? rawJson) as T,
    logId: rawError?.log_id,
    raw: rawJson,
  }
}

/**
 * Remove any sensitive values like access tokens before recording in debug logs.
 */
function sanitizeLogPayload(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') {
    return { value: obj }
  }
  const copy = { ...(obj as Record<string, unknown>) }
  const sensitiveKeys = ['access_token', 'refresh_token', 'client_secret', 'app_secret', 'secret']
  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      copy[key] = '[REDACTED]'
    }
  }
  return copy
}
