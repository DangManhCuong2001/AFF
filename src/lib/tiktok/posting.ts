import { tiktokFetch } from './client'
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
  const chunkSize = params.videoSize // Single chunk for standard files <= 64MB
  const totalChunkCount = 1

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
  }
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
  const endByte = startByte + buffer.length - 1
  const contentRange = `bytes ${startByte}-${endByte}/${totalBytes}`

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': buffer.length.toString(),
      'Content-Range': contentRange,
    },
    body: new Uint8Array(buffer),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new TikTokApiError({
      code: 'UPLOAD_BYTES_FAILED',
      message: `Failed to upload video data to TikTok upload_url: HTTP ${res.status} - ${errorText}`,
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
  }
}
