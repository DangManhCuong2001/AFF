import type {ProductInput, StoryboardScene} from '../core/types'
import type {ImageInsight, ProductFact, HookEditorialScore} from './types'
import {copyTokens, equivalentCopy} from './copy-novelty'
import {intentForFact, normalizeCopy, visualMatch} from './commerce-copy'
import {validateCommerceCopy} from '../../lib/ai/validate-commerce-copy'

export interface CommerceHook {
  id: string
  text: string
  headline?: string
  evidenceIds?: string[]
  source?: 'gemini' | 'rules'
  type?: string
  reasoning?: string
  editorialScore?: HookEditorialScore
}
const genericTokens = new Set(['ban', 'can', 'dang', 'tim', 'chon', 'xem', 'thong', 'tin', 'truoc', 'khi', 'chi', 'tiet', 'phu', 'hop', 'ket', 'noi', 'kich', 'thuoc', 'chieu', 'dai', 'thanh', 'phan', 'chat', 'lieu', 'mau', 'dong', 'bo', 'toan', 'so', 'huu', 'thiet', 'ke', 'ro', 'net'])
const anchors = (text: string) => [...copyTokens(text)].filter((token) => !genericTokens.has(token))
const hasShopperNeed = (text: string) => /\bcan\b|dang tim|co (?:phu )?hop|dieu ban|ban muon|\bthich\b|\bmuon\b|\bneu\b/.test(normalizeCopy(text))

/** Some models put the actual opening only in the headline. Preserve it in speech
 * when the short combination still passes the normal source checks downstream. */
export function restoreSpokenHookNeed<T extends {text: string; headline?: string}>(hook: T): T {
  if (!hook.headline || hasShopperNeed(hook.text) || !hasShopperNeed(hook.headline)) return hook
  const text = `${hook.headline.replace(/[.!?]+$/, '')}? ${hook.text}`
  return text.trim().split(/\s+/).length <= 18 ? {...hook, text} : hook
}
export function isGenericCommerceHook(text: string): boolean {
  return /^(?:kham pha|quan sat|cung (?:xem|nhin))\b|ban da (?:xem|biet|nghe)|cung (?:xem|kham pha)|kham pha san pham|san pham nay co gi|xem qua thiet ke/.test(normalizeCopy(text))
}
export const answerScenes = (scenes: StoryboardScene[]) => scenes.filter((scene) => scene.type !== 'hook' && scene.type !== 'cta' && !scene.voice.trim().endsWith('?'))

/** Only score promises the final body actually addresses; questions alone are not answers. */
export function hookIsAnswered(hook: Pick<CommerceHook, 'text' | 'evidenceIds'>, facts: ProductFact[], scenes: StoryboardScene[]): boolean {
  const body = answerScenes(scenes)
  const ids = hook.evidenceIds || []
  if (!ids.length) return body.length > 0
  if (ids.some((id) => !facts.some((fact) => fact.id === id) || !body.some((scene) => scene.renderPlan?.evidenceIds.includes(id)))) return false
  const promised = copyTokens(hook.text)
  for (const id of ids) {
    const fact = facts.find((item) => item.id === id)!
    const used = anchors(fact.text).filter((token) => promised.has(token))
    const answered = copyTokens(body.filter((scene) => scene.renderPlan?.evidenceIds.includes(id)).map((scene) => scene.voice).join(' '))
    if (used.length && !used.some((token) => answered.has(token))) return false
  }
  const bodyTokens = copyTokens(body.map((scene) => scene.voice).join(' '))
  const evidenceTokens = copyTokens(facts.filter((fact) => ids.includes(fact.id)).map((fact) => fact.text).join(' '))
  // Keep exact measurements/model identifiers in the answer, even when copy is paraphrased.
  const critical = anchors(hook.text).filter((token) => evidenceTokens.has(token) && (/\d/.test(token) || /^(usb|bluetooth|cotton|linen|inox|silicone|iphone|android|edp|edt|kem|den|trang|xanh|vang|hong|nau)$/.test(token)))
  return critical.every((token) => bodyTokens.has(token))
}

/** Local editorial criteria, not a prediction of watch time, clicks or purchases. */
export function rankCommerceHooks<T extends CommerceHook>(candidates: T[], context: {product: ProductInput; facts: ProductFact[]; scenes: StoryboardScene[]; images: ImageInsight[]; focusId?: string}): Array<T & {editorialScore: HookEditorialScore; reasoning: string}> {
  const {product, facts, scenes, images, focusId} = context
  const focus = facts.find((fact) => fact.id === focusId)
  const productTokens = copyTokens(product.name)
  const details = anchors(focus?.text || '').filter((token) => !productTokens.has(token))
  const meaningful = details.length ? details : anchors(focus?.text || product.name)
  const ranked = candidates.filter((hook) => validateCommerceCopy({...hook, evidenceIds: hook.evidenceIds || []}, facts, product.name, 'hook', focusId) && hookIsAnswered(hook, facts, scenes))
    .filter((hook) => !isGenericCommerceHook(hook.text))
    .map((hook) => {
      const tokens = copyTokens(hook.text)
      const covered = meaningful.filter((token) => tokens.has(token)).length
      const need = hasShopperNeed(hook.text)
      const relevance = focus ? 20 + (need ? 5 : 0) : 15
      const specificity = Math.min(25, Math.round(20 * covered / Math.max(1, meaningful.length)) + (anchors(hook.text).some((token) => /\d|usb|bluetooth/.test(token)) ? 5 : 0))
      const count = hook.text.trim().split(/\s+/).length
      const checking = /^(truoc khi|kiem tra|doi chieu)/.test(normalizeCopy(hook.text))
      const clarity = Math.max(0, (count >= 4 && count <= 14 ? 25 : 18) - (checking ? 8 : 0))
      const pictured = focus && ['color', 'contents', 'compatibility', 'design', 'fit'].includes(intentForFact(focus).id) && images.some((image) => image.source === 'vision' && visualMatch(focus, image) > 0)
      const support = pictured ? 25 : focus ? 18 : product.assets.length ? 12 : 5
      const editorialScore = {relevance, specificity, clarity, support, total: relevance + specificity + clarity + support}
      const reasoning = [covered > 0 ? 'Nêu chi tiết có nguồn' : 'Giới thiệu đúng sản phẩm', need ? 'gắn câu hỏi chọn mua' : 'câu mở trực tiếp', 'có phần giải thích trong video'].join('; ') + '.'
      return {...hook, editorialScore, reasoning}
    }).sort((a, b) => b.editorialScore.total - a.editorialScore.total)
  return ranked.filter((hook, index) => !ranked.slice(0, index).some((previous) => equivalentCopy(previous.text, hook.text)))
}
