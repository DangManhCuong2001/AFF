export type TikTokPostingMode = 'publish' | 'upload'
export const requiredPostingScope = (mode: TikTokPostingMode) => mode === 'upload' ? 'video.upload' : 'video.publish'
export const hasPostingScope = (scope: string | undefined, mode: TikTokPostingMode) => (scope || '').split(/[,\s]+/).includes(requiredPostingScope(mode))

/** TikTok requires declared chunks of 5–64 MB, merging trailing bytes into the last. */
export function fileUploadPlan(videoSize: number) {
  if (!Number.isSafeInteger(videoSize) || videoSize <= 0 || videoSize > 4 * 1024 ** 3) throw new Error('Video phải có dung lượng lớn hơn 0 và không vượt quá 4 GB.')
  const chunkSize = videoSize <= 64 * 1024 ** 2 ? videoSize : 32 * 1024 ** 2
  return {chunkSize, totalChunkCount: Math.max(1, Math.floor(videoSize / chunkSize))}
}

export function uploadRanges(videoSize: number, chunkSize: number, totalChunkCount: number) {
  const expected = fileUploadPlan(videoSize)
  if (chunkSize !== expected.chunkSize || totalChunkCount !== expected.totalChunkCount) throw new Error('Thông tin phân đoạn video không hợp lệ.')
  return Array.from({length: totalChunkCount}, (_, index) => ({start: index * chunkSize, end: index === totalChunkCount - 1 ? videoSize : (index + 1) * chunkSize}))
}

export function postingProgress(mode: TikTokPostingMode, status: string, failReason?: string) {
  if (status === 'FAILED') return {phase: 'failed' as const, terminal: true, message: `TikTok không xử lý được video${failReason ? `: ${failReason}` : '.'}`}
  if (status === 'PUBLISH_COMPLETE') return {phase: 'published' as const, terminal: true, message: 'TikTok xác nhận video đã được xuất bản.'}
  if (mode === 'upload' && status === 'SEND_TO_USER_INBOX') return {phase: 'inbox' as const, terminal: true, message: 'TikTok xác nhận đã gửi thông báo vào Inbox của tài khoản được kết nối. Mở Hộp thư trong ứng dụng TikTok để chỉnh sửa và hoàn tất đăng. Video chưa được xuất bản.'}
  if (status === 'PROCESSING_UPLOAD') return {phase: 'processing' as const, terminal: false, message: 'TikTok đang nhận file video; chưa xác nhận nhận đủ file hoặc chuyển vào Inbox.'}
  return {phase: 'processing' as const, terminal: false, message: mode === 'upload' ? 'Đã gửi file. TikTok đang xử lý để chuyển vào Inbox; video chưa được xuất bản.' : 'Đã gửi file. TikTok đang xử lý; chưa xác nhận video được xuất bản.'}
}
