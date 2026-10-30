import type {ProductInput} from '../core/types'
import type {ImageFocus, ImageInsight, NarrativeVisualStep} from './types'
import {narrationPhraseRange} from './narrative-timing'
import {normalizeVietnameseNumbers} from '../../lib/audio/speech-normalization'

const stop = new Set(['co', 'va', 'bo', 'mau', 'la', 'nhin', 'thay', 'anh', 'mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi', 'tram', 'linh', 'cac', 'nhung', 'phan', 'trong', 'voi', 'cua', 'nay', 'san', 'pham', 'gom', 'mon'])
const tokens = (text: string) => normalizeVietnameseNumbers(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().match(/[a-z]+/g)?.filter(word => word.length >= 2 && !stop.has(word)) || []
const validCrop = (crop: ImageFocus) => [crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) && crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0 && crop.x + crop.width <= 100.001 && crop.y + crop.height <= 100.001

/** Model quotes select known source details, never arbitrary crop coordinates. */
export function compileNarrativeVisuals(raw: unknown, voice: string, assets: ProductInput['assets'], insights: ImageInsight[]): NarrativeVisualStep[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 4).flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.phrase !== 'string' || item.phrase.length > 120 || typeof item.assetId !== 'string' || !Number.isInteger(item.detailIndex)) return []
    const phrase = item.phrase.trim()
    if (!narrationPhraseRange(voice, phrase)) return []
    const assetIndex = assets.findIndex(asset => asset.id === item.assetId && ['image', 'PRODUCT_IMAGE', 'DETAIL_IMAGE'].includes(asset.type))
    const insight = insights.find(image => image.assetId === item.assetId && image.source === 'vision' && image.role !== 'packaging')
    const detail = item.detailIndex >= 1 && item.detailIndex <= 3 ? insight?.details?.[item.detailIndex - 1] : undefined
    if (assetIndex < 0 || !detail?.text || /[<>\n\r]|https?:|ignore|instructions/iu.test(detail.text)) return []
    const words = new Set(tokens(detail.text))
    if (!tokens(phrase).some(word => words.has(word))) return []
    const crop = detail.focus || insight?.productBounds
    if (crop && !validCrop(crop)) return []
    return [{phrase, assetId: item.assetId, assetIndex, crop, label: phrase.replace(/[.,;:!?]+$/u, '')}]
  }).sort((a, b) => narrationPhraseRange(voice, a.phrase)!.start - narrationPhraseRange(voice, b.phrase)!.start)
}

/** Recompute after edits so stale phrases cannot silently show the wrong image. */
export function activeNarrativeVisual(steps: NarrativeVisualStep[] | undefined, voice: string, progress: number): number {
  const ranges = (steps || []).flatMap((step, index) => {const range = narrationPhraseRange(voice, step.phrase); return range ? [{index, ...range}] : []}).sort((a, b) => a.start - b.start)
  return [...ranges].reverse().find(range => progress >= range.start)?.index ?? ranges[0]?.index ?? -1
}
