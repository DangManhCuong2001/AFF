import type {PrivacyLevel} from './types'
import {postingProgress, uploadRanges, type TikTokPostingMode} from './posting-mode'
import {uploadDirectChunk} from './upload-transport'

const requestSignal = (signal?: AbortSignal, timeout = 20_000) => signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout)

async function readStatus(publishId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/tiktok/publish-status?publish_id=${encodeURIComponent(publishId)}`, {cache: 'no-store', signal: requestSignal(signal)})
  const status = await response.json().catch(() => ({}))
  if (!response.ok || typeof status.status !== 'string') throw new Error(status.error?.message || 'Chưa đọc được trạng thái từ TikTok.')
  return status as {status: string; failReason?: string; uploadedBytes?: number}
}

export async function fetchTikTokProgress(publishId: string, mode: TikTokPostingMode, signal?: AbortSignal) {
  const status = await readStatus(publishId, signal)
  return postingProgress(mode, status.status, status.failReason)
}

export interface TikTokUploadSession {
  publishId: string
  uploadUrl: string
  chunkSize: number
  totalChunkCount: number
  videoSize: number
  mode: TikTokPostingMode
  maxProxyBytes?: number
}

interface SendVideoOptions {
  mode: TikTokPostingMode
  title: string
  privacyLevel: PrivacyLevel
  isAigc: boolean
  onInitialized?: (publishId: string) => void
  onSession?: (session: TikTokUploadSession) => void
  onProgress?: (message: string) => void
  session?: TikTokUploadSession
}

/** Transfer only. The caller must query TikTok before claiming Inbox delivery/publication. */
export async function sendTikTokVideo(video: Blob, options: SendVideoOptions) {
  let data = options.session
  if (data && (data.videoSize !== video.size || data.mode !== options.mode)) throw new Error('Phiên gửi không khớp video hoặc cách gửi đã chọn.')
  if (!data) {
    const init = await fetch('/api/tiktok/publish', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      signal: requestSignal(undefined, 40_000),
      body: JSON.stringify(options.mode === 'upload' ? {mode: 'upload', videoSize: video.size} : {mode: 'publish', videoSize: video.size, title: options.title, privacyLevel: options.privacyLevel, isAigc: options.isAigc, disableComment: false, disableDuet: false, disableStitch: false}),
    })
    const body = await init.json().catch(() => ({}))
    if (!init.ok || !body.publishId || !body.uploadUrl) {
      const message = body.error?.code === 'scope_not_authorized' ? `Tài khoản chưa cấp quyền video.${options.mode}. Hãy kết nối lại TikTok bằng cách gửi đã chọn.` : body.error?.message
      throw new Error(message || `Không khởi tạo được yêu cầu TikTok (${init.status}).`)
    }
    data = {...body, videoSize: video.size, mode: options.mode} as TikTokUploadSession
  }
  options.onSession?.(data)
  options.onInitialized?.(data.publishId)
  const ranges = uploadRanges(video.size, data.chunkSize, data.totalChunkCount)
  let accepted = 0
  if (options.session) {
    options.onProgress?.('Đang kiểm tra phiên gửi trước khi tiếp tục...')
    const status = await readStatus(data.publishId)
    if (status.status === 'FAILED') throw new Error(postingProgress(options.mode, status.status, status.failReason).message)
    if (['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE'].includes(status.status)) return {publishId: data.publishId, mode: options.mode}
    accepted = status.uploadedBytes || 0
    if (accepted !== video.size && !ranges.some(range => range.start === accepted)) throw new Error('TikTok đang nhận dở một phân đoạn. Kiểm tra lại trạng thái trước khi tiếp tục; phiên gửi được giữ nguyên.')
  }
  let proxyOnly = false
  for (const {start, end} of ranges) {
    if (accepted >= end) continue
    const chunk = video.slice(start, end)
    const progress = (bytes: number) => options.onProgress?.(`Đang chuyển video: ${Math.min(100, Math.floor((start + bytes) * 100 / video.size))}% (${((start + bytes) / 1024 ** 2).toFixed(1)}/${(video.size / 1024 ** 2).toFixed(1)} MB). Chưa xác nhận xử lý.`)
    progress(0)
    if (!proxyOnly) {
      try {
        const status = await uploadDirectChunk(data.uploadUrl, chunk, start, video.size, progress)
        if (status >= 200 && status < 300) {progress(chunk.size); continue}
      } catch { /* Browser CORS may require the same-origin proxy. */ }
      proxyOnly = true
      options.onProgress?.('Kết nối gửi file chưa xác nhận. Đang kiểm tra TikTok trước khi chuyển tiếp...')
      // A successful PUT may have a response hidden by CORS. Do not resend accepted bytes.
      const status = await readStatus(data.publishId)
      if (status.status === 'FAILED') throw new Error(postingProgress(options.mode, status.status, status.failReason).message)
      if (['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE'].includes(status.status)) break
      if (typeof status.uploadedBytes === 'number' && status.uploadedBytes >= end) continue
      if (typeof status.uploadedBytes === 'number' && status.uploadedBytes > start) throw new Error('TikTok đã nhận một phần video. Kiểm tra lại trạng thái để tránh gửi trùng phân đoạn.')
    }
    if (data.maxProxyBytes && chunk.size > data.maxProxyBytes) throw new Error('Kết nối gửi trực tiếp chưa hoàn tất và file vượt giới hạn chuyển tiếp của máy chủ. Phiên gửi đã được giữ lại; kiểm tra trạng thái hoặc tải MP4 xuống để đăng trong TikTok.')
    options.onProgress?.('Đang chuyển file qua máy chủ. Chờ xác nhận từ TikTok...')
    const form = new FormData()
    form.append('action', 'chunk')
    form.append('uploadUrl', data.uploadUrl)
    form.append('startByte', String(start))
    form.append('totalBytes', String(video.size))
    form.append('chunk', chunk, 'video.mp4')
    const result = await fetch('/api/tiktok/publish', {method: 'POST', body: form, signal: requestSignal(undefined, 55_000)})
    if (!result.ok) {
      const error = await result.json().catch(() => ({}))
      throw new Error(result.status === 413 ? 'Máy chủ vượt giới hạn nhận file. Hãy chạy trên local hoặc tải MP4 xuống để đăng trong TikTok.' : error.error?.message || `Không chuyển được file video (${result.status}).`)
    }
    progress(chunk.size)
  }
  return {publishId: data.publishId as string, mode: options.mode}
}
