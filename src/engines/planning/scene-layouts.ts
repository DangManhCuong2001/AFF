import type {ProductInput, StoryboardScene} from '../core/types'
import type {ImageInsight, ProductFact, SceneRenderPlan} from './types'
import {intentForFact, visualMatch} from './commerce-copy'

export function planSceneLayouts(scenes: StoryboardScene[], assets: ProductInput['assets'], images: ImageInsight[], facts: ProductFact[]): StoryboardScene[] {
  return scenes.map((scene) => {
    const plan = scene.renderPlan
    if (!plan) return scene
    const fact = facts.find((item) => plan.evidenceIds.includes(item.id))
    const image = images.find((item) => item.assetId === plan.assetId)
    // Recalculate after AI authors/reorders scenes; never retain a stale second asset.
    const next: SceneRenderPlan = {...plan, secondaryAsset: undefined, spec: undefined, fullProductCrop: undefined, layout: 'hero'}
    if (scene.type === 'cta') next.layout = 'decision'
    else if (scene.type !== 'hook' && plan.framing === 'detail' && image?.source === 'vision' && image.focus && fact && visualMatch(fact, image) > 0) {
      next.layout = 'detail'
      next.fullProductCrop = image.productBounds
    } else if (scene.type === 'product_hero') {
      const secondaryIndex = assets.findIndex((asset, index) => index !== plan.assetIndex && asset.url !== assets[plan.assetIndex]?.url && images.some((insight) => insight.assetId === asset.id && insight.role !== 'packaging'))
      if (secondaryIndex >= 0) {
        const secondary = images.find((item) => item.assetId === assets[secondaryIndex].id)
        next.layout = 'gallery'
        next.secondaryAsset = {assetId: assets[secondaryIndex].id, assetIndex: secondaryIndex, crop: secondary?.productBounds}
      }
    }
    if (scene.type !== 'hook' && scene.type !== 'cta' && next.layout === 'hero' && fact && ['compatibility', 'size', 'material', 'power', 'contents', 'ingredients', 'scent', 'fit'].includes(intentForFact(fact).id)) {
      next.layout = 'spec'
      next.spec = {label: intentForFact(fact).label, value: fact.text, evidenceId: fact.id}
    }
    return {...scene, renderPlan: next}
  })
}
