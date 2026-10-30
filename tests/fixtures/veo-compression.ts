import {interactionPlanSchema, type InteractionPlan} from '../../src/lib/video/veo-interaction-plan'

/** Structured fixture plans, not claims of live image analysis. */
export function compressionFixture(kind: 'wall-hook' | 'cable-organizer' | 'car-phone-holder', inProgress = false): InteractionPlan {
  const cases = {
    'wall-hook': {
      productType: 'wall hook', intendedUse: 'hanging a small towel', action: 'attach',
      prop: {name: 'small hand towel with a sewn hanging loop', reason: 'A familiar lightweight item suitable for the visible hook.'},
      interactionTarget: 'curved hook', primaryAction: 'The hand gently lowers the towel loop over the rounded hook tip.',
      contactBehavior: 'The loop settles on the curved support before the fingers let go.',
      start: 'A mounted hook is visible on an indoor wall; the hook is empty.',
      active: 'A hand holds a small towel loop just above the rounded tip of the mounted hook.',
      endState: 'The towel hangs from the hook as the empty hand withdraws.',
      payoffState: 'The loop rests on the curved support with the mounting base unobstructed.',
      setting: 'ordinary indoor wall', angle: 'front three-quarter view', protectedParts: ['the mounting base'],
    },
    'cable-organizer': {
      productType: 'cable organizer', intendedUse: 'holding a cable in an open slot', action: 'insert',
      prop: {name: 'charging cable', reason: 'Its width fits the visible open slot.'},
      interactionTarget: 'open cable slot', primaryAction: 'The hand guides the cable into the open slot with one gentle press.',
      contactBehavior: 'The fingers release once the cable rests inside the slot.',
      start: 'An organizer is mounted on a desk with one empty open slot.',
      active: 'A hand holds a charging cable at the opening of the organizer slot.',
      endState: 'The cable rests in the slot after the hand withdraws.',
      payoffState: 'The cable end remains accessible beside the desk edge.',
      setting: 'everyday desk', angle: 'close front three-quarter view', protectedParts: ['the mounted base'],
    },
    'car-phone-holder': {
      productType: 'car phone holder', intendedUse: 'supporting a phone in the visible cradle', action: 'insert',
      prop: {name: 'unbranded smartphone', reason: 'A familiar object sized for the visible cradle.'},
      interactionTarget: 'open phone cradle', primaryAction: 'The hand gently seats the phone in the open cradle.',
      contactBehavior: 'The fingers let go only when the cradle visibly supports the phone.',
      start: 'An empty phone holder is mounted inside a parked car.',
      active: 'A hand holds a phone partly seated in the mounted cradle.',
      endState: 'The phone stays in the cradle after the empty hand withdraws.',
      payoffState: 'The phone face is visible at the supported viewing angle.',
      setting: 'parked car interior', angle: 'passenger-side three-quarter view', protectedParts: ['the dashboard mount'],
    },
  }[kind]
  const raw = interactionPlanSchema.parse({
    confidence: 0.95, productType: cases.productType, intendedUse: cases.intendedUse,
    interactionMode: 'functional-demo', bodyPart: 'hand', bodyPartAlreadyVisible: inProgress,
    prop: cases.prop, propAlreadyVisible: inProgress, interactionAlreadyStarted: inProgress, interactionAlreadyInProgress: inProgress,
    productMovement: 'fixed', propMovement: 'movable', contextObjectMovement: [], confirmedProperties: [],
    startState: inProgress ? cases.active : cases.start,
    bodyPartState: inProgress ? 'The visible hand already grips the prop near the interaction point.' : 'The hand begins outside the frame.',
    action: cases.action, interactionTarget: cases.interactionTarget, primaryAction: cases.primaryAction,
    microMotions: [], contactBehavior: cases.contactBehavior, releaseBehavior: 'release', withdrawalBehavior: 'withdraw',
    endStateMode: 'prop-remains-attached', endState: cases.endState, payoffState: cases.payoffState,
    protectedParts: cases.protectedParts, criticalProtectedPart: null, sellingValue: cases.intendedUse,
    camera: {framing: kind === 'cable-organizer' ? 'close-up' : 'medium-close-up', angle: cases.angle},
    environment: {setting: cases.setting, background: 'Preserve the visible everyday surroundings.', preserveReferenceContext: true},
  })
  return {...raw, prop: raw.prop || undefined}
}
