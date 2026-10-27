import type {StoryboardScene} from '@/engines/core/types'
export interface SceneAudioTiming {segmentId: string; durationSec: number; speechOffsetSec?: number; speechDurationSec?: number}

export const sceneVoiceSignature = (scenes: Pick<StoryboardScene, 'id' | 'voice' | 'headline'>[]) => JSON.stringify(scenes.map(scene => [scene.id, scene.voice || scene.headline]))

/** A master track must never be paired with partial or duplicate scene timings. */
export function hasCompleteSceneAudioTimings(scenes: Pick<StoryboardScene, 'id'>[], timings: SceneAudioTiming[]) {
  return scenes.length > 0 && timings.length === scenes.length && new Set(scenes.map(scene => scene.id)).size === scenes.length && new Set(timings.map(timing => timing.segmentId)).size === timings.length && scenes.every(scene => timings.some(timing => timing.segmentId === scene.id && Number.isFinite(timing.durationSec) && timing.durationSec > 0 && timing.durationSec < 120))
}

function speechWindow(timing: SceneAudioTiming) {
  const {speechOffsetSec: offset, speechDurationSec: duration} = timing
  return typeof offset === 'number' && Number.isFinite(offset) && offset >= 0 && offset < timing.durationSec && typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && offset + duration <= timing.durationSec + 0.01
    ? {offsetSec: offset, durationSec: Math.min(duration, timing.durationSec - offset)} : undefined
}
export function parseSceneAudioTimings(header: string | null): SceneAudioTiming[] {
  try {
    const value: unknown = JSON.parse(header || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is SceneAudioTiming => !!item && typeof item.segmentId === 'string' && Number.isFinite(item.durationSec) && item.durationSec > 0 && item.durationSec < 120).map((item) => {
      const window = speechWindow(item)
      return {segmentId: item.segmentId, durationSec: item.durationSec, ...(window ? {speechOffsetSec: window.offsetSec, speechDurationSec: window.durationSec} : {})}
    })
  } catch { return [] }
}
export function applySceneAudioTimings(scenes: StoryboardScene[], timings: SceneAudioTiming[]): StoryboardScene[] {
  return scenes.map((scene) => {
    const timing = timings.find((item) => item.segmentId === scene.id)
    return timing ? {...scene, duration: timing.durationSec, ...(scene.renderPlan ? {renderPlan: {...scene.renderPlan, speechTiming: speechWindow(timing)}} : {})} : scene
  })
}
