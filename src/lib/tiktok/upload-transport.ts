/** Browser upload progress and an inactivity deadline, separate from TikTok processing. */
export async function uploadDirectChunk(url: string, chunk: Blob, start: number, total: number, onProgress?: (bytes: number) => void): Promise<number> {
  const headers = {'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${start + chunk.size - 1}/${total}`}
  if (typeof XMLHttpRequest === 'undefined') {
    const response = await fetch(url, {method: 'PUT', headers, body: chunk, signal: AbortSignal.timeout(600_000)})
    return response.status
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    let idle: ReturnType<typeof setTimeout> | undefined
    const finish = (status?: number, message?: string) => {
      if (idle) clearTimeout(idle)
      request.onload = request.onerror = request.ontimeout = request.onabort = null
      request.upload.onprogress = null
      if (message) reject(new Error(message))
      else resolve(status!)
    }
    const resetIdle = () => {
      if (idle) clearTimeout(idle)
      idle = setTimeout(() => {
        finish(undefined, 'Kết nối gửi video không có tiến triển trong 60 giây.')
        request.abort()
      }, 60_000)
    }
    request.open('PUT', url)
    request.timeout = 600_000
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value)
    request.upload.onprogress = (event) => {
      resetIdle()
      onProgress?.(Math.min(chunk.size, event.loaded))
    }
    request.onload = () => finish(request.status)
    request.onerror = () => finish(undefined, 'Trình duyệt chưa xác nhận được kết quả gửi video.')
    request.ontimeout = () => finish(undefined, 'Gửi video vượt thời gian chờ 10 phút.')
    request.onabort = () => finish(undefined, 'Đã dừng kết nối gửi video.')
    resetIdle()
    try {request.send(chunk)} catch {finish(undefined, 'Không mở được kết nối gửi video.')}
  })
}
