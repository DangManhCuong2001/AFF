import {vidsSourceCrop} from './vids-framing'

export interface VidsReviewFrame {label: string; seconds: number; src: string}
export function vidsReviewTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 15) throw new Error('Không đọc được thời lượng clip.')
  return [0, duration / 2, Math.max(0, duration - Math.min(0.1, duration / 10))]
}
/** Denser chronological samples for approach, contact, release and withdrawal. */
export function vidsPhysicsReviewTimes(duration: number): number[] {
  const overview = vidsReviewTimes(duration)
  const end = overview[2]
  return Array.from({length: 12}, (_, index) => end * index / 11)
}
function videoEvent(video: HTMLVideoElement, event: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', failed); signal.removeEventListener('abort', aborted)}
    const done = () => {cleanup(); resolve()}
    const failed = () => {cleanup(); reject(new Error('Chưa đọc được khung hình. Bạn vẫn có thể xem clip bằng trình phát.'))}
    const aborted = () => {cleanup(); reject(new DOMException('Aborted', 'AbortError'))}
    const timer = setTimeout(failed, 10_000)
    video.addEventListener(event, done, {once: true}); video.addEventListener('error', failed, {once: true}); signal.addEventListener('abort', aborted, {once: true})
    if (signal.aborted) aborted()
  })
}
/** Decode the saved local MP4. No upload, AI analysis or generation request. */
export async function extractVidsReviewFrames(src: string, signal: AbortSignal, frameAspect?: number, maxDimension = 320, sampling: 'overview' | 'physics' = 'overview'): Promise<VidsReviewFrame[]> {
  const video = document.createElement('video')
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous'
  try {
    const loaded = videoEvent(video, 'loadeddata', signal)
    video.src = src; video.load()
    await loaded
    const times = sampling === 'physics' ? vidsPhysicsReviewTimes(video.duration) : vidsReviewTimes(video.duration)
    if (!video.videoWidth || !video.videoHeight) throw new Error('Chưa đọc được khung hình clip.')
    const crop = vidsSourceCrop(video.videoWidth, video.videoHeight, frameAspect)
    const scale = Math.min(1, Math.max(320, Math.min(640, maxDimension)) / Math.max(crop.width, crop.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(crop.width * scale)); canvas.height = Math.max(1, Math.round(crop.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Chưa đọc được khung hình clip.')
    const frames: VidsReviewFrame[] = []
    for (let index = 0; index < times.length; index++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (Math.abs(video.currentTime - times[index]) > 0.001) {
        const seeked = videoEvent(video, 'seeked', signal)
        video.currentTime = times[index]
        await seeked
      }
      context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
      frames.push({label: sampling === 'physics' ? `${times[index].toFixed(1)}s` : ['Đầu', 'Giữa', 'Cuối'][index], seconds: times[index], src: canvas.toDataURL('image/jpeg', 0.9)})
    }
    return frames
  } finally {video.removeAttribute('src'); video.load()}
}
