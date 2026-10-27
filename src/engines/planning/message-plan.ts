import type {ProductInput, StoryboardScene} from '../core/types'
import type {CommerceMessage, ImageInsight, ProductFact} from './types'
import {intentForFact, visualMatch} from './commerce-copy'
import {hookIsAnswered, answerScenes} from './hook-ranking'
import {validateCommerceCopy} from '../../lib/ai/validate-commerce-copy'

export interface MessageDraft {viewerNeed: string; answer: string; evidenceIds: string[]}
export function buildCommerceMessage(product: ProductInput, facts: ProductFact[], scenes: StoryboardScene[], images: ImageInsight[], focusId?: string, question?: string, draft?: MessageDraft): CommerceMessage {
  const body = answerScenes(scenes)
  const focus = facts.find((fact) => fact.id === focusId)
  const answer = body.find((scene) => focusId && scene.renderPlan?.evidenceIds.includes(focusId)) || body[0]
  const evidenceIds = focus ? [focus.id] : []
  const validDraft = !!draft && (!focusId || draft.evidenceIds.includes(focusId)) &&
    validateCommerceCopy({text: draft.viewerNeed, evidenceIds: draft.evidenceIds}, facts, product.name, 'question') &&
    validateCommerceCopy({text: draft.answer, evidenceIds: draft.evidenceIds}, facts, product.name, 'body') &&
    hookIsAnswered({text: `${draft.viewerNeed} ${draft.answer}`, evidenceIds: draft.evidenceIds}, facts, scenes)
  const proof: CommerceMessage['proof'] = []
  for (const scene of body) for (const factId of scene.renderPlan?.evidenceIds || []) {
    const fact = facts.find((item) => item.id === factId)
    if (!fact) continue
    const image = images.find((item) => item.assetId === scene.renderPlan?.assetId)
    // Photos can show appearance, contents and visible connectors. They do not prove
    // material, dimensions, electrical ratings, comfort or efficacy.
    const visible = ['color', 'contents', 'compatibility', 'design', 'fit'].includes(intentForFact(fact).id) && image?.source === 'vision' && visualMatch(fact, image) > 0
    proof.push({sceneId: scene.id, factId, assetId: image?.assetId, kind: visible ? 'image' : 'description'})
  }
  const opening = scenes.find((scene) => scene.type === 'hook')?.voice
  return {
    viewerNeed: validDraft ? draft.viewerNeed : opening?.trim().endsWith('?') ? opening : question || `Bạn đang cân nhắc ${product.name}?`,
    answer: validDraft ? draft.answer : answer?.voice || focus?.text || `Quan sát ${product.name} qua ảnh sản phẩm.`,
    evidenceIds: validDraft ? draft.evidenceIds : evidenceIds,
    proof,
    nextStep: scenes.find((scene) => scene.type === 'cta')?.voice || 'Xem chi tiết sản phẩm.',
    source: validDraft ? 'gemini' : 'rules',
  }
}
