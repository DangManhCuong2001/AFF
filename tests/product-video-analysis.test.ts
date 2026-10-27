import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeProductForVideo} from '../src/lib/ai/product-video-analysis'
import {readImageInsights} from '../src/lib/ai/gemini'
import type {ProductInput} from '../src/engines/core/types'

const product: ProductInput = {id: 'two-stage', name: 'Bộ dao A', category: 'home', description: 'CHĂM SÓC KHÁCH HÀNG:\nBảo hành 1 năm\nHoàn trả 15 ngày', assets: [{id: 'main', type: 'PRODUCT_IMAGE', url: '/product.jpg'}]}
const images = [{assetId: 'main', dataUrl: 'data:image/jpeg;base64,YWJj'}]
const focus = 'image-main-detail-1'
const vision = {images: [{assetId: 'main', role: 'primary', details: [{text: 'Bộ dao có tông màu kem'}, {text: 'Cán dao có đinh tán tròn'}], productBounds: {x: 20, y: 20, width: 60, height: 60}}]}
const copy = {
  recommendedAngle: 'features', focusFactId: focus, images: [],
  messagePlan: {viewerNeed: 'Bạn đang tìm bộ dao màu kem?', answer: 'Bộ dao này có tông màu kem.', evidenceIds: [focus]},
  buyerQuestion: {text: 'Tông màu kem có đúng màu bạn muốn?', evidenceIds: [focus]},
  hookCandidates: [
    {headline: 'Bộ dao màu kem', text: 'Bạn đang tìm bộ dao màu kem?', evidenceIds: [focus]},
    {headline: 'Tông màu kem', text: 'Bộ dao này có tông màu kem.', evidenceIds: [focus]},
    {headline: 'Chọn màu kem?', text: 'Tông màu kem này có hợp góc bếp bạn?', evidenceIds: [focus]},
  ],
  scenes: [
    {headline: 'Bộ dao màu kem', voice: 'Bạn đang tìm bộ dao màu kem?', assetId: 'main', evidenceIds: [focus]},
    {headline: 'Tông màu kem', voice: 'Bộ dao này có tông màu kem.', assetId: 'main', evidenceIds: [focus]},
    {headline: 'Đinh tán tròn', voice: 'Cán dao có những đinh tán tròn.', assetId: 'main', evidenceIds: ['image-main-detail-2']},
    {headline: 'Xem bộ dao màu kem', voice: 'Nhấn sản phẩm để xem bộ dao màu kem.', assetId: 'main', evidenceIds: [focus], ctaLabel: 'Xem bộ dao màu kem'},
  ],
}
const response = (value: unknown) => new Response(JSON.stringify({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(value)}]}}]}))
async function mocked(run: (count: () => number) => Promise<void>, reply: (call: number, init?: RequestInit) => Response) {
  const original = globalThis.fetch
  let count = 0
  globalThis.fetch = async (_url, init) => reply(++count, init)
  try {await run(() => count)} finally {globalThis.fetch = original}
}

test('The production workflow reads photos before writing and restricts hooks/CTA/body to canonical source IDs', async () => {
  await mocked(async count => {
    const result = await analyzeProductForVideo(product, 'mock-key', 22, {images})
    assert.equal(count(), 2)
    assert.equal(result.contentPlan.aiStatus?.state, 'completed')
    assert.deepEqual(result.contentPlan.aiStatus?.attempts?.map(attempt => attempt.stage), ['vision', 'copy'])
    assert.equal(result.contentPlan.aiStatus?.attachedImages, 1)
    assert.deepEqual(result.contentPlan.copySources, {hooks: 'gemini', script: 'gemini', cta: 'gemini'})
    assert.equal(result.contentPlan.focusFactId, focus)
    assert.equal(result.strategy.cta, copy.scenes.at(-1)!.voice)
    assert.doesNotMatch(result.creativePlan.story, /bảo hành|hoàn trả|chăm sóc/i)
    assert.equal(result.contentPlan.images[0].source, 'vision')
    assert.ok(result.contentPlan.warnings.every(warning => !warning.includes('Chưa có ảnh hợp lệ')))
  }, (call, init) => {
    const body = JSON.parse(String(init?.body))
    const schema = body.generationConfig.responseFormat.text.schema
    if (call === 1) {
      assert.equal(body.contents[0].parts.filter((part: {inlineData?: unknown}) => part.inlineData).length, 1)
      return response(vision)
    }
    assert.equal(body.contents[0].parts.filter((part: {inlineData?: unknown}) => part.inlineData).length, 0)
    assert.match(body.contents[0].parts[0].text, /image-main-detail-1/)
    assert.deepEqual(schema.properties.focusFactId.enum, [focus])
    assert.deepEqual(schema.properties.hookCandidates.items.properties.evidenceIds.items.enum, [focus])
    assert.deepEqual(schema.properties.cta.properties.evidenceIds.items.enum, [focus])
    assert.deepEqual(schema.properties.scenes.prefixItems[1].properties.evidenceIds.items.enum, [focus])
    assert.equal(schema.properties.images.maxItems, 0)
    return response(copy)
  })
})

test('Vision quota/auth failures stop before writing and never expose the provider body or key', async () => {
  for (const status of [429, 403]) await mocked(async count => {
    const result = await analyzeProductForVideo(product, 'mock-key', 22, {images})
    assert.equal(count(), 1)
    assert.equal(result.contentPlan.aiStatus?.reason, status === 429 ? 'quota' : 'auth')
    assert.doesNotMatch(JSON.stringify(result), /private provider body|mock-key/)
    assert.doesNotMatch(result.creativePlan.story, /bảo hành|hoàn trả|chăm sóc/i)
  }, () => new Response('private provider body mock-key', {status}))
})

test('Copy failures retain the validated image details and identify the failed stage', async () => {
  await mocked(async count => {
    const result = await analyzeProductForVideo(product, 'mock-key', 22, {images})
    assert.equal(count(), 2)
    assert.equal(result.contentPlan.aiStatus?.reason, 'quota')
    assert.equal(result.contentPlan.aiStatus?.attachedImages, 1)
    assert.equal(result.contentPlan.images[0].source, 'vision')
    assert.ok(result.contentPlan.facts.some(fact => fact.id === focus))
    assert.deepEqual(result.contentPlan.aiStatus?.attempts?.map(attempt => [attempt.stage, attempt.outcome]), [['vision', 'completed'], ['copy', 'quota']])
  }, call => call === 1 ? response(vision) : new Response('', {status: 429}))
})

test('Unverifiable image-only claims cannot become source facts for a second generation', async () => {
  await mocked(async count => {
    const result = await analyzeProductForVideo(product, 'mock-key', 22, {images})
    assert.equal(count(), 1)
    assert.equal(result.contentPlan.aiStatus?.reason, 'invalid-content')
    assert.equal(result.contentPlan.facts.length, 0)
  }, () => response({images: [{assetId: 'main', role: 'primary', details: [{text: 'Chất liệu inox cao cấp, cực kỳ tiện lợi'}]}]}))
})

test('Native Gemini edge coordinates convert to crop sizes instead of extending into the advertising footer', () => {
  const parsed = readImageInsights({images: [{assetId: 'main', role: 'primary', box_2d: [190, 200, 790, 680], details: [{text: 'Tay cầm màu kem', box_2d: [200, 350, 420, 520]}]}]}, images)
  assert.deepEqual(parsed[0].productBounds, {x: 20, y: 19, width: 48, height: 60})
  assert.deepEqual(parsed[0].details?.[0].focus, {x: 35, y: 20, width: 17, height: 22})
  const invalid = readImageInsights({images: [{assetId: 'main', role: 'primary', box_2d: [900, 200, 790, 680], details: [{text: 'Tay cầm màu kem'}]}]}, images)
  assert.equal(invalid[0].productBounds, undefined)
  assert.equal(invalid[0].details?.[0].text, 'Tay cầm màu kem')
})
