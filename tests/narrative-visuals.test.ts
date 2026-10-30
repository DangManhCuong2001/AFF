import test from 'node:test'
import {createHash, randomUUID} from 'node:crypto'
import {unlink} from 'node:fs/promises'
import path from 'node:path'
import {NextRequest} from 'next/server'
import {POST} from '../src/app/api/experiments/vids/route'
import assert from 'node:assert/strict'
import {normalizeVietnameseNumbers} from '../src/lib/audio/speech-normalization'
import {narrationPhraseRange, narrationWords} from '../src/engines/planning/narrative-timing'
import {activeNarrativeVisual, compileNarrativeVisuals} from '../src/engines/planning/narrative-visuals'
import {parseVidsFidelityReport} from '../src/lib/video/vids-fidelity'
import {reviewVidsFidelity} from '../src/lib/ai/vids-fidelity-review'
import {VipeeVisualDirector} from '../src/engines/visual/VipeeVisualDirector'
import type {ProductInput, StoryboardScene} from '../src/engines/core/types'
import type {ImageInsight} from '../src/engines/planning/types'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'

const assets: ProductInput['assets'] = [{id: 'photo', type: 'PRODUCT_IMAGE', url: '/photo.jpg'}]
const insights: ImageInsight[] = [{assetId: 'photo', role: 'primary', source: 'vision', details: [{text: 'Bốn chiếc chén màu trắng', focus: {x: 10, y: 10, width: 70, height: 40}}, {text: 'Khay có hai tay cầm', focus: {x: 20, y: 50, width: 60, height: 40}}]}]
const voice = 'Bộ có bốn chén màu trắng, đặt trên khay có hai tay cầm.'
const raw = [{phrase: 'bốn chén màu trắng', assetId: 'photo', detailIndex: 1}, {phrase: 'khay có hai tay cầm', assetId: 'photo', detailIndex: 2}]

test('Measurements pronounce hundreds, currency does not corrupt kéo, and normalization is idempotent', () => {
  const source = 'Cao 225 mm, rộng 190 mm. Bộ có 1 kéo, 1 đế, nặng 2 kg. Giá 99k.'
  const text = normalizeVietnameseNumbers(source)
  assert.match(text, /hai trăm hai mươi lăm mi li mét/)
  assert.match(text, /một trăm chín mươi mi li mét/)
  assert.match(text, /một kéo, một đế, nặng hai ki lô gam/)
  assert.match(text, /chín mươi chín nghìn/)
  assert.equal(normalizeVietnameseNumbers(text), text)
  assert.equal(normalizeVietnameseNumbers('101 105 999'), 'một trăm linh một một trăm linh năm chín trăm chín mươi chín')
})

test('Caption and visual estimates account for the spoken size of digits and measurement units', () => {
  const text = 'Ống cao 225 mm, rộng 190 mm.'
  const words = narrationWords(text)
  assert.ok(words[2].weight > words[0].weight * 3)
  assert.ok(words[3].weight > 4)
  assert.equal(words.at(-1)?.end, 1)
  const height = narrationPhraseRange(text, '225 mm')!, width = narrationPhraseRange(text, '190 mm')!
  assert.ok(height.end < width.start)
  assert.equal(narrationPhraseRange(text, '25 mm'), undefined)
  assert.equal(narrationPhraseRange('cán trắng, cán trắng', 'cán trắng'), undefined)
})

test('Different products select only verified image details for exactly quoted narration', () => {
  const result = compileNarrativeVisuals(raw, voice, assets, insights)
  assert.equal(result.length, 2)
  assert.deepEqual(result[0].crop, insights[0].details![0].focus)
  assert.equal(activeNarrativeVisual(result, voice, 0), 0)
  assert.equal(activeNarrativeVisual(result, voice, 0.9), 1)
  assert.equal(activeNarrativeVisual(result, 'Nội dung đã thay đổi hoàn toàn.', 0.9), -1)
  assert.equal(compileNarrativeVisuals([{...raw[0], phrase: 'có hai tay cầm'}], voice, assets, insights).length, 0)
  assert.equal(compileNarrativeVisuals([{...raw[0], assetId: 'unknown'}], voice, assets, insights).length, 0)
  assert.equal(compileNarrativeVisuals([{...raw[0], detailIndex: 3}], voice, assets, insights).length, 0)
  assert.equal(compileNarrativeVisuals(raw, voice, assets, [{...insights[0], source: 'metadata'}]).length, 0)
  assert.equal(compileNarrativeVisuals(raw, voice, assets, [{...insights[0], role: 'packaging'}]).length, 0)
  assert.equal(compileNarrativeVisuals([raw[0]], voice, assets, [{...insights[0], details: [{text: insights[0].details![0].text, focus: {x: 90, y: 0, width: 40, height: 20}}]}]).length, 0)
})

test('Shared visual director carries image URLs for narrated detail steps', () => {
  const product: ProductInput = {id: 'test', name: 'Bộ chén', category: 'home', assets}
  const base = planAdaptiveVideo(product).storyboard.scenes[0]
  const scene: StoryboardScene = {...base, voice, renderPlan: {...base.renderPlan!, visualSteps: compileNarrativeVisuals(raw, voice, assets, insights)}}
  const plan = new VipeeVisualDirector().createVisualStoryplan({scenes: [scene], productImages: ['/photo.jpg'], productName: product.name, category: 'home', speechTimings: [{segmentId: scene.id, text: voice, emotion: 'neutral', startSec: 0, endSec: 5, durationSec: 5}]})
  assert.deepEqual(plan.beats[0].visualStepImages, ['/photo.jpg', '/photo.jpg'])
})

test('Gemini frame review cannot approve ambiguous findings or invent certainty', () => {
  const value = {verdict: 'no-obvious-mismatch', confidence: 'low', motion: 'unclear', issues: []}
  assert.equal(parseVidsFidelityReport(value).verdict, 'uncertain')
  assert.equal(parseVidsFidelityReport({...value, confidence: 'high', verdict: 'mismatch'}).verdict, 'uncertain')
  assert.throws(() => parseVidsFidelityReport({...value, issues: [{frameIndex: 12, kind: 'shape', detail: 'Sai'}]}))
  assert.throws(() => parseVidsFidelityReport({...value, verdict: 'approved'}))
})

test('Frame review rejects invalid inputs and quota without retrying or leaking provider response', async () => {
  await assert.rejects(reviewVidsFidelity('https://remote/image.jpg', []), /INVALID_REVIEW_IMAGES/)
  const originalFetch = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY
  let calls = 0
  process.env.GEMINI_API_KEY = 'test-only'
  globalThis.fetch = async () => {calls++; return new Response('private provider body', {status: 429})}
  try {
    const image = 'data:image/jpeg;base64,' + Buffer.from(`quota-${Date.now()}`).toString('base64')
    await assert.rejects(reviewVidsFidelity(image, [image, image, image]), /^Error: GEMINI_REVIEW_QUOTA$/)
    assert.equal(calls, 1)
  } finally {globalThis.fetch = originalFetch; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey}
})

test('Repeated and concurrent frame reviews reuse the exact image report without another Gemini request', async t => {
  const originalFetch = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY
  const image = 'data:image/jpeg;base64,' + Buffer.from(randomUUID()).toString('base64')
  const frames = [image, image, image]
  const key = createHash('sha256').update(JSON.stringify(['fidelity-v4-physics', [image, ...frames], null])).digest('hex')
  t.after(async () => {await unlink(path.join(process.cwd(), '.data', 'vids-reviews', `${key}.json`)).catch(() => {})})
  process.env.GEMINI_API_KEY = 'test-only'
  let calls = 0
  const expected = {verdict: 'mismatch', confidence: 'high', motion: 'limited', physics: 'unclear', observedEntry: 'unclear', entryEvidence: '', issues: [{frameIndex: 2, kind: 'shape', detail: 'Phần quai bị đổi hình dạng.'}]}
  globalThis.fetch = async () => {calls++; await new Promise(resolve => setTimeout(resolve, 10)); return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(expected)}]}}]})}
  try {
    assert.deepEqual(await Promise.all([reviewVidsFidelity(image, frames), reviewVidsFidelity(image, frames)]), [expected, expected])
    assert.deepEqual(await reviewVidsFidelity(image, frames), expected)
    assert.equal(calls, 1)
  } finally {globalThis.fetch = originalFetch; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey}
})

test('Frame review remains local and same origin before contacting Gemini', async () => {
  for (const [url, origin] of [['https://example.com/api/experiments/vids', 'https://example.com'], ['http://localhost:3000/api/experiments/vids', 'https://example.com']]) {
    const request = new NextRequest(url, {method: 'POST', headers: {host: new URL(url).host, origin, 'Content-Type': 'application/json'}, body: JSON.stringify({action: 'review', reference: 'invalid', frames: []})})
    assert.equal((await POST(request)).status, 403)
  }
})
