import {z} from 'zod'
import type {VidsPhysicalPath} from './vids-physical-path'

const cleanText = z.string().trim().min(3).max(280).regex(/^[^<>\r\n]+$/)
const shortText = z.string().trim().min(2).max(120).regex(/^[^<>\r\n]+$/)

export const endStateModes = [
  'product-remains-in-use', 'prop-remains-attached', 'product-remains-held', 'body-part-withdraws',
  'body-part-remains', 'product-returned', 'interaction-stops', 'result-only',
] as const

export const interactionPlanSchema = z.object({
  confidence: z.number().min(0).max(1),
  productType: shortText,
  intendedUse: cleanText,
  interactionMode: z.enum(['functional-demo', 'showcase']),
  bodyPart: z.enum(['hand', 'finger', 'two-hands', 'foot', 'leg', 'arm', 'none']),
  bodyPartAlreadyVisible: z.boolean(),
  prop: z.object({name: shortText, reason: cleanText}).nullable(),
  propAlreadyVisible: z.boolean(),
  interactionAlreadyStarted: z.boolean(),
  interactionAlreadyInProgress: z.boolean().optional(),
  productMovement: z.enum(['fixed', 'movable', 'held']),
  propMovement: z.enum(['fixed', 'movable', 'held', 'not-applicable']).default('not-applicable'),
  contextObjectMovement: z.array(z.object({name: shortText, movement: z.enum(['fixed', 'movable'])}).strict()).max(4).default([]),
  confirmedProperties: z.array(shortText).max(12).default([]),
  startState: cleanText,
  bodyPartState: cleanText,
  action: z.enum(['insert', 'place', 'press', 'open', 'close', 'attach', 'remove', 'wipe', 'scrub', 'pour', 'dispense', 'step', 'pick-up', 'rotate', 'touch']),
  interactionTarget: shortText,
  primaryAction: cleanText,
  microMotions: z.array(cleanText).max(3),
  contactBehavior: cleanText,
  releaseBehavior: z.enum(['release', 'do-not-release', 'not-applicable']),
  withdrawalBehavior: z.enum(['withdraw', 'partially-withdraw', 'remain', 'not-applicable']),
  endStateMode: z.enum(endStateModes),
  endState: cleanText,
  payoffState: cleanText,
  protectedParts: z.array(shortText).max(4),
  criticalProtectedPart: shortText.nullable().default(null),
  sellingValue: cleanText,
  camera: z.object({
    framing: z.enum(['close-up', 'medium-close-up', 'medium-shot', 'wide-shot']),
    angle: shortText,
  }).strict(),
  environment: z.object({
    setting: shortText,
    background: cleanText,
    preserveReferenceContext: z.boolean(),
  }).strict(),
}).strict()

export interface InteractionPlan extends Omit<z.infer<typeof interactionPlanSchema>, 'prop'> {
  prop?: {name: string; reason: string}
}

export const interactionScoresSchema = z.object({
  clarity: z.number().min(0).max(10),
  sellingValue: z.number().min(0).max(10),
  visualInterest: z.number().min(0).max(10),
  veoReliability: z.number().min(0).max(10),
}).strict()
export type InteractionScores = z.infer<typeof interactionScoresSchema>

export interface InteractionCandidate {
  plan: InteractionPlan
  scores: InteractionScores
}

export interface InteractionPlanValidation {
  valid: boolean
  issues: string[]
}

export const interactionPlanJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    confidence: {type: 'number', minimum: 0, maximum: 1},
    productType: {type: 'string'}, intendedUse: {type: 'string'},
    interactionMode: {type: 'string', enum: ['functional-demo', 'showcase']},
    bodyPart: {type: 'string', enum: ['hand', 'finger', 'two-hands', 'foot', 'leg', 'arm', 'none']},
    bodyPartAlreadyVisible: {type: 'boolean'},
    prop: {type: 'object', additionalProperties: false, properties: {name: {type: 'string'}, reason: {type: 'string'}}, required: ['name', 'reason']},
    propAlreadyVisible: {type: 'boolean'}, interactionAlreadyStarted: {type: 'boolean'},
    interactionAlreadyInProgress: {type: 'boolean'},
    productMovement: {type: 'string', enum: ['fixed', 'movable', 'held']},
    propMovement: {type: 'string', enum: ['fixed', 'movable', 'held', 'not-applicable']},
    contextObjectMovement: {type: 'array', maxItems: 4, items: {type: 'object', additionalProperties: false, properties: {name: {type: 'string'}, movement: {type: 'string', enum: ['fixed', 'movable']}}, required: ['name', 'movement']}},
    confirmedProperties: {type: 'array', maxItems: 12, items: {type: 'string'}},
    startState: {type: 'string'}, bodyPartState: {type: 'string'},
    action: {type: 'string', enum: ['insert', 'place', 'press', 'open', 'close', 'attach', 'remove', 'wipe', 'scrub', 'pour', 'dispense', 'step', 'pick-up', 'rotate', 'touch']},
    interactionTarget: {type: 'string'}, primaryAction: {type: 'string'},
    microMotions: {type: 'array', maxItems: 3, items: {type: 'string'}}, contactBehavior: {type: 'string'},
    releaseBehavior: {type: 'string', enum: ['release', 'do-not-release', 'not-applicable']},
    withdrawalBehavior: {type: 'string', enum: ['withdraw', 'partially-withdraw', 'remain', 'not-applicable']},
    endStateMode: {type: 'string', enum: [...endStateModes]}, endState: {type: 'string'}, payoffState: {type: 'string'},
    protectedParts: {type: 'array', maxItems: 4, items: {type: 'string'}}, criticalProtectedPart: {type: 'string'},
    sellingValue: {type: 'string'},
    camera: {type: 'object', additionalProperties: false, properties: {framing: {type: 'string', enum: ['close-up', 'medium-close-up', 'medium-shot', 'wide-shot']}, angle: {type: 'string'}}, required: ['framing', 'angle']},
    environment: {type: 'object', additionalProperties: false, properties: {setting: {type: 'string'}, background: {type: 'string'}, preserveReferenceContext: {type: 'boolean'}}, required: ['setting', 'background', 'preserveReferenceContext']},
  },
  required: [
    'confidence', 'productType', 'intendedUse', 'interactionMode', 'bodyPart', 'bodyPartAlreadyVisible', 'prop',
    'propAlreadyVisible', 'interactionAlreadyStarted', 'interactionAlreadyInProgress', 'productMovement', 'propMovement', 'contextObjectMovement', 'confirmedProperties', 'startState', 'bodyPartState', 'action',
    'interactionTarget', 'primaryAction', 'microMotions', 'contactBehavior', 'releaseBehavior', 'withdrawalBehavior',
    'endStateMode', 'endState', 'payoffState', 'protectedParts', 'criticalProtectedPart', 'sellingValue', 'camera', 'environment',
  ],
}

export const interactionScoresJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: Object.fromEntries(['clarity', 'sellingValue', 'visualInterest', 'veoReliability'].map(key => [key, {type: 'number', minimum: 0, maximum: 10}])),
  required: ['clarity', 'sellingValue', 'visualInterest', 'veoReliability'],
}

const candidateTotal = ({scores}: InteractionCandidate) => scores.clarity + scores.sellingValue + scores.visualInterest + scores.veoReliability * 1.25

/** Reject contradictions before a task can consume Veo quota. */
export function validateInteractionPlan(plan: InteractionPlan): InteractionPlanValidation {
  const issues: string[] = []
  const combinedStart = `${plan.startState} ${plan.bodyPartState}`
  const combinedAction = `${plan.primaryAction} ${plan.contactBehavior} ${plan.microMotions.join(' ')}`
  const combinedEnd = `${plan.endState} ${plan.payoffState}`
  if (plan.interactionAlreadyInProgress !== undefined && plan.interactionAlreadyInProgress !== plan.interactionAlreadyStarted) issues.push('IN_PROGRESS_STATE_CONTRADICTION')
  if (plan.interactionMode === 'functional-demo' && plan.confidence < 0.75) issues.push('FUNCTION_UNCERTAIN')
  if (plan.bodyPartAlreadyVisible && /\benter(?:s|ing|ed)?\b/iu.test(`${combinedStart} ${combinedAction}`)) issues.push('VISIBLE_BODY_PART_CANNOT_ENTER_AGAIN')
  if (!plan.bodyPartAlreadyVisible && plan.interactionAlreadyStarted) issues.push('START_STATE_CONTRADICTION')
  if (plan.productMovement === 'held' && !plan.bodyPartAlreadyVisible) issues.push('HELD_PRODUCT_REQUIRES_VISIBLE_BODY_PART')
  if (plan.propAlreadyVisible && !plan.prop) issues.push('VISIBLE_PROP_MISSING')
  if (plan.propAlreadyVisible && /\b(?:introduce[sd]?|brings? in|enters? (?:with|holding))\b/iu.test(combinedAction)) issues.push('VISIBLE_PROP_CANNOT_ENTER_AGAIN')
  if (plan.releaseBehavior === 'release' && plan.endStateMode === 'product-remains-held') issues.push('RELEASE_HELD_CONTRADICTION')
  if (plan.releaseBehavior === 'do-not-release' && /\b(?:release[sd]?|let(?:s)? go|place[sd]? (?:it|the product) down)\b/iu.test(`${combinedAction} ${combinedEnd}`)) issues.push('DO_NOT_RELEASE_CONTRADICTION')
  if (plan.withdrawalBehavior === 'withdraw' && ['body-part-remains', 'product-remains-held', 'product-remains-in-use'].includes(plan.endStateMode)) issues.push('WITHDRAWAL_END_STATE_CONTRADICTION')
  if (plan.withdrawalBehavior === 'remain' && /\b(?:withdraw[sd]?|leaves? (?:the )?frame|out of frame)\b/iu.test(combinedEnd)) issues.push('REMAIN_WITHDRAWAL_CONTRADICTION')
  if (plan.endStateMode === 'product-remains-held' && plan.releaseBehavior !== 'do-not-release') issues.push('HELD_PRODUCT_MUST_NOT_RELEASE')
  if (plan.endStateMode === 'prop-remains-attached' && !plan.prop) issues.push('ATTACHED_PROP_MISSING')
  if (plan.endStateMode !== 'product-returned' && /\b(?:put|place|return)(?:s|ed|ing)?\b.{0,35}\b(?:counter|table|original position|down)\b/iu.test(combinedEnd)) issues.push('UNPLANNED_FINAL_ACTION')
  if (plan.bodyPart === 'none' && plan.withdrawalBehavior !== 'not-applicable') issues.push('BODY_PART_NONE_WITH_WITHDRAWAL')
  if (/\b(?:spotless|thoroughly cleaned|free of (?:dirt|grease|residue|stains?)|guaranteed|instantly|effortlessly)\b/iu.test(`${combinedAction} ${combinedEnd}`)) issues.push('UNSUPPORTED_RESULT_CLAIM')
  if (!plan.primaryAction.trim() || !plan.payoffState.trim()) issues.push('MISSING_ACTION_OR_PAYOFF')
  return {valid: issues.length === 0, issues}
}

/** Deterministic selection keeps a visually interesting but unreliable action from winning. */
export function selectInteractionCandidate(candidates: InteractionCandidate[]): InteractionCandidate {
  if (candidates.length < 2 || candidates.length > 4) throw new Error('INVALID_INTERACTION_CANDIDATES')
  const valid = candidates.filter(candidate => validateInteractionPlan(candidate.plan).valid)
  const sorted = [...(valid.length ? valid : candidates)].sort((a, b) => candidateTotal(b) - candidateTotal(a))
  const selected = sorted[0]
  if (selected.plan.confidence >= 0.75 && validateInteractionPlan(selected.plan).valid) return selected
  const fixed = selected.plan.productMovement === 'fixed'
  return {
    scores: {...selected.scores, sellingValue: Math.min(selected.scores.sellingValue, 5)},
    plan: {
      ...selected.plan,
      interactionMode: 'showcase', bodyPart: fixed ? 'finger' : 'hand', prop: undefined, propAlreadyVisible: false,
      interactionAlreadyStarted: false, action: fixed ? 'touch' : 'pick-up',
      primaryAction: fixed
        ? `The same finger gently touches only ${selected.plan.interactionTarget} and pauses briefly.`
        : 'The hand naturally picks up the product from its clearly visible outer body and holds the same visible face steady for inspection.',
      microMotions: [],
      contactBehavior: fixed ? 'Use one light fingertip contact without moving the product.' : 'Use a comfortable grip on the visible outer body without exposing hidden faces.',
      releaseBehavior: fixed ? 'not-applicable' : 'do-not-release', withdrawalBehavior: fixed ? 'withdraw' : 'remain',
      endStateMode: fixed ? 'body-part-withdraws' : 'product-remains-held',
      endState: fixed ? 'The unchanged product remains in its original position after the finger withdraws.' : 'The same unchanged product remains held steadily with its original visible face toward the camera.',
      payoffState: 'The visible product construction remains clear without implying an uncertain function.',
      sellingValue: 'Show the visible product clearly without claiming or inventing an uncertain function.',
    },
  }
}

const actor = (bodyPart: InteractionPlan['bodyPart']) => ({
  hand: 'one natural adult hand', finger: 'one natural adult hand using one finger', 'two-hands': 'two natural adult hands',
  foot: 'one naturally moving foot', leg: 'one naturally moving lower leg', arm: 'one natural adult arm', none: 'no person',
})[bodyPart]
const sentence = (value: string) => {
  const capitalized = value.replace(/^./u, first => first.toUpperCase())
  return /[.!?]$/u.test(capitalized) ? capitalized : `${capitalized}.`
}

const propertyWords = /\b(?:abrasive|absorbent|antibacterial|antimicrobial|non[- ]scratch|scratch[- ]proof|waterproof|rustproof|heat[- ]resistant|stainless steel|silicone|ceramic|leather)\b/giu
const claimWords = /\b(?:spotless|thoroughly cleaned|free of (?:dirt|grease|residue|stains?)|guaranteed|instantly|effortlessly|efficient(?:ly)?|effective(?:ly)?)\b/iu
const ongoing = (plan: InteractionPlan) => plan.interactionAlreadyInProgress ?? plan.interactionAlreadyStarted

/** Facts beyond visible appearance require caller-supplied product information. */
export function visualOnlyText(text: string, confirmedProperties: string[] = []): string {
  return text.replace(propertyWords, value => confirmedProperties.some(property => property.toLowerCase() === value.toLowerCase()) ? value : '')
    .replace(/\bcleaning (?:the|a|an)\b/giu, 'scrubbing the')
    .replace(/\s{2,}/gu, ' ').replace(/\s+([,.])/gu, '$1').trim()
}

const instructionKey = (text: string) => text.toLowerCase().replace(/\b(?:the|a|an|same|naturally|gently)\b/gu, '').replace(/[^a-z0-9 ]/gu, '').replace(/\s+/gu, ' ').trim()
const uniqueSentences = (texts: string[]) => {
  const seen: string[][] = []
  return texts.flatMap(text => text.split(/(?<=[.!?])\s+/u)).filter(Boolean).filter(text => {
    const tokens = instructionKey(text).split(' ').filter(Boolean)
    const duplicate = seen.some(previous => {
      const shared = tokens.filter(token => previous.includes(token)).length
      return shared / Math.max(tokens.length, previous.length) >= 0.8
    })
    if (!duplicate) seen.push(tokens)
    return !duplicate
  }).map(sentence).join(' ')
}

/** Wording only: retain every object, action and physical ending in the plan. */
export function polishVeoDirection(text: string): string {
  const gerunds: Record<string, string> = {
    scrubbing: 'Scrub', wiping: 'Wipe', inserting: 'Insert', placing: 'Place', pressing: 'Press',
    opening: 'Open', closing: 'Close', attaching: 'Attach', removing: 'Remove', pouring: 'Pour',
    dispensing: 'Dispense', stepping: 'Step', rotating: 'Rotate', touching: 'Touch', holding: 'Hold',
  }
  return text.trim()
    .replace(/^([A-Za-z]+)\b(?!\s+(?:remains?|is|are|stays?|must)\b)/u, word => gerunds[word.toLowerCase()] || word)
    .replace(/^Slight circular pivoting of (.+?)[.!]?$/iu, 'Move $1 in small circles.')
    .replace(/^Gentle (.+?) pressure adjustment[.!]?$/iu, 'Gently adjust the $1 pressure.')
    .replace(/^The hand holds (.+?) after (?:scrubbing|wiping|pressing|pouring)[.!]?$/iu, 'Keep holding $1 as the motion settles.')
    .replace(/^The (.+?) remains naturally held near (.+?) after the motion stops[.!]?$/iu, 'As the motion stops, keep the $1 held near $2.')
}

export function validatePromptQuality(prompt: string, plan: InteractionPlan): InteractionPlanValidation {
  const issues = [...validateInteractionPlan(plan).issues]
  const instructions = prompt.split(/\n|(?<=[.!?])\s+/u).filter(line => /[a-z]/u.test(line))
  const keys = instructions.map(instructionKey)
  if (new Set(keys).size !== keys.length) issues.push('DUPLICATE_INSTRUCTION')
  const visibilityRules = instructions.filter(line => /(?:keep|frame|ensure|protect).*(?:interaction|contact) point.*(?:visible|unobstructed)|protect visibility of the interaction/iu.test(line))
  if (visibilityRules.length > 1) issues.push('DUPLICATE_INSTRUCTION')
  const unverified = [...prompt.matchAll(propertyWords)].filter(match => !(plan.confirmedProperties || []).some(property => property.toLowerCase() === match[0].toLowerCase()))
  if (unverified.length) issues.push('UNVERIFIED_PROPERTY')
  if (claimWords.test(prompt)) issues.push('PERFORMANCE_CLAIM')
  if (/until the planned action moves it|End-state mode:|Natural micro-motions within|viewer should immediately understand|Contact behavior:/iu.test(prompt)) issues.push('GENERIC_BOILERPLATE')
  if (ongoing(plan) && /\bestablish\b|\bapproach(?:es|ing)?\b|\benters?\b/iu.test(prompt)) issues.push('ONGOING_INTERACTION_RESET')
  if (ongoing(plan) && !/0–0\.5s/iu.test(prompt)) issues.push('INCORRECT_TIMING')
  const payoffSection = prompt.split('\nPAYOFF\n')[1]?.split('\nNEGATIVE CONSTRAINTS')[0] || ''
  if (plan.endStateMode !== 'product-returned' && /\b(?:put|place|return)(?:s|ed|ing)?\b.{0,35}\b(?:counter|table|original position|down)\b/iu.test(payoffSection)) issues.push('UNPLANNED_FINAL_ACTION')
  if (plan.withdrawalBehavior === 'remain' && /\bwithdraw(?:s|ing)?\b/iu.test(payoffSection)) issues.push('WITHDRAWAL_END_STATE_CONTRADICTION')
  const fixedObjects = [
    ...(plan.productMovement === 'fixed' ? [plan.productType] : []),
    ...(plan.prop && plan.propMovement === 'fixed' ? [plan.prop.name] : []),
    ...(plan.contextObjectMovement || []).filter(object => object.movement === 'fixed').map(object => object.name),
  ]
  for (const name of fixedObjects) {
    const normalizedName = visualOnlyText(name, plan.confirmedProperties)
    const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    if (new RegExp(`(?:move|lift|rotate|detach|tilt|slide)\\s+(?:the\\s+)?${escaped}\\b`, 'iu').test(prompt)) issues.push('FIXED_OBJECT_MOVEMENT')
  }
  return {valid: issues.length === 0, issues: [...new Set(issues)]}
}

/** Compress the plan into directing prose; geometry and internal reasoning stay internal. */
export function buildVeoInteractionPrompt(plan: InteractionPlan, path?: VidsPhysicalPath): string {
  // Geometry is validated by the planner; it is deliberately not narrated.
  void path
  const validation = validateInteractionPlan(plan)
  if (!validation.valid) throw new Error(`INVALID_INTERACTION_PLAN:${validation.issues.join(',')}`)
  const clean = (text: string) => visualOnlyText(text, plan.confirmedProperties)
  const inProgress = ongoing(plan)
  const continuity = uniqueSentences([
    inProgress ? 'Continue the existing motion naturally from the reference frame.' : 'Begin from the supplied reference image as the first frame.',
    clean(plan.startState),
  ])
  const fixedObjects = [
    ...(plan.productMovement === 'fixed' ? [plan.productType] : []),
    ...(plan.prop && plan.propMovement === 'fixed' ? [plan.prop.name] : []),
    ...(plan.contextObjectMovement || []).filter(object => object.movement === 'fixed').map(object => object.name),
  ].map(clean).filter((name, index, all) => all.findIndex(other => instructionKey(other) === instructionKey(name)) === index)
  const movement = fixedObjects.map(name => `Keep ${/^(?:the|a|an|one)\b/iu.test(name) ? name : `the ${name}`} stationary throughout the shot.`).join(' ')
  const context = plan.environment.preserveReferenceContext
    ? `Retain the reference setting (${clean(plan.environment.setting)}); extend the background only as needed for the vertical frame.`
    : `Use ${clean(plan.environment.setting)} with a simple background.`
  const timing = inProgress
    ? '0–0.5s: continue directly from the reference motion. 0.5–5.5s: continue the primary interaction. 5.5–8s: gradually settle into the payoff.'
    : '0–1.5s: establish the reference scene. 1.5–5.5s: perform the primary interaction. 5.5–8s: settle into the payoff.'
  // Omit evaluation prose that re-explains the action or restarts a settled motion.
  const payoff = /\b(?:demonstrates?|showcases?|highlights?|illustrates?)\b/iu.test(plan.payoffState) ? '' : clean(plan.payoffState)
  const endText = uniqueSentences([polishVeoDirection(clean(plan.endState)), polishVeoDirection(payoff)])
  const withdraw = plan.withdrawalBehavior === 'withdraw' && !/\bwithdraw|out of frame|leaves?\b/iu.test(endText) ? 'The body part withdraws after the action.' : ''
  const release = plan.releaseBehavior === 'release' && !/\brelease|lets? go\b/iu.test(`${plan.primaryAction} ${plan.contactBehavior} ${endText}`) ? 'Release only after the object is visibly supported.' : ''
  const protectedNames = [...new Set([...(plan.criticalProtectedPart ? [plan.criticalProtectedPart] : []), ...plan.protectedParts])].slice(0, 2)
  const protection = protectedNames.length ? `Do not move or detach ${protectedNames.map(clean).join(' or ')}.` : ''
  const prompt = `GLOBAL FIDELITY
Match the reference product identity, shape, proportions, colors, surface appearance, visible components, count, mounting, orientation and existing markings exactly.

REFERENCE CONTINUITY
${continuity}

CAMERA / CONTEXT
One continuous realistic 8-second vertical 9:16 shot. Stable ${plan.camera.framing}, ${clean(plan.camera.angle)}; frame the full product and ${actor(plan.bodyPart)} with the contact point unobstructed. ${context}
${movement}

PRIMARY ACTION
${uniqueSentences([clean(plan.primaryAction), ...plan.microMotions.map(clean), clean(plan.contactBehavior), release].map(polishVeoDirection))}
${timing}

PAYOFF
${uniqueSentences([endText, withdraw])} Hold this final state for the last 1–2 seconds.

NEGATIVE CONSTRAINTS
No redesign, added parts, invented functions, clipping, floating, teleportation, extra fingers, text overlays, new logos, watermarks, cuts, artificial zoom or unsupported performance claims. ${protection}`.replace(/\n{3,}/gu, '\n\n').trim()
  const quality = validatePromptQuality(prompt, plan)
  if (!quality.valid) throw new Error(`INVALID_PROMPT_QUALITY:${quality.issues.join(',')}`)
  return prompt
}
