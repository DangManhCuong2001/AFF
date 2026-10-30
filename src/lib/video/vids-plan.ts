import type {ProductInput, StoryboardScene} from '@/engines/core/types'
import {isProductImage} from '@/engines/planning/AdaptiveVideoPlanner'
import type {ImageInsight} from '@/engines/planning/types'
import {suggestVidsCrop, type ReferenceCrop} from './vids-reference'
import {handsDemoPrompt, planProductInteraction} from './vids-interaction'
import {VIDS_MOTION_VERSION} from './vids-physical-path'

export type VideoVisualMode = 'images' | 'vids-experiment'
export interface VidsShot {
  sceneId: string
  assetId: string
  title: string
  prompt: string
  referenceCrop?: ReferenceCrop
  identityNotes?: string[]
  expectedDurationSec?: number
  actionLabel?: string
  actionNote?: string
}
export interface SceneVideoClip {
  src: string
  durationSec: number
  frameAspect?: number
}
export type SceneVideoClips = Record<string, SceneVideoClip>
export function vidsReferenceSignature(product: ProductInput, shot: VidsShot): string {
  const asset = product.assets.find(asset => asset.id === shot.assetId)
  return JSON.stringify([VIDS_MOTION_VERSION, shot.assetId, shot.prompt, shot.referenceCrop, asset?.url, asset?.file?.size, asset?.file?.lastModified])
}
export function vidsPlanSignature(product: ProductInput, shots: VidsShot[]): string {
  return JSON.stringify(shots.map(shot => [shot.sceneId, vidsReferenceSignature(product, shot)]))
}

/** Optional visual layer only: never rewrites copy, speech timing or the image plan. */
export function planVidsShots(product: ProductInput, scenes: StoryboardScene[], insights: ImageInsight[] = [], maxClips: 1 | 3 = 1): VidsShot[] {
  const images = product.assets.filter(isProductImage)
  if (!images.length) return []
  const eligible = scenes.filter(scene => scene.renderPlan && scene.type !== 'cta' && scene.renderPlan.layout !== 'spec')
  const chosen: StoryboardScene[] = []
  const assetFor = (scene: StoryboardScene) => images.find(asset => asset.id === scene.renderPlan?.assetId)?.id || images[scene.renderPlan?.assetIndex || 0]?.id || images[0].id
  // One source image is not three different shots: do not spend three video
  // generations on slightly different pan instructions for the same source.
  const add = (scene?: StoryboardScene) => { if (scene && !chosen.some(item => assetFor(item) === assetFor(scene)) && chosen.length < maxClips) chosen.push(scene) }
  // Spend the first generation on a reference with a supported interaction,
  // rather than blindly using the hook's packaging/close-up/unanalyzed image.
  const quality = (scene: StoryboardScene) => {
    const insight = insights.find(image => image.assetId === assetFor(scene) && image.source === 'vision')
    const interaction = planProductInteraction(product, insight)
    const motion = interaction.id.endsWith('-pick-place') ? 45 : interaction.id.endsWith('-lift') || interaction.id === 'light-placement' ? 40 : interaction.id === 'surface-touch' ? 25 : interaction.needsVision ? 10 : 0
    return motion + (insight?.usageSpace === 'empty-support' && insight.quality === 'clean' ? 50 : 0) + (insight?.role === 'primary' ? 2 : 0) - (insight?.role === 'packaging' ? 20 : 0)
  }
  // The best action reference may not be used by a narration scene. In
  // particular, an empty whole-product photo can establish a real placement.
  const candidates = [...eligible]
  if (eligible[0]) for (const insight of insights) {
    const assetIndex = images.findIndex(asset => asset.id === insight.assetId)
    if (assetIndex < 0 || insight.source !== 'vision' || (insight.quality && insight.quality !== 'clean') || insight.role === 'packaging' || candidates.some(scene => assetFor(scene) === insight.assetId)) continue
    candidates.push({...eligible[0], renderPlan: {...eligible[0].renderPlan!, assetId: insight.assetId, assetIndex}})
  }
  const ranked = candidates.filter(scene => !insights.some(image => image.assetId === assetFor(scene) && image.quality === 'ui-overlay')).sort((a, b) => quality(b) - quality(a))
  add(ranked[0])
  add(ranked.find(scene => scene.renderPlan?.framing === 'detail' && !chosen.includes(scene)))
  for (const scene of ranked) {
    if (!chosen.some(item => item.renderPlan?.assetId === scene.renderPlan?.assetId)) add(scene)
  }
  for (const scene of ranked) add(scene)
  return chosen.map(scene => {
    const assetId = assetFor(scene)
    const insight = insights.find(image => image.assetId === assetId && image.source === 'vision')
    // Image observations only; seller claims and scene copy are not identity evidence.
    const identityNotes = [...new Set((insight?.details || []).map(detail => detail.text.trim()).filter(text => text.length >= 5 && text.length <= 160 && !/[<>\n\r]|https?:|ignore |instructions|bảo hành|hoàn trả|kháng khuẩn|giảm giá|cam kết|chất lượng|đảm bảo/iu.test(text)))].slice(0, 3)
    const interaction = planProductInteraction(product, insight)
    return {
      sceneId: scene.id,
      assetId,
      title: scene.headline,
      referenceCrop: suggestVidsCrop(insight?.productBounds),
      identityNotes,
      expectedDurationSec: 8,
      actionLabel: interaction.label,
      actionNote: interaction.reason,
      // No narration/headline in the prompt: editing sales copy reuses the footage.
      prompt: handsDemoPrompt(interaction, identityNotes),
    }
  })
}

/** Validate one finished sample before spending quota on the remaining scenes. */
export function vidsBatchGate(clips: {status: 'pending' | 'complete' | 'failed'; reviewed?: boolean}[]): 'sample' | 'review' | 'batch' {
  if (clips.some(clip => clip.status === 'complete' && clip.reviewed)) return 'batch'
  if (clips.some(clip => clip.status === 'complete')) return 'review'
  return 'sample'
}

export function activeSceneVideos(mode: VideoVisualMode, shots: VidsShot[], clips: SceneVideoClips): SceneVideoClips | undefined {
  if (mode === 'images') return undefined
  return Object.fromEntries(shots.flatMap(shot => clips[shot.sceneId] ? [[shot.sceneId, clips[shot.sceneId]]] : []))
}

