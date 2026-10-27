import type {PrivacyLevel} from './types'
import {postingProgress, uploadRanges, type TikTokPostingMode} from './posting-mode'

export async function fetchTikTokProgress(publishId: string, mode: TikTokPostingMode, signal?: AbortSignal) {
  const response = await fetch(`/api/tiktok/publish-status?publish_id=${encodeURIComponent(publishId)}`, {cache: 'no-store', signal})
  const status = await response.json().catch(() => ({}))
  if (!response.ok || typeof status.status !== 'string') throw new Error(status.error?.message || 'Chưa đọc được trạng thái từ TikTok.')
  return postingProgress(mode, status.status, status.failReason)
}

interface SendVideoOptions {
  mode: TikTokPostingMode
  title: string
  privacyLevel: PrivacyLevel
  isAigc: boolean
  onInitialized?: (publishId: string) => void
}

/** Transfer only. The caller must query TikTok before claiming Inbox delivery/publication. */
export async function sendTikTokVideo(video: Blob, options: SendVideoOptions) {
  const init = await fetch('/api/tiktok/publish', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(options.mode === 'upload' ? {mode: 'upload', videoSize: video.size} : {mode: 'publish', videoSize: video.size, title: options.title, privacyLevel: options.privacyLevel, isAigc: options.isAigc, disableComment: false, disableDuet: false, disableStitch: false}),
  })
  const data = await init.json().catch(() => ({}))
  if (!init.ok || !data.publishId || !data.uploadUrl) {
    const message = data.error?.code === 'scope_not_authorized' ? `Tài khoản chưa cấp quyền video.${options.mode}. Hãy kết nối lại TikTok bằng cách gửi đã chọn.` : data.error?.message
    throw new Error(message || `Không khởi tạo được yêu cầu TikTok (${init.status}).`)
  }
  options.onInitialized?.(data.publishId)
  const ranges = uploadRanges(video.size, data.chunkSize, data.totalChunkCount)
  let proxyOnly = false
  for (const {start, end} of ranges) {
    const chunk = video.slice(start, end)
    if (!proxyOnly) {
      try {
        const result = await fetch(data.uploadUrl, {method: 'PUT', headers: {'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${end - 1}/${video.size}`}, body: chunk})
        if (result.ok) continue
      } catch { /* Browser CORS may require the same-origin proxy. */ }
      proxyOnly = true
      // A successful PUT may have a response hidden by CORS. Do not resend accepted bytes.
      try {
        const check = await fetch(`/api/tiktok/publish-status?publish_id=${encodeURIComponent(data.publishId)}`, {cache: 'no-store'})
        const status = await check.json()
        if (check.ok && ['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE'].includes(status.status)) break
        if (check.ok && typeof status.uploadedBytes === 'number' && status.uploadedBytes >= end) continue
      } catch { /* The binary proxy still uses the original task; never reinitialize. */ }
    }
    const form = new FormData()
    form.append('action', 'chunk')
    form.append('uploadUrl', data.uploadUrl)
    form.append('startByte', String(start))
    form.append('totalBytes', String(video.size))
    form.append('chunk', chunk, 'video.mp4')
    const result = await fetch('/api/tiktok/publish', {method: 'POST', body: form})
    if (!result.ok) {
      const error = await result.json().catch(() => ({}))
      throw new Error(result.status === 413 ? 'Máy chủ vượt giới hạn nhận file. Hãy chạy trên local hoặc tải MP4 xuống để đăng trong TikTok.' : error.error?.message || `Không chuyển được file video (${result.status}).`)
    }
  }
  return {publishId: data.publishId as string, mode: options.mode}
}
