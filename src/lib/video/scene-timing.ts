import type {StoryboardScene} from '@/engines/core/types'
export interface SceneAudioTiming {segmentId: string; durationSec: number}
export function parseSceneAudioTimings(header: string | null): SceneAudioTiming[] {
  try {
    const value: unknown = JSON.parse(header || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is SceneAudioTiming => !!item && typeof item.segmentId === 'string' && Number.isFinite(item.durationSec) && item.durationSec > 0 && item.durationSec < 120)
  } catch { return [] }
}
export function applySceneAudioTimings(scenes: StoryboardScene[], timings: SceneAudioTiming[]): StoryboardScene[] {
  return scenes.map((scene) => {
    const timing = timings.find((item) => item.segmentId === scene.id)
    return timing ? {...scene, duration: timing.durationSec} : scene
  })
}
