import type {StoryboardScene} from '../core/types'
import type {ProductFact} from './types'
import {explicitNegations, hasExplicitNegation} from './negation'

const filler = new Set(['san', 'pham', 'co', 'chieu', 'duoc', 'cua', 'la', 'nay', 'trong', 'anh', 'cac', 'va', 'voi', 'mot'])
export function copyTokens(text: string): Set<string> {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/(\d+),(\d+)/g, '$1.$2').replace(/(\d+(?:\.\d+)?)\s*(met|lit|cm|mm|ml|kg|mah|gb|w|m|l|g)\b/g, (_match, number: string, unit: string) => number + (unit === 'met' ? 'm' : unit === 'lit' ? 'l' : unit))
  return new Set((normalized.match(/\d+(?:\.\d+)?[a-z]*|[a-z]+/g) || []).filter((token) => !filler.has(token)))
}

/** Conservative lexical deduplication; different measurements and negatives stay distinct. */
export function equivalentCopy(a: string, b: string): boolean {
  const left = copyTokens(a), right = copyTokens(b)
  const signature = (tokens: Set<string>, text: string) => [...[...tokens].filter((token) => /\d/.test(token)), ...explicitNegations(text)].sort().join('|')
  if (signature(left, a) !== signature(right, b) || !left.size || !right.size) return false
  if (hasExplicitNegation(a) && [...left].join('|') !== [...right].join('|')) return false
  const overlap = [...left].filter((token) => right.has(token)).length
  // A different color/device/material is still new information, even in a long sentence.
  return overlap === left.size && left.size === right.size
}

export function distinctFacts(facts: ProductFact[]): ProductFact[] {
  return facts.filter((fact, index) => !facts.slice(0, index).some((previous) => equivalentCopy(previous.text, fact.text)))
}

/** Keep hook and CTA; remove body paraphrases/questions that add no sourced detail. */
export function removeRepeatedScenes(scenes: StoryboardScene[], facts: ProductFact[]) {
  const kept: StoryboardScene[] = []
  const covered = new Map<string, Set<string>>()
  let removed = 0
  for (const scene of scenes) {
    if (scene.type === 'hook' || scene.type === 'cta') {kept.push(scene); continue}
    const body = kept.filter((item) => item.type !== 'hook' && item.type !== 'cta')
    const ids = scene.renderPlan?.evidenceIds || []
    const spoken = copyTokens(scene.voice)
    const repeatsEvidence = ids.length > 0 && ids.every((id) => {
      const previous = covered.get(id)
      const fact = facts.find((item) => item.id === id)
      if (!previous || !fact) return false
      const anchors = [...copyTokens(fact.text)].filter((token) => spoken.has(token))
      return anchors.length > 0 && anchors.every((token) => previous.has(token))
    })
    const repeatedText = body.some((item) => equivalentCopy(item.voice, scene.voice))
    // Unsourced filler questions belong in the final decision prompt, not another scene.
    if (body.length && (repeatedText || repeatsEvidence || !ids.length)) {removed++; continue}
    kept.push(scene)
    for (const id of ids) covered.set(id, new Set([...(covered.get(id) || []), ...spoken]))
  }
  return {scenes: kept, removed}
}
