import type {StoryboardScene} from '@/engines/core/types'

export class NarrationSyncError extends Error {
  constructor() {
    super('Giọng đọc chưa khớp thời gian các cảnh. Hãy tạo lại giọng rồi xuất video; bản hiện tại có thể đổi cảnh khi chưa đọc hết câu.')
    this.name = 'NarrationSyncError'
  }
}

/** Never silently render a master track against estimated scene durations. */
export function assertNarrationDuration(scenes: Pick<StoryboardScene, 'duration'>[], audioDuration: number, fps = 30) {
  if (!scenes.length || !Number.isFinite(audioDuration) || audioDuration <= 0 || scenes.some(scene => !Number.isFinite(scene.duration) || scene.duration <= 0)) throw new NarrationSyncError()
  const planned = scenes.reduce((sum, scene) => sum + scene.duration, 0)
  if (Math.abs(planned - audioDuration) > 1 / fps + 0.005) throw new NarrationSyncError()
}
