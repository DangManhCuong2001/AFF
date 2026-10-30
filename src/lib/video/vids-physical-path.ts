import {z} from 'zod'
import type {ProductInteraction} from './vids-interaction'

export const VIDS_MOTION_VERSION = 17
const region = z.object({
  text: z.string().trim().min(4).max(120).regex(/^[^<>\r\n]+$/),
  focus: z.object({x: z.number().min(0), y: z.number().min(0), width: z.number().positive(), height: z.number().positive()})
    .refine(box => box.x + box.width <= 100 && box.y + box.height <= 100),
})
export const physicalPathSchema = z.object({
  entry: z.enum(['top-down', 'front-in', 'left-in', 'right-in', 'grip-lift', 'unclear']),
  accessKind: z.enum(['exposed', 'enclosed', 'not-applicable', 'unclear']),
  clearance: z.enum(['clear', 'blocked', 'unclear']),
  fit: z.enum(['fits', 'too-large', 'unclear', 'not-applicable']),
  opening: region.nullable(),
  destination: region.nullable(),
  freeEnd: region.nullable().optional().default(null),
  anchor: region.nullable().optional().default(null),
}).strict()
export type VidsPhysicalPath = z.infer<typeof physicalPathSchema>
const regionJson = {type: 'object', properties: {text: {type: 'string'}, focus: {type: 'object', properties: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, {type: 'number', minimum: 0, maximum: 100}])), required: ['x', 'y', 'width', 'height'], additionalProperties: false}}, required: ['text', 'focus'], additionalProperties: false}
export const physicalPathJsonSchema = {
  type: 'object', properties: {
    entry: {type: 'string', enum: ['top-down', 'front-in', 'left-in', 'right-in', 'grip-lift', 'unclear']},
    accessKind: {type: 'string', enum: ['exposed', 'enclosed', 'not-applicable', 'unclear']},
    clearance: {type: 'string', enum: ['clear', 'blocked', 'unclear']},
    fit: {type: 'string', enum: ['fits', 'too-large', 'unclear', 'not-applicable']},
    opening: {anyOf: [regionJson, {type: 'null'}]}, destination: {anyOf: [regionJson, {type: 'null'}]},
    freeEnd: {anyOf: [regionJson, {type: 'null'}]}, anchor: {anyOf: [regionJson, {type: 'null'}]},
  }, required: ['entry', 'accessKind', 'clearance', 'fit', 'opening', 'destination', 'freeEnd', 'anchor'], additionalProperties: false,
}
export const physicalEntryLabel = (entry: VidsPhysicalPath['entry']) => ({'top-down': 'Đưa từ trên xuống', 'front-in': 'Đưa qua mặt trước đang mở', 'left-in': 'Đưa qua bên trái đang mở', 'right-in': 'Đưa qua bên phải đang mở', 'grip-lift': 'Nắm chắc rồi nhấc nhẹ', unclear: 'Chưa rõ đường tiếp cận'})[entry]
const location = (box: z.infer<typeof region>['focus']) => `x=${Math.round(box.x)}%, y=${Math.round(box.y)}%, width=${Math.round(box.width)}%, height=${Math.round(box.height)}%`
const centre = (box: z.infer<typeof region>['focus']) => ({x: box.x + box.width / 2, y: box.y + box.height / 2})
const relativePosition = (moving: z.infer<typeof region>['focus'], fixed: z.infer<typeof region>['focus']) => {
  const a = centre(moving), b = centre(fixed), horizontal = a.x - b.x > 6 ? 'to the RIGHT of' : b.x - a.x > 6 ? 'to the LEFT of' : 'horizontally aligned with'
  const vertical = a.y - b.y > 6 ? 'BELOW' : b.y - a.y > 6 ? 'ABOVE' : 'level with'
  return `${vertical} and ${horizontal}`
}
const separated = (a: z.infer<typeof region>['focus'], b: z.infer<typeof region>['focus'], minimum = 7, maximumOverlap = 0.35) => {
  const left = Math.max(a.x, b.x), top = Math.max(a.y, b.y), right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height)
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top)
  const overlap = intersection / Math.max(1, Math.min(a.width * a.height, b.width * b.height))
  const ac = centre(a), bc = centre(b)
  return overlap < maximumOverlap && Math.hypot(ac.x - bc.x, ac.y - bc.y) >= minimum
}

/** Compile geometry into bounded motion, never a product-name action dictionary.
 * These image regions identify parts, not a 2D collision simulation: depth still
 * needs inspection in the generated clip. Unknown routes never spend Vids quota.
 */
export function constrainPhysicalPath(action: ProductInteraction, raw: unknown): {action: ProductInteraction; path: VidsPhysicalPath; ready: boolean} {
  let path = physicalPathSchema.parse(raw)
  const placement = action.id === 'light-placement'
  const pickPlace = action.id.endsWith('-pick-place')
  const lift = action.id.endsWith('-lift')
  if (placement && path.accessKind === 'exposed' && path.destination && action.demonstrationPropKind === 'closed-loop') {
    path = {...path, destination: {...path.destination, text: 'bounded load-bearing support segment beyond its visible free end'}}
  }
  const closedLoopTopology = action.demonstrationPropKind !== 'closed-loop' || (
    path.accessKind === 'exposed' && !!path.destination && !!path.freeEnd && !!path.anchor
    && separated(path.destination.focus, path.anchor.focus)
    && separated(path.freeEnd.focus, path.anchor.focus)
    // The terminal end is physically connected to the support segment, so
    // their boxes may meet or overlap at the boundary. Their centres still
    // need to identify different roles. Neither may collapse into the anchor.
    && separated(path.destination.focus, path.freeEnd.focus, 4, 0.75)
  )
  const valid = path.clearance === 'clear' && (
    placement ? ['top-down', 'front-in', 'left-in', 'right-in'].includes(path.entry) && !!path.destination && path.fit === 'fits' && closedLoopTopology && (path.accessKind === 'exposed' || (path.accessKind === 'enclosed' && !!path.opening))
      : (lift || pickPlace) && path.entry === 'grip-lift' && (!pickPlace || (!!path.destination && path.fit === 'fits'))
  )
  if (!valid) return {path, ready: false, action: {...action, id: 'unverified-path', label: 'Chưa xác định được đường thao tác thực tế', reason: 'Ảnh chưa cho thấy đủ lối tiếp cận, khoảng trống hoặc mặt đặt. Chọn ảnh rõ hơn; chưa tạo clip mới.', action: 'Keep the product unchanged and stationary. No placement, lifting or invented operation.'}}
  const exposedLoopRoute = action.demonstrationPropKind === 'closed-loop'
    ? `The fixed anchor is the immobile connection at ${location(path.anchor!.focus)}. The visible free terminal is ${relativePosition(path.freeEnd!.focus, path.anchor!.focus)} that anchor, at ${location(path.freeEnd!.focus)}. The load-bearing destination is ${relativePosition(path.destination!.focus, path.anchor!.focus)} the anchor, at ${location(path.destination!.focus)}. Begin with the complete fabric loop held in clear air above the FREE TERMINAL, away from the anchor. Keep the loop visibly separate from the product. Move the EMPTY CENTRE of the fabric loop beyond the free terminal so that terminal passes completely through the loop opening using only clear air. Then lower the loop along the exposed support until it rests on the bounded load-bearing destination. Release every finger only after supported contact, withdraw the empty hand upward, and keep the same fabric loop visibly hanging there through the final frame. The anchor and any visually similar circular hinge or connector are forbidden contact regions.`
    : 'Begin with the prop held in clear air ABOVE the exposed support/contact. Align the prop with that visible support, then lower it vertically from above until it is supported. Do not cross the product body, wall, backing plate or another solid part.'
  const route = path.entry === 'top-down'
    ? path.accessKind === 'exposed'
      ? exposedLoopRoute
      : 'Begin with the prop held ABOVE the highest rim of the selected open top. First align the entire prop over the empty top opening, clear of every rim and upright bar. Only then lower it vertically from above. Do not approach through the front, side walls, bars or the tray underneath.'
    : path.entry === 'front-in'
      ? 'Begin in the clear air in FRONT of the visible open face, holding the prop above the destination floor. Align with that open face, move horizontally through its empty aperture without crossing the surrounding frame, then lower gently onto the floor. Do not descend through a roof or upper shelf.'
      : path.entry === 'left-in' || path.entry === 'right-in'
        ? `Begin in clear air on the ${path.entry === 'left-in' ? 'LEFT' : 'RIGHT'} of the visible open side, above the destination floor. Align with that open side, enter horizontally through its empty aperture, then lower onto the floor. Do not cross a side panel, bar or upper shelf.`
        : 'Approach the existing grip only through the observed clear space. Close the fingers around the visible contact before moving the product. Maintain that same rigid grip and original facing direction throughout the lift.'
  // The generic action supplies the prop/contact. Geometry instructions come
  // first, so a vague "beside the product" staging cannot override top access.
  const prop = action.demonstrationProp
  const destination = path.destination ? ` The final support is the existing ${path.destination.text} at ${location(path.destination.focus)}; stop on that exact physical part, not a nearby hinge, mounting plate, connector or backing surface.` : ''
  const opening = placement && path.accessKind === 'enclosed' && path.opening ? ` The entry opening is at ${location(path.opening.focus)}; these bounds identify an opening, not permission to cross a solid foreground part.` : ''
  const staged = placement
    ? `Use ${prop || 'one small plain lightweight prop'}, sized smaller than the actual opening with room for the gripping fingers. ${route}${opening}${destination} From 0.5–2 seconds align in clear air; from 2–4.5 seconds enter and lower; from 4.5–5.5 seconds make supported contact and release all fingers; from 5.5–6.5 seconds withdraw the empty hand back along the SAME clear route, upward for top entry. End with the prop resting on the support. The prop is a demonstration object, not an included accessory.`
    : pickPlace
      ? `${route} One adult hand grips only the ${action.gripDescription || 'visible grip'}. Lift the same separate product a few centimetres, carry it through the observed clear space to the visible destination without rotating or changing its facing direction, then lower it gently until the actual surface supports its weight.${destination} Only AFTER supported contact, open the fingers and withdraw the empty hand. Do not invent a new work surface or separate a stack. Do not cut, pour, activate or expose hidden faces.`
      : `${route} ${action.action}`
  return {ready: true, path, action: {...action, label: `${action.label} · ${physicalEntryLabel(path.entry)}`, action: `${staged} Treat the product, prop and hand as solid objects with continuous trajectories. No interpenetration, clipping, teleporting, melting, disappearing, extra fingers, unsupported release, bouncing or passing through a floor, tray, rim, wall or bar. Keep all original supports and components fixed. If the route does not fit, stop outside rather than force entry or redesign the product. No performance test.`}}
}
