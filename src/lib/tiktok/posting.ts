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
  publishStatusApiResponseSchema,
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

  const parsed = publishStatusApiResponseSchema.safeParse(result.raw)

  if (!parsed.success || !parsed.data.data) {
    throw new TikTokApiError({
      code: 'STATUS_FETCH_FAILED',
      message: 'Invalid status response payload from TikTok publish status fetch.',
      logId: result.logId,
      httpStatus: 502,
    })
  }

  const raw = parsed.data.data

  return {
    publishId,
    status: raw.status as TikTokPublishRawStatus,
    failReason: raw.fail_reason,
    postIds: raw.post_ids,
    publicityCheckState: raw.publicity_check_state,
  }
}
