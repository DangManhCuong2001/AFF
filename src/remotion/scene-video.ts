import type {SceneVideoClip} from '../lib/video/vids-plan'

/** Play once at natural speed; never cut narration or stretch footage to fill speech. */
export function sceneVideoFrames(clip: SceneVideoClip, sceneDurationSec: number, fps: number): number {
  if (!Number.isFinite(clip.durationSec) || clip.durationSec <= 0 || !Number.isFinite(sceneDurationSec) || sceneDurationSec <= 0 || !Number.isFinite(fps) || fps <= 0) return 0
  return Math.max(1, Math.floor(Math.min(clip.durationSec, sceneDurationSec) * fps))
}

/** The opening is one continuous clip across speech scenes; the CTA stays visible. */
export function hybridIntroFrames(clip: SceneVideoClip | undefined, totalFrames: number, fps: number, ctaStartSec?: number): number {
  if (!clip?.src || !Number.isFinite(clip.durationSec) || clip.durationSec <= 0 || !Number.isFinite(fps) || fps <= 0 || !Number.isFinite(totalFrames) || totalFrames <= 0) return 0
  const ctaLimit = ctaStartSec !== undefined && Number.isFinite(ctaStartSec) ? Math.max(0, Math.round(ctaStartSec * fps)) : totalFrames
  return Math.max(0, Math.min(totalFrames, ctaLimit, Math.floor(Math.min(8, clip.durationSec) * fps)))
}
