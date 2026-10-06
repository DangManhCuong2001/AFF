export type PrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATOR'
  | 'SELF_ONLY'

export interface TikTokTokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number // Timestamp in milliseconds
  refreshExpiresAt?: number // Timestamp in milliseconds
  openId: string
  scope: string
  tokenType: string
}

export interface TikTokApiErrorPayload {
  code: string | number
  message: string
  logId?: string
  subCode?: string
  httpStatus?: number
}

export class TikTokApiError extends Error {
  code: string | number
  logId?: string
  subCode?: string
  httpStatus?: number

  constructor(payload: TikTokApiErrorPayload) {
    super(payload.message || `TikTok API error (code: ${payload.code})`)
    this.name = 'TikTokApiError'
    this.code = payload.code
    this.logId = payload.logId
    this.subCode = payload.subCode
    this.httpStatus = payload.httpStatus
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      logId: this.logId,
      subCode: this.subCode,
      httpStatus: this.httpStatus,
    }
  }
}

export interface CreatorInfo {
  creatorAvatarUrl: string
  creatorUsername: string
  creatorNickname: string
  privacyLevelOptions: PrivacyLevel[]
  commentDisabled: boolean
  duetDisabled: boolean
  stitchDisabled: boolean
  maxVideoPostDurationSec: number
}

export interface DirectPostInitParams {
  title: string
  privacyLevel: PrivacyLevel
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
  isAigc?: boolean
  videoCoverTimestampMs?: number
  videoSize: number
}

export interface DirectPostInitResult {
  publishId: string
  uploadUrl: string
}

export type TikTokPublishRawStatus =
  | 'PROCESSING_DOWNLOAD'
  | 'PROCESSING_UPLOAD'
  | 'FAILED'
  | 'SUCCESS'

export type UiPublishStatus =
  | 'INITIALIZING'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'TIMEOUT'

export interface PublishStatusResult {
  publishId: string
  status: TikTokPublishRawStatus
  failReason?: string
  postIds?: string[]
  publicityCheckState?: string
}

export interface TikTokConnectionStatus {
  connected: boolean
  expired: boolean
  openId?: string
  scope?: string
  expiresInSeconds?: number
}

export interface DebugLogEntry {
  timestamp: string
  endpoint: string
  method: string
  status?: number
  errorCode?: string | number
  logId?: string
  requestSummary?: Record<string, unknown>
  responseSummary?: Record<string, unknown>
}
