export class ContextImageError extends Error {
  constructor(message: string, public readonly code: 'QUOTA_UNAVAILABLE' | 'RATE_LIMITED' | 'CONFIGURATION_REQUIRED' | 'CONTENT_REJECTED', public readonly retryable: boolean, public readonly status = 429) {
    super(message)
    this.name = 'ContextImageError'
  }
}

export function contextContentError(payload: unknown): ContextImageError | undefined {
  const errors = (payload as {errors?: Array<{code?: number}>} | null)?.errors
  if (Array.isArray(errors) && errors.some(error => Number(error?.code) === 3030)) return new ContextImageError('Cloudflare đã chặn ảnh đầu ra (3030). Dùng ảnh bối cảnh có sẵn hoặc tiếp tục với ảnh sản phẩm gốc.', 'CONTENT_REJECTED', false, 422)
}

export function contextQuotaError(status: number, payload: unknown): ContextImageError | undefined {
  const errors = (payload as {errors?: Array<{code?: number}>} | null)?.errors
  const codes = Array.isArray(errors) ? errors.map((error) => Number(error?.code)) : []
  if (status !== 429 && !codes.includes(3036) && !codes.includes(3040)) return undefined
  if (codes.includes(3036)) return new ContextImageError('Cloudflare đã hết hạn mức Workers AI miễn phí hôm nay. Chờ reset lúc 7 giờ sáng Việt Nam hoặc tải ảnh bối cảnh có sẵn; không cần nâng cấp Paid.', 'QUOTA_UNAVAILABLE', false)
  return new ContextImageError('Cloudflare đang bận hoặc giới hạn lượt tạo ảnh. Vui lòng thử lại sau; app không tự chuyển sang dịch vụ trả phí.', 'RATE_LIMITED', true)
}
