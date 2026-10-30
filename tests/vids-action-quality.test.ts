import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile, unlink} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {getFfmpegBinaryPath} from '../src/lib/video/ffmpeg'
import {readImageInsights} from '../src/lib/ai/gemini'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {hasPurposefulVidsAction, planProductInteraction} from '../src/lib/video/vids-interaction'
import {planVidsShots} from '../src/lib/video/vids-plan'
import {cleanVidsFrame} from '../src/lib/video/vids-clean-frame'
import {prepareVidsMotion} from '../src/lib/ai/vids-motion-plan'
import {saveVidsVideo, clipFilePath, VIDS_CACHE_DIR} from '../src/lib/video/vids-store'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import type {ProductInput} from '../src/engines/core/types'
import type {ImageInsight, ImageInteraction} from '../src/engines/planning/types'
import {constrainPhysicalPath, VIDS_MOTION_VERSION, type VidsPhysicalPath} from '../src/lib/video/vids-physical-path'
import {handsDemoPrompt} from '../src/lib/video/vids-interaction'
import {parseVidsFidelityReport, canApproveVidsClip} from '../src/lib/video/vids-fidelity'
import {vidsPhysicsReviewTimes} from '../src/lib/video/vids-review'
import {reviewVidsFidelity} from '../src/lib/ai/vids-fidelity-review'
import {createHash} from 'node:crypto'
import {buildVeoInteractionPrompt, selectInteractionCandidate, validateInteractionPlan, type InteractionCandidate} from '../src/lib/video/veo-interaction-plan'

const product: ProductInput = {id: 'r', name: 'Sản phẩm đặt đồ', category: 'home', assets: ['loaded', 'empty', 'screenshot'].map(id => ({id, type: 'PRODUCT_IMAGE', url: `/${id}.jpg`}))}
const evidence: ImageInteraction = {action: 'place', targetDetail: 1, contact: 'surface', mobility: 'fixed', arrangement: 'separate', confidence: 'high', prop: 'sponge', restingPose: 'upright', supportState: 'empty', access: 'clear', supportUse: 'storage'}
const empty: ImageInsight = {assetId: 'empty', role: 'primary', source: 'vision', quality: 'clean', usageSpace: 'empty-support', details: [{text: 'Khoang chứa có đáy nan và miệng mở', focus: {x: 10, y: 20, width: 80, height: 50}}], interaction: evidence}
const physicalPath: VidsPhysicalPath = {entry: 'top-down', accessKind: 'enclosed', clearance: 'clear', fit: 'fits', opening: {text: 'open upper aperture', focus: {x: 15, y: 10, width: 70, height: 20}}, destination: {text: 'visible storage floor', focus: {x: 20, y: 40, width: 60, height: 20}}, freeEnd: null, anchor: null}

test('Interaction candidates prioritize reliable selling value and low confidence becomes a safe showcase', () => {
  const base = {confidence: 0.9, productType: 'cable organizer', intendedUse: 'keep one charging cable in a visible open slot', interactionMode: 'functional-demo' as const, bodyPart: 'hand' as const, bodyPartAlreadyVisible: false, prop: {name: 'one plain charging cable', reason: 'The cable visibly fits the open slot.'}, propAlreadyVisible: false, interactionAlreadyStarted: false, action: 'insert' as const, interactionTarget: 'one visible open cable slot', primaryAction: 'A hand guides one charging cable naturally into the visible open slot and gently seats it in place.', microMotions: [], contactBehavior: 'The fingers keep a light grip until the cable is visibly seated.', releaseBehavior: 'release' as const, withdrawalBehavior: 'withdraw' as const, endStateMode: 'prop-remains-attached' as const, startState: 'The slot is empty and no hand or cable is visible yet.', bodyPartState: 'The hand begins outside the frame.', endState: 'The cable remains neatly seated after the hand withdraws.', payoffState: 'The same cable remains visibly organized in the slot.', protectedParts: ['the mounting base'], criticalProtectedPart: null, productMovement: 'fixed' as const, sellingValue: 'Show that the cable remains organized in the visible slot.', camera: {framing: 'medium-close-up' as const, angle: 'a natural front product-demo angle'}, environment: {setting: 'a clean everyday desk setting', background: 'Keep the desk simple and secondary to the organizer.', preserveReferenceContext: true}}
  const candidates: InteractionCandidate[] = [
    {plan: {...base, propMovement: 'movable', contextObjectMovement: [], confirmedProperties: [], primaryAction: 'A hand performs an ambitious complex cable movement.'}, scores: {clarity: 9, sellingValue: 10, visualInterest: 10, veoReliability: 2}},
    {plan: {...base, propMovement: 'movable', contextObjectMovement: [], confirmedProperties: []}, scores: {clarity: 9, sellingValue: 9, visualInterest: 7, veoReliability: 9}},
  ]
  const chosen = selectInteractionCandidate(candidates)
  assert.equal(chosen.plan.primaryAction, base.primaryAction)
  const prompt = buildVeoInteractionPrompt(chosen.plan, physicalPath)
  assert.match(prompt, /visible open slot/)
  assert.match(prompt, /CAMERA \/ CONTEXT/)
  assert.match(prompt, /REFERENCE CONTINUITY/)
  assert.match(prompt, /PAYOFF/)
  assert.match(prompt, /0–1\.5s/)
  assert.match(prompt, /1\.5–5\.5s/)
  assert.match(prompt, /5\.5–8s/)
  assert.doesNotMatch(prompt, /fixed anchor|free terminal|load-bearing destination|verified clear path|x=\d/iu)
  assert.doesNotMatch(prompt, /Do not touch, move or modify the mounting base|neighboring slots/iu)

  const fallback = selectInteractionCandidate(candidates.map((candidate, index) => ({...candidate, plan: {...candidate.plan, confidence: 0.6}, scores: {...candidate.scores, veoReliability: 8 - index}})))
  assert.equal(fallback.plan.interactionMode, 'showcase')
  assert.equal(fallback.plan.action, 'touch')
  assert.equal(fallback.plan.prop, undefined)
  assert.doesNotMatch(fallback.plan.primaryAction, /insert|charging cable/iu)
})

test('Prompt builder adapts camera, environment, body part and natural prop across its six compressed sections', () => {
  const carPlan = {
    propMovement: 'movable' as const, contextObjectMovement: [], confirmedProperties: [],
    confidence: 0.93, productType: 'car phone holder', intendedUse: 'hold a phone at a visible viewing position inside a car', interactionMode: 'functional-demo' as const,
    bodyPart: 'hand' as const, bodyPartAlreadyVisible: false, prop: {name: 'one plain unbranded smartphone', reason: 'It is the familiar object the visible holder is designed to receive.'}, propAlreadyVisible: false, interactionAlreadyStarted: false, action: 'insert' as const,
    interactionTarget: 'the open phone cradle', primaryAction: 'A natural adult hand brings the phone toward the open cradle and gently seats it until the holder visibly supports it.', microMotions: [], contactBehavior: 'The fingers release only when the phone is visibly supported.', releaseBehavior: 'release' as const, withdrawalBehavior: 'withdraw' as const, endStateMode: 'prop-remains-attached' as const,
    startState: 'The empty holder is fixed in place.', bodyPartState: 'The hand and phone begin outside the frame.', endState: 'The same phone remains seated in the cradle after the empty hand withdraws.', payoffState: 'The phone remains visibly supported at a clear viewing position.',
    protectedParts: ['the dashboard mount'], criticalProtectedPart: 'the dashboard mount', productMovement: 'fixed' as const,
    sellingValue: 'Show the phone resting in a clear viewing position.', camera: {framing: 'medium-close-up' as const, angle: 'a natural passenger-side product-demo angle'},
    environment: {setting: 'a realistic parked car interior', background: 'Keep the dashboard clean, ordinary and secondary to the holder.', preserveReferenceContext: true},
  }
  const prompt = buildVeoInteractionPrompt(carPlan, {...physicalPath, entry: 'front-in', accessKind: 'exposed', opening: null})
  for (const section of ['GLOBAL FIDELITY', 'REFERENCE CONTINUITY', 'CAMERA / CONTEXT', 'PRIMARY ACTION', 'PAYOFF', 'NEGATIVE CONSTRAINTS']) assert.ok(prompt.includes(section))
  assert.match(prompt, /realistic parked car interior/)
  assert.match(prompt, /stable medium-close-up/i)
  assert.match(prompt, /phone/)
  assert.match(prompt, /same phone remains seated/)
  assert.match(prompt, /do not move or detach the dashboard mount/i)
  assert.doesNotMatch(prompt, /adjustment joint|bounded|verified|coordinates|x=\d/iu)
})

test('A held product already in use continues from the first frame without forced entry, release or withdrawal', () => {
  const spongePlan = {
    propMovement: 'fixed' as const, contextObjectMovement: [], confirmedProperties: [],
    confidence: 0.95, productType: 'cleaning sponge', intendedUse: 'washing a ceramic plate', interactionMode: 'functional-demo' as const,
    bodyPart: 'hand' as const, bodyPartAlreadyVisible: true, prop: {name: 'one ceramic plate', reason: 'It is already visible as the cleaning surface.'}, propAlreadyVisible: true, interactionAlreadyStarted: true, action: 'scrub' as const,
    interactionTarget: 'the visible plate surface', primaryAction: 'The same hand makes two short circular scrubbing motions across the visible plate surface.', microMotions: ['Two short circular strokes continue from the existing contact.'], contactBehavior: 'Maintain the same natural grip and continuous sponge-to-plate contact.', releaseBehavior: 'do-not-release' as const, withdrawalBehavior: 'remain' as const, endStateMode: 'product-remains-in-use' as const,
    startState: 'The same hand is already holding the sponge against the plate.', bodyPartState: 'The visible fingers already have a natural grip on the sponge.', endState: 'The scrubbing motion stops while the same hand continues holding the sponge near the plate.', payoffState: 'The sponge, hand and plate remain visible together so the use is immediately clear.',
    protectedParts: [], criticalProtectedPart: null, productMovement: 'held' as const,
    sellingValue: 'Show the clearly visible everyday use of the sponge with a plate.', camera: {framing: 'medium-close-up' as const, angle: 'a natural overhead product-demo angle'},
    environment: {setting: 'a clean everyday kitchen sink', background: 'Keep the existing sink and plate context unchanged.', preserveReferenceContext: true},
  }
  const prompt = buildVeoInteractionPrompt(spongePlan, {...physicalPath, accessKind: 'exposed', opening: null})
  assert.match(prompt, /Continue the existing motion naturally from the reference frame/)
  assert.match(prompt, /two short circular scrubbing motions/)
  assert.match(prompt, /same hand continues holding the sponge/)
  assert.doesNotMatch(prompt, /enters naturally|withdraws naturally|counter beside/)
  assert.equal(validateInteractionPlan(spongePlan).valid, true)
})

test('End-state validator supports product-specific endings and rejects first-frame or payoff contradictions', () => {
  const buttonPlan = {
    propMovement: 'not-applicable' as const, contextObjectMovement: [], confirmedProperties: [],
    confidence: 0.96, productType: 'button device', intendedUse: 'activate the visible button', interactionMode: 'functional-demo' as const,
    bodyPart: 'finger' as const, bodyPartAlreadyVisible: false, prop: undefined, propAlreadyVisible: false, interactionAlreadyStarted: false, productMovement: 'fixed' as const,
    startState: 'The unchanged device and button are visible with no finger in frame.', bodyPartState: 'The finger begins outside the frame.', action: 'press' as const,
    interactionTarget: 'the visible button', primaryAction: 'One finger presses the visible button once.', microMotions: [], contactBehavior: 'Use one brief straight press without moving the device.',
    releaseBehavior: 'not-applicable' as const, withdrawalBehavior: 'withdraw' as const, endStateMode: 'body-part-withdraws' as const,
    endState: 'The finger withdraws and the unchanged device remains visible.', payoffState: 'The button and full device remain clearly visible.',
    protectedParts: [], criticalProtectedPart: null, sellingValue: 'Show the visible button interaction.', camera: {framing: 'close-up' as const, angle: 'a stable front angle'},
    environment: {setting: 'the visible everyday setting', background: 'Preserve the existing background.', preserveReferenceContext: true},
  }
  assert.equal(validateInteractionPlan(buttonPlan).valid, true)
  const prompt = buildVeoInteractionPrompt(buttonPlan, {...physicalPath, entry: 'front-in', accessKind: 'exposed', opening: null})
  assert.match(prompt, /finger withdraws/)
  assert.doesNotMatch(prompt, /Release only|placement action/)

  const visibleEnters = {...buttonPlan, bodyPartAlreadyVisible: true, startState: 'The same finger already touches the button.', primaryAction: 'The finger enters and presses the button.'}
  assert.ok(validateInteractionPlan(visibleEnters).issues.includes('VISIBLE_BODY_PART_CANNOT_ENTER_AGAIN'))
  const forcedPlacement = {...buttonPlan, bodyPart: 'hand' as const, bodyPartAlreadyVisible: true, productMovement: 'held' as const, releaseBehavior: 'do-not-release' as const, withdrawalBehavior: 'remain' as const, endStateMode: 'product-remains-held' as const, endState: 'The hand places the product down on the counter.'}
  assert.ok(validateInteractionPlan(forcedPlacement).issues.includes('DO_NOT_RELEASE_CONTRADICTION'))
  const impossibleWithdrawal = {...buttonPlan, withdrawalBehavior: 'withdraw' as const, endStateMode: 'body-part-remains' as const}
  assert.ok(validateInteractionPlan(impossibleWithdrawal).issues.includes('WITHDRAWAL_END_STATE_CONTRADICTION'))
  const claim = {...buttonPlan, payoffState: 'The surface is instantly spotless and free of residue.'}
  assert.ok(validateInteractionPlan(claim).issues.includes('UNSUPPORTED_RESULT_CLAIM'))
})

test('A clean empty support photo outside the narration scenes can supply the opening action', () => {
  const scenes = planAdaptiveVideo(product).storyboard.scenes.map(scene => ({...scene, renderPlan: {...scene.renderPlan!, assetId: 'loaded', assetIndex: 0}}))
  const snapshot = JSON.stringify(scenes)
  const shot = planVidsShots(product, scenes, [empty])[0]
  assert.equal(shot.assetId, 'empty')
  assert.equal(shot.actionLabel, 'Đặt nhẹ đạo cụ lên mặt đỡ thấy rõ')
  assert.match(shot.prompt, /complete release and withdrawal/)
  assert.doesNotMatch(shot.prompt, /Khoang chứa/)
  assert.equal(JSON.stringify(scenes), snapshot)
})

test('Placement needs empty accessible intended support, never an occupied floor, a drip tray or unknown use', () => {
  assert.equal(planProductInteraction(product, empty).id, 'light-placement')
  assert.equal(hasPurposefulVidsAction('light-placement'), true)
  assert.equal(hasPurposefulVidsAction('functional-demo-insert'), true)
  assert.equal(hasPurposefulVidsAction('showcase-touch'), true)
  assert.equal(hasPurposefulVidsAction('handle-lift'), true)
  assert.equal(hasPurposefulVidsAction('visible-detail'), false)
  assert.equal(hasPurposefulVidsAction('surface-touch'), false)
  for (const change of [{supportState: 'occupied'}, {access: 'blocked'}, {supportUse: 'drainage'}, {supportUse: undefined}]) {
    const invalid = {...empty, interaction: {...evidence, ...change} as ImageInteraction}
    assert.notEqual(planProductInteraction(product, invalid).id, 'light-placement')
  }
})

test('Screen overlays cannot become source images; selected quality and empty support evidence stay canonical', () => {
  const images = product.assets.map(asset => ({assetId: asset.id, dataUrl: 'data:image/jpeg;base64,YWJj'}))
  const insights = readImageInsights({images: [{assetId: 'screenshot', role: 'primary', quality: 'ui-overlay', details: [{text: 'Mặt đỡ màu trắng'}]}, {...empty}]}, images)
  assert.equal(insights.some(i => i.assetId === 'screenshot'), false)
  assert.equal(insights[0].usageSpace, 'empty-support')
  assert.deepEqual(insights[0].interaction, evidence)
})

test('The presentation crop preserves the original, duration and width, caches output and avoids cumulative cropping', async t => {
  const ffmpeg = getFfmpegBinaryPath(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crop-test-')), file = path.join(dir, 'source.mp4')
  execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=160x288:r=12', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file])
  const bytes = await readFile(file), key = randomUUID().replace(/-/g, '').repeat(2)
  const source = await saveVidsVideo(key, bytes)
  const crop = await cleanVidsFrame(key, 12)
  t.after(async () => {fs.rmSync(dir, {recursive: true, force: true}); for (const k of [key, crop.key]) {await unlink(clipFilePath(k)).catch(() => {}); await unlink(path.join(VIDS_CACHE_DIR, `${k}.json`)).catch(() => {})}})
  assert.deepEqual(await readFile(clipFilePath(key)), bytes)
  assert.equal(crop.originalKey, source.key)
  assert.equal(crop.durationSec, source.durationSec)
  assert.equal((await cleanVidsFrame(crop.key, 12)).key, crop.key)
  const info = execFileSync(ffmpeg, ['-hide_banner', '-i', clipFilePath(crop.key), '-f', 'null', '-'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})
  assert.equal(info, '')
  const frame = execFileSync(ffmpeg, ['-v', 'error', '-i', clipFilePath(crop.key), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'])
  assert.equal(frame.readUInt32BE(16), 160)
  assert.equal(frame.readUInt32BE(20), 252)
  await assert.rejects(cleanVidsFrame(key, 90), /INVALID_FRAME_CROP/)
})

test('Motion planning caches canonical geometry, rejects drainage placement, and never generates a video', async t => {
  const original = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY
  const image = 'data:image/png;base64,' + Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.from(randomUUID())]).toString('base64')
  const name = 'Hình thử ' + randomUUID()
  process.env.GEMINI_API_KEY = 'fixture-only'
  let calls = 0
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).includes('generativelanguage.googleapis.com'))
    assert.doesNotMatch(String(url), /appsgenaiserver|4317/)
    calls++
    const body = JSON.parse(String(init?.body))
    if (calls === 1) assert.match(body.contents[0].parts[0].text, /planning shortlist/)
    else if (calls === 2) assert.match(body.contents[0].parts[0].text, /Expand this selected product-video idea/)
    else assert.match(body.contents[0].parts[0].text, /Verify the physical route/)
    const plan = {confidence: 0.94, productType: 'household storage support', intendedUse: 'hold one small everyday item on the visible empty support', interactionMode: 'functional-demo', bodyPart: 'hand', bodyPartAlreadyVisible: false, prop: {name: 'one small plain kitchen sponge', reason: 'It visibly fits the empty support.'}, propAlreadyVisible: false, interactionAlreadyStarted: false, action: 'place', interactionTarget: 'the visible empty support floor', primaryAction: 'A hand lowers one small plain sponge through the open top and gently places it on the visible empty support floor.', microMotions: [], contactBehavior: 'The fingers release only when the sponge visibly rests on the support.', releaseBehavior: 'release', withdrawalBehavior: 'withdraw', endStateMode: 'prop-remains-attached', startState: 'The support is empty and no hand or prop is visible.', bodyPartState: 'The hand begins outside the frame.', endState: 'The sponge remains resting on the support after the hand withdraws.', payoffState: 'The same sponge remains visibly supported in the intended storage area.', protectedParts: ['the lower drainage tray', 'the surrounding bars'], criticalProtectedPart: null, productMovement: 'fixed', sellingValue: 'Show that the support keeps a small kitchen item in a clear resting place.', camera: {framing: 'medium-close-up', angle: 'a natural front product-demo angle'}, environment: {setting: 'a clean everyday kitchen', background: 'Keep the existing product context secondary.', preserveReferenceContext: true}}
    const scores = {clarity: 9, sellingValue: 9, visualInterest: 7, veoReliability: 9}
    const idea = {confidence: 0.94, intendedUse: plan.intendedUse, interactionMode: 'functional-demo', bodyPart: 'hand', action: 'place', sellingValue: plan.sellingValue, scores}
    const output = calls === 1
      ? {wholeProduct: true, referenceState: {productType: plan.productType, bodyPartAlreadyVisible: false, propAlreadyVisible: false, interactionAlreadyStarted: false, productMovement: 'fixed', environmentSetting: 'a clean everyday kitchen', preserveReferenceContext: true}, ideas: [idea, {...idea, action: 'touch', sellingValue: 'Show the visible outer construction.', scores: {...scores, sellingValue: 4}}]}
      : calls === 2 ? plan : physicalPath
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(output)}]}}]})
  }
  try {
    const a = await prepareVidsMotion(image, name), b = await prepareVidsMotion(image, name)
    assert.equal(a.action.id, 'functional-demo-place')
    assert.equal(a.ready, true)
    assert.equal(a.plan.interactionMode, 'functional-demo')
    assert.match(a.prompt, /GLOBAL FIDELITY/)
    assert.match(a.prompt, /PRIMARY ACTION/)
    assert.match(a.prompt, /PAYOFF/)
    assert.doesNotMatch(a.prompt, /fixed anchor|free terminal|load-bearing destination|x=\d/iu)
    assert.equal(a.version, VIDS_MOTION_VERSION)
    assert.equal(b.prompt, a.prompt)
    assert.equal(calls, 3)
    const {vidsCacheKey} = await import('../src/lib/video/vids-store')
    const key = vidsCacheKey(image, `interaction-v${VIDS_MOTION_VERSION}:${name}`)
    t.after(() => unlink(path.join(process.cwd(), '.data', 'vids-motion', `${key}.json`)).catch(() => {}))
  } finally {globalThis.fetch = original; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey}
})

test('Physical routes differ by visible opening and product mobility; names never select an operation', () => {
  const source = planProductInteraction(product, empty)
  for (const entry of ['top-down', 'front-in', 'left-in', 'right-in'] as const) {
    const bounded = constrainPhysicalPath(source, {...physicalPath, entry})
    assert.equal(bounded.ready, true)
    const prompt = handsDemoPrompt(bounded.action, [])
    assert.match(prompt, /continuous trajectories/)
    assert.match(prompt, /stop on that exact physical part/)
    assert.match(prompt, /NOT the approach path/)
    if (entry === 'top-down') {
      assert.match(prompt, /ABOVE the highest rim/)
      assert.match(prompt, /lower it vertically from above/)
      assert.match(prompt, /withdraw the empty hand back along the SAME clear route, upward/)
      assert.doesNotMatch(prompt, /held visibly beside the product/)
    } else assert.match(prompt, /horizontally/)
  }
  for (const name of ['Bộ chén', 'Bộ dao', 'Một sản phẩm chưa có trong danh mục']) {
    const item = {...product, name}
    const insight: ImageInsight = {...empty, interaction: {...evidence, action: 'lift', mobility: 'handheld', contact: 'rim', prop: 'none'}}
    const action = planProductInteraction(item, insight)
    assert.equal(constrainPhysicalPath(action, physicalPath).ready, false, 'a held product cannot use the prop placement route')
    assert.equal(constrainPhysicalPath(action, {...physicalPath, entry: 'grip-lift', accessKind: 'not-applicable', opening: null, destination: null, fit: 'not-applicable'}).ready, true)
  }
})

test('Incomplete, obstructed and oversized paths cannot become a ready Vids motion', () => {
  const action = planProductInteraction(product, empty)
  for (const change of [{clearance: 'blocked'}, {clearance: 'unclear'}, {entry: 'unclear'}, {entry: 'grip-lift'}, {opening: null}, {destination: null}, {fit: 'too-large'}, {fit: 'unclear'}]) {
    const result = constrainPhysicalPath(action, {...physicalPath, ...change})
    assert.equal(result.ready, false)
    assert.equal(hasPurposefulVidsAction(result.action.id), false)
  }
  const pickPlace = planProductInteraction(product, {...empty, interaction: {...evidence, action: 'pick-place', mobility: 'handheld', contact: 'body', prop: 'none'}})
  assert.equal(constrainPhysicalPath(pickPlace, {...physicalPath, entry: 'grip-lift', destination: null}).ready, false, 'do not invent a tabletop to finish pick-place')
})

test('An exposed support accepts a visible destination without inventing a compartment opening', () => {
  const action = planProductInteraction(product, {...empty, interaction: {...evidence, prop: 'loop-item'}})
  for (const destination of ['exposed empty hook', 'plain hanging peg', 'short support rail']) {
    const result = constrainPhysicalPath(action, {...physicalPath, accessKind: 'exposed', opening: null, destination: {text: destination, focus: {x: 44, y: 48, width: 12, height: 22}}, freeEnd: {text: 'visible free terminal', focus: {x: 54, y: 34, width: 10, height: 10}}, anchor: {text: 'fixed mounting connection', focus: {x: 42, y: 12, width: 16, height: 12}}})
    assert.equal(result.ready, true)
    assert.equal(result.path.destination?.text, 'bounded load-bearing support segment beyond its visible free end')
    assert.match(result.action.action, /flexible fabric hanging loop/)
    assert.match(result.action.action, /terminal passes completely through the loop opening using only clear air/)
    assert.match(result.action.action, /forbidden contact regions/)
    assert.doesNotMatch(result.action.action, /J-shaped|product category|Bộ dao|Bộ chén/)
  }
  const overlap = constrainPhysicalPath(action, {...physicalPath, accessKind: 'exposed', opening: null, destination: {text: 'wrong nearby connector', focus: {x: 42, y: 12, width: 16, height: 12}}, freeEnd: {text: 'visible free terminal', focus: {x: 54, y: 34, width: 10, height: 10}}, anchor: {text: 'fixed mounting connection', focus: {x: 42, y: 12, width: 16, height: 12}}})
  assert.equal(overlap.ready, false, 'a closed loop cannot target the fixed anchor or connector')
})

test('A correct-looking product with interpenetration is blocked independently of meaningful motion', () => {
  const report = parseVidsFidelityReport({verdict: 'no-obvious-mismatch', confidence: 'high', motion: 'meaningful', physics: 'plausible-in-samples', issues: [{frameIndex: 5, kind: 'physics', detail: 'Miếng rửa chén đi xuyên qua đáy khay.'}]})
  assert.equal(report.verdict, 'mismatch')
  assert.equal(report.physics, 'violation')
  assert.equal(canApproveVidsClip(report), false)
  const old = parseVidsFidelityReport({verdict: 'no-obvious-mismatch', confidence: 'high', motion: 'meaningful', issues: []})
  assert.equal(old.physics, 'unclear', 'an older appearance-only report does not establish physics')
  const times = vidsPhysicsReviewTimes(8)
  assert.equal(times.length, 12)
  assert.equal(times[0], 0)
  assert.equal(times[11], 7.9)
  assert.ok(times.every((time, i) => i === 0 || time > times[i - 1]))
  assert.ok(times.filter(time => time > 2 && time < 5.5).length >= 4, 'inspect the action between the old three samples')
})

test('A different observed entry cannot be accepted merely because the reviewer calls the motion plausible', async t => {
  const original = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY
  const reference = 'data:image/jpeg;base64,' + Buffer.from(`observed-path-${randomUUID()}`).toString('base64')
  const frames = Array.from({length: 12}, () => reference)
  const expected = {actionId: 'light-placement', path: physicalPath}
  const key = createHash('sha256').update(JSON.stringify(['fidelity-v7-generic-contact', [reference, ...frames], expected])).digest('hex')
  t.after(() => unlink(path.join(process.cwd(), '.data', 'vids-reviews', `${key}.json`)).catch(() => {}))
  let calls = 0
  process.env.GEMINI_API_KEY = 'fixture-only'
  globalThis.fetch = async (_url, init) => {
    calls++
    const parts = JSON.parse(String(init?.body)).contents[0].parts
    assert.equal(parts.filter((p: {inlineData?: unknown}) => p.inlineData).length, 13)
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({verdict: 'no-obvious-mismatch', confidence: 'high', motion: 'meaningful', physics: 'plausible-in-samples', observedEntry: 'front-in', entryEvidence: 'Vật được đưa ngang từ phía trước vào khoang.', issues: []})}]}}]})
  }
  try {
    const result = await reviewVidsFidelity(reference, frames, expected)
    assert.equal(result.verdict, 'mismatch')
    assert.equal(canApproveVidsClip(result), false)
    assert.ok(result.issues.some(issue => issue.kind === 'path'))
    assert.deepEqual(await reviewVidsFidelity(reference, frames, expected), result)
    assert.equal(calls, 1)
  } finally {globalThis.fetch = original; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey}
})

test('The image reader requests every album photo and retains useful geometry if copy hits quota', async () => {
  const {analyzeProductForVideo} = await import('../src/lib/ai/product-video-analysis')
  const assets = Array.from({length: 11}, (_, i) => ({id: `photo-${i}`, type: 'PRODUCT_IMAGE' as const, url: `/photo-${i}.jpg`, isPrimary: i === 0}))
  const sample = {...product, assets}, original = globalThis.fetch
  let calls = 0
  const inspected = new Set<string>()
  globalThis.fetch = async (_url, init) => {
    calls++
    const body = JSON.parse(String(init?.body))
    if (calls <= 3) {
      const parts = body.contents[0].parts as Array<{text?: string; inlineData?: unknown}>
      const ids = parts.filter(part => part.text?.startsWith('assetId=')).map(part => part.text!.slice('assetId='.length))
      ids.forEach(id => inspected.add(id))
      assert.ok(ids.length > 0 && ids.length <= 4)
      assert.equal(parts.filter(part => part.inlineData).length, ids.length)
      assert.equal(body.generationConfig.responseFormat.text.schema.properties.images.maxItems, ids.length)
      assert.equal(body.generationConfig.responseFormat.text.schema.properties.images.minItems, ids.length)
      const images = ids.map(assetId => assetId === 'photo-4'
        ? {...empty, assetId}
        : {...empty, assetId, usageSpace: 'not-support', interaction: {...evidence, action: 'point', contact: 'none', supportState: 'unclear', supportUse: 'unclear'}})
      return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({images})}]}}]})
    }
    return new Response('private provider details', {status: 429})
  }
  try {
    const result = await analyzeProductForVideo(sample, 'fixture-key', 22, {images: assets.map(asset => ({assetId: asset.id, dataUrl: 'data:image/jpeg;base64,YWJj'}))})
    assert.equal(calls, 4)
    assert.deepEqual([...inspected].sort(), assets.map(asset => asset.id).sort())
    assert.ok(result.contentPlan.facts.some(fact => fact.assetId === 'photo-4'))
    assert.equal(result.contentPlan.aiStatus?.attachedImages, 11)
    assert.equal(result.contentPlan.images.find(i => i.assetId === 'photo-4')?.usageSpace, 'empty-support')
    assert.doesNotMatch(JSON.stringify(result), /private provider details/)
  } finally {globalThis.fetch = original}
})
