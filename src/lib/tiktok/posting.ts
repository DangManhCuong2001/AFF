import { tiktokFetch } from './client'
import {fileUploadPlan} from './posting-mode'
import {
  DirectPostInitParams,
  DirectPostInitResult,
  PublishStatusResult,
  TikTokPublishRawStatus,
  TikTokApiError,
} from './types'
import {
  initVideoPostApiResponseSchema,
} from './schemas'

/**
 * Initialize Direct Post on TikTok
 */
export async function initDirectPost(
  params: DirectPostInitParams
): Promise<DirectPostInitResult> {
  const {chunkSize, totalChunkCount} = fileUploadPlan(params.videoSize)

  const body = {
    post_info: {
      title: params.title,
      privacy_level: params.privacyLevel,
      disable_comment: Boolean(params.disableComment),
      disable_duet: Boolean(params.disableDuet),
      disable_stitch: Boolean(params.disableStitch),
      video_cover_timestamp_ms: params.videoCoverTimestampMs || 1000,
      is_aigc: Boolean(params.isAigc),
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: params.videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunkCount,
    },
  }

  const result = await tiktokFetch<unknown>('/post/publish/video/init/', {
    method: 'POST',
    body,
    requireAuth: true,
  })

  const parsed = initVideoPostApiResponseSchema.safeParse(result.raw)

  if (!parsed.success || !parsed.data.data?.publish_id || !parsed.data.data?.upload_url) {
    throw new TikTokApiError({
      code: 'INIT_POST_FAILED',
      message: 'Failed to obtain publish_id or upload_url from TikTok init response.',
      logId: result.logId,
      httpStatus: 502,
    })
  }

  return {
    publishId: parsed.data.data.publish_id,
    uploadUrl: parsed.data.data.upload_url,
    chunkSize,
    totalChunkCount,
  }
}

/** Upload-to-Inbox intentionally sends no caption, privacy, or publishing metadata. */
export async function initInboxUpload(videoSize: number): Promise<DirectPostInitResult> {
  const {chunkSize, totalChunkCount} = fileUploadPlan(videoSize)
  const result = await tiktokFetch<unknown>('/post/publish/inbox/video/init/', {
    method: 'POST',
    body: {source_info: {source: 'FILE_UPLOAD', video_size: videoSize, chunk_size: chunkSize, total_chunk_count: totalChunkCount}},
    requireAuth: true,
  })
  const parsed = initVideoPostApiResponseSchema.safeParse(result.raw)
  if (!parsed.success || !parsed.data.data?.publish_id || !parsed.data.data?.upload_url) {
    throw new TikTokApiError({code: 'INIT_UPLOAD_FAILED', message: 'Không nhận được thông tin chuyển video vào Inbox từ TikTok.', logId: result.logId, httpStatus: 502})
  }
  return {publishId: parsed.data.data.publish_id, uploadUrl: parsed.data.data.upload_url, chunkSize, totalChunkCount}
}

/**
 * Upload video binary chunk to TikTok's upload_url using official Content-Range spec
 */
export async function uploadVideoChunk(
  uploadUrl: string,
  buffer: Buffer,
  startByte = 0,
  totalBytes: number = buffer.length
): Promise<void> {
  let target: URL
  try {target = new URL(uploadUrl)} catch {throw new TikTokApiError({code: 'INVALID_UPLOAD_URL', message: 'Địa chỉ nhận video không hợp lệ.', httpStatus: 400})}
  if (target.protocol !== 'https:' || !target.hostname.endsWith('.tiktokapis.com') || target.username || target.password || target.port) {
    throw new TikTokApiError({code: 'INVALID_UPLOAD_URL', message: 'Địa chỉ nhận video không thuộc TikTok.', httpStatus: 400})
  }
  const endByte = startByte + buffer.length - 1
  const contentRange = `bytes ${startByte}-${endByte}/${totalBytes}`

  let res: Response
  try {
    res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.length.toString(),
        'Content-Range': contentRange,
      },
      body: new Uint8Array(buffer),
      redirect: 'error',
      signal: AbortSignal.timeout(45_000),
    })
  } catch {
    throw new TikTokApiError({code: 'UPLOAD_CONNECTION_INTERRUPTED', message: 'Kết nối gửi file tới TikTok bị ngắt hoặc quá thời gian chờ. Kiểm tra trạng thái phiên gửi trước khi thử lại.', httpStatus: 504})
  }

  if (!res.ok) {
    throw new TikTokApiError({
      code: 'UPLOAD_BYTES_FAILED',
      message: `TikTok chưa nhận được phân đoạn video (HTTP ${res.status}). Kiểm tra lại trạng thái phiên gửi.`,
      httpStatus: res.status,
    })
  }
}

/**
 * Query Publish Status by publishId
 */
export async function getPublishStatus(publishId: string): Promise<PublishStatusResult> {
  const result = await tiktokFetch<unknown>('/post/publish/status/fetch/', {
    method: 'POST',
    body: { publish_id: publishId },
    requireAuth: true,
  })

  const rawJson = (result.raw || {}) as Record<string, unknown>
  const data = (rawJson.data || {}) as Record<string, unknown>

  if (!data || typeof data.status !== 'string') {
    throw new TikTokApiError({
      code: 'STATUS_FETCH_FAILED',
      message: `Invalid status response payload from TikTok publish status fetch: ${JSON.stringify(rawJson)}`,
      logId: result.logId,
      httpStatus: 502,
    })
  }

  // Handle post IDs flexibly (TikTok returns publicaly_available_post_id or post_ids)
  const rawPostIds = (data.publicaly_available_post_id ?? data.post_ids) as unknown
  const postIds: string[] = []
  if (Array.isArray(rawPostIds)) {
    for (const id of rawPostIds) {
      if (id !== null && id !== undefined) postIds.push(String(id))
    }
  } else if (rawPostIds !== null && rawPostIds !== undefined) {
    postIds.push(String(rawPostIds))
  }

  return {
    publishId,
    status: data.status as TikTokPublishRawStatus,
    failReason: typeof data.fail_reason === 'string' ? data.fail_reason : undefined,
    postIds: postIds.length > 0 ? postIds : undefined,
    publicityCheckState: typeof data.publicity_check_state === 'string' ? data.publicity_check_state : undefined,
    uploadedBytes: typeof data.uploaded_bytes === 'number' ? data.uploaded_bytes : undefined,
  }
}
