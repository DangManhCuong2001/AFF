import type {ProductInput} from '@/engines/core/types'
import type {ImageFocus, ImageInsight} from '@/engines/planning/types'
import {readImageInteraction} from '@/lib/ai/image-interaction'

export interface ProductInteraction {
  id: string
  label: string
  action: string
  needsVision: boolean
  reason?: string
  targetEvidence?: string
  targetRegion?: ImageFocus
  demonstrationProp?: string
  demonstrationPropKind?: 'closed-loop' | 'resting-object'
  gripDescription?: string
}
const contactPoints = {handle: 'visible handle', rim: 'visible outer rim', body: 'visible outer body', surface: 'visible front surface'} as const
const props = {phone: 'one plain unbranded phone', book: 'one small closed unbranded book', 'small-item': 'one small lightweight unbranded household item', 'loop-item': 'one short plain unbranded flexible fabric hanging loop with one clearly visible closed opening and no metal rings, keys or attachments', sponge: 'one small plain unbranded kitchen sponge', bottle: 'one small closed plain unbranded bottle', cloth: 'one folded plain unbranded cloth', cup: 'one small empty plain unbranded cup'} as const
export const hasPurposefulVidsAction = (id?: string) => !!id && (
  id.startsWith('functional-demo-') || id.startsWith('showcase-')
  || id.endsWith('-pick-place') || id.endsWith('-lift') || id === 'light-placement'
)
const point = (reason: string): ProductInteraction => ({
  id: 'visible-detail', label: 'Chỉ vào chi tiết nhìn thấy', needsVision: false, reason,
  action: 'One adult hand enters beside the product and points to one clearly visible existing detail without covering it, then withdraws. The entire product remains stationary. Do not open, assemble, activate, rotate or invent a feature.',
})

/** Compose a bounded motion from the selected image's physical evidence.
 * Product names, category, seller copy and arbitrary AI instructions never
 * select an action. Missing/old observations remain usable as a simple intro.
 */
export function planProductInteraction(product: ProductInput, insight?: ImageInsight): ProductInteraction {
  const seen = insight?.source === 'vision' && product.assets.some(asset => asset.id === insight.assetId && ['image', 'PRODUCT_IMAGE', 'DETAIL_IMAGE'].includes(asset.type))
  if (!seen || !insight) return point('Chưa có quan sát ảnh tin cậy cho ảnh này; chưa mô phỏng cách sử dụng.')
  if (insight.role === 'packaging') return {id: 'packaging-detail', label: 'Giới thiệu bao bì đang nhìn thấy', needsVision: true, reason: 'Ảnh này là bao bì; chưa mô phỏng thao tác với sản phẩm bên trong.', action: 'One adult hand points beside one clearly visible printed detail on the existing package, then withdraws. Keep the package stationary, closed and unchanged. Do not unpack it or generate the product inside.'}
  // Validate again at the consumer boundary: plans may come from stored JSON.
  const evidence = readImageInteraction(insight.interaction, insight.details || [])
  if (!evidence || evidence.confidence !== 'high') return point('Chưa xác định chắc điểm tiếp xúc và cấu trúc từ ảnh; chỉ giới thiệu chi tiết nhìn thấy.')
  const targetEvidence = insight.details![evidence.targetDetail - 1].text.trim()
  if (targetEvidence.length > 120 || /[<>\n\r]|https?:|ignore|instructions|system prompt/iu.test(targetEvidence)) return point('Chi tiết tương tác chưa hợp lệ; chỉ giới thiệu ảnh gốc.')
  const contact = contactPoints[evidence.contact]
  const reason = `Dựa trên chi tiết trong ảnh: ${targetEvidence}`
  const base = {needsVision: true, targetEvidence, targetRegion: insight.details![evidence.targetDetail - 1].focus, reason, gripDescription: contact}
  const action = evidence.action === 'pick-place' && !['flat', 'upright'].includes(evidence.restingPose || '') ? 'lift' : evidence.action
  if (evidence.action === 'point') return {...point(reason), ...base}
  // Stacked/occluded parts can be touched, never separated to reveal hidden
  // geometry. Close-ups cannot establish a complete object to lift or load.
  const wholeLoose = evidence.arrangement === 'separate' && insight.role !== 'detail'
  if (action === 'pick-place' && wholeLoose && evidence.mobility === 'handheld' && evidence.contact !== 'surface' && evidence.prop === 'none') return {
    ...base, id: `${evidence.contact}-pick-place`, label: 'Cầm và đặt vào vị trí chuẩn bị',
    action: `One adult hand grips the ${contact} of the one separate item identified in the reference. In a single controlled preparation gesture, lift that same item slightly, move it a short distance into the foreground, and gently settle it onto the plain work surface without changing its facing direction. Show the contact and completed placement clearly, then let the hand withdraw. The purpose is to show handling and arrangement, not performance. Keep all other items stationary. Do not extract an inserted part, separate a stack, reveal hidden faces, cut, pour, activate or add a product part.`,
  }
  if (action === 'lift' && wholeLoose && evidence.mobility === 'handheld' && evidence.contact !== 'surface' && evidence.prop === 'none') return {
    ...base, id: `${evidence.contact}-lift`, label: 'Cầm tại điểm thấy rõ và nhấc nhẹ',
    reason: action !== evidence.action ? `Giữ nguyên hướng món đang tựa nghiêng hoặc chưa rõ tư thế, tránh biến dạng khi đặt xuống. ${reason}` : reason,
    action: `One adult hand approaches the ${contact} of the one separate item identified in the reference from the nearest clear edge. Establish a complete grip on that contact point before moving the item; fingers must not touch any other product surface. Lift that same item a few centimetres parallel to the image plane, keeping its original angle and facing direction exactly fixed. Present that same front face and grip, without rotation or returning the item. Keep every other item stationary. Do not extract an inserted item, separate a stack, reveal a hidden face, cut, pour or operate the item.`,
  }
  if (evidence.action === 'place' && insight.role !== 'detail' && evidence.mobility === 'fixed' && evidence.contact === 'surface' && evidence.prop !== 'none' && evidence.supportState === 'empty' && evidence.access === 'clear' && evidence.supportUse === 'storage') return {
    ...base, id: 'light-placement', label: 'Đặt nhẹ đạo cụ lên mặt đỡ thấy rõ', demonstrationProp: props[evidence.prop], demonstrationPropKind: evidence.prop === 'loop-item' ? 'closed-loop' : 'resting-object',
    action: `Start with ${props[evidence.prop]} held visibly beside the product. Move that one prop through the clearly visible opening toward the existing empty support floor identified in the reference. Lower it until the prop rests on that actual support floor, release every finger, and withdraw the empty hand. End with that same prop resting inside/on the original product. Show the approach, supported contact, complete release and withdrawal as one continuous action; no pointing-only gesture, no floating prop, no passing through bars or walls. Keep the entire product, supports and attachments fixed and unchanged. The prop is a demonstration object, not an included accessory. Do not invent a shelf, slot, port or attachment. No charging, loading capacity, strength, stability or performance test.`,
  }
  if (evidence.arrangement === 'unknown' || evidence.mobility === 'unknown') return point('Chưa rõ món rời hay gắn cố định; chưa mô phỏng thao tác cầm hoặc đặt đồ.')
  return {
    ...base, id: 'surface-touch', label: 'Chạm nhẹ phần ngoài đang nhìn thấy',
    reason: evidence.action === 'touch' ? reason : `Giảm còn thao tác chạm: ảnh chưa đủ điều kiện để nhấc hoặc đặt đồ. ${reason}`,
    action: `One adult hand gently touches only the ${contact} identified by the reference detail, then withdraws. Keep every item in its exact original position and arrangement. Do not lift, separate, open, press controls, stretch, rotate, reveal hidden surfaces or change patterns. Keep fingers away from sharp edges. No fit, strength, durability or performance demonstration.`,
  }
}

export function handsDemoPrompt(interaction: ProductInteraction, _identityNotes: string[]): string {
  void _identityNotes
  // Keep seller/vision wording out of the generator prompt: it was being painted
  // as an invented heading. The actual source photo carries product identity.
  const region = interaction.targetRegion
  const target = region ? ` The final product CONTACT region is at x=${Math.round(region.x)}%, y=${Math.round(region.y)}%, width=${Math.round(region.width)}%, height=${Math.round(region.height)}% of the reference. This identifies the contact only, NOT the approach path or a hole in the product. Let the hand and prop approach OUTSIDE this region through the planned clear opening; never enter directly through its foreground wall, bars or floor.` : ''
  const end = interaction.id.endsWith('-lift') ? 'hold the item steady in that same grip; do not release it' : 'hold the completed result with the empty hand withdrawn'
  return `PRIMARY PHYSICAL ACTION — follow this before any visual styling: ${interaction.action}${target} Start the approach within 0.5 seconds. From 6.5 to 8 seconds ${end}; do not reset or repeat. CONTINUITY: use the same single hand and same single prop from entry through the final hold. A silent observational recording of the exact physical object in the attached photograph, one continuous 8-second portrait 9:16 shot. Keep the original support/mounting and visible setting. Fixed camera, steady light, no cuts, orbit or zoom. The neutral margins belong to the reference canvas; do not enlarge, stretch or redesign the product to fill them. Retain the exact original silhouette, width-to-height ratio, perspective, bounding-box scale, component count, spacing, openings, attachments and existing printed marks. Never resize the product to make room for the hand. Use a partially visible adult hand only as an action cue, not as a scale claim. Frame the complete product with room for one hand and short forearm. All other original components stay fixed. No graphic design, titles, captions, floating text, new logos or brand symbols. No speech, music, before/after claims or performance test.`
}
