import type {StoryboardScene} from '@/engines/core/types'

/** Share one context photo between opening and CTA; retain source photos for detail scenes. */
export function attachContextImage(scenes: StoryboardScene[], imageUrl: string): StoryboardScene[] {
  return scenes.map((scene, index) => scene.renderPlan && (index === 0 || scene.type === 'cta')
    ? {...scene, renderPlan: {...scene.renderPlan, contextImageUrl: imageUrl}} : scene)
}
export function getContextImage(scenes: StoryboardScene[]): string | undefined {
  return scenes.find((scene) => scene.renderPlan?.contextImageUrl)?.renderPlan?.contextImageUrl
}
