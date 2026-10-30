import test from 'node:test'
import assert from 'node:assert/strict'
import {extractProductFacts, isProductDetail} from '../src/engines/planning/product-facts'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {analyzeProductWithGemini} from '../src/lib/ai/gemini'
import {validateCommerceCopy} from '../src/lib/ai/validate-commerce-copy'
import type {ProductInput} from '../src/engines/core/types'

const policies = `🤷 CHĂM SÓC KHÁCH HÀNG & ĐẢM BẢO CHẤT LƯỢNG:
- Bảo hành người bán 1 năm
- Chính sách hoàn trả 15 ngày
- Liên hệ shop để được tư vấn
- Hỗ trợ khách hàng 24/7
- Giao hàng toàn quốc
- Cam kết chính hãng
- Cảm ơn bạn đã ủng hộ shop`
const product: ProductInput = {id: 'regression', name: 'Hộp đựng A', category: 'home', description: policies, features: [''], benefits: [''], assets: Array.from({length: 5}, (_, index) => ({id: `image-${index}`, type: 'PRODUCT_IMAGE' as const, url: `/product-${index}.jpg`}))}
const merchantPattern = /chăm sóc|đảm bảo chất lượng|bảo hành|hoàn trả|cam kết|giao hàng|liên hệ|customer service|warranty/i

test('The screenshot policy-only description produces no product facts or policy-based hook/script', () => {
  const extracted = extractProductFacts(product)
  assert.deepEqual(extracted.facts, [])
  assert.ok(extracted.excludedCount >= 7)
  const result = planAdaptiveVideo(product, 22)
  assert.equal(result.contentPlan.format, 'design-showcase')
  assert.equal(result.strategy.targetDuration, 12)
  assert.equal(result.contentPlan.focusFactId, undefined)
  assert.equal(result.contentPlan.message?.proof.length, 0)
  assert.doesNotMatch(JSON.stringify({message: result.contentPlan.message, reason: result.contentPlan.primaryBuyingReason, scenes: result.storyboard.scenes, hooks: result.creativePlan.hookCandidates}), merchantPattern)
  assert.ok(result.contentPlan.missingInformation.some((item) => item.includes('thông số')))
  const polluted = planAdaptiveVideo({...product, problemSolved: 'CHĂM SÓC KHÁCH HÀNG', benefits: ['Bảo hành 1 năm', 'Chính sách hoàn trả 15 ngày'], targetAudience: 'Khách hàng liên hệ shop'})
  assert.doesNotMatch(JSON.stringify(polluted.analysis), merchantPattern)
})

test('A missing Gemini key is explicit and makes no request', async () => {
  const savedKey = process.env.GEMINI_API_KEY
  delete process.env.GEMINI_API_KEY
  try {
    await mocked(() => {throw new Error('Unexpected API request')}, async (calls) => {
      const result = await analyzeProductWithGemini(product)
      assert.equal(calls(), 0)
      assert.equal(result.contentPlan.aiStatus?.reason, 'missing-key')
      assert.equal(result.contentPlan.aiStatus?.attachedImages, 0)
      assert.doesNotMatch(result.creativePlan.story, merchantPattern)
    })
  } finally {if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey}
})

test('Specific details after merchant blocks, headings and numbered bullets are retained before the fact cap', () => {
  const sample = {...product, description: `${policies}
THÔNG TIN SẢN PHẨM
1. Chất liệu: Nhựa PP
2. Kích thước: 20 x 12 x 8 cm
3. Màu sắc: Màu kem
HƯỚNG DẪN SỬ DỤNG:
Lau bằng khăn ẩm sau khi sử dụng.`}
  const result = planAdaptiveVideo(sample)
  assert.deepEqual(result.contentPlan.facts.map((fact) => fact.text), ['Chất liệu: Nhựa PP', 'Kích thước: 20 x 12 x 8 cm', 'Màu sắc: Màu kem', 'Lau bằng khăn ẩm sau khi sử dụng'])
  assert.match(result.contentPlan.primaryBuyingReason, /Kích thước/)
  assert.doesNotMatch(result.creativePlan.story, merchantPattern)
  assert.ok(result.contentPlan.message?.proof.every((proof) => result.contentPlan.facts.some((fact) => fact.id === proof.factId)))
})

test('HTML, list markers, inline policies and multiple sentences do not swallow genuine specifications', () => {
  const sample = {...product, description: '<h2>Thông số kỹ thuật:</h2><p>Chất liệu: Inox 304; Dây dài 1,2 mét.</p><p>Kết nối USB-C. Bluetooth 5.3.</p><p>Màu sắc: Đen, bảo hành 1 năm.</p>'}
  const facts = extractProductFacts(sample).facts.map((fact) => fact.text)
  assert.deepEqual(facts, ['Chất liệu: Inox 304', 'Dây dài 1,2 mét', 'Kết nối USB-C', 'Bluetooth 5.3', 'Màu sắc: Đen'])
  assert.equal(isProductDetail('Cách bảo quản'), false)
  assert.equal(isProductDetail('Cách bảo quản: Giặt tay'), true)
  assert.equal(isProductDetail('TÍNH NĂNG NỔI BẬT'), false)
  assert.equal(isProductDetail('Kích thước'), false)
})

test('Merchant content cannot sneak back through feature fields, AI copy or image observations', () => {
  const sample = {...product, description: '', features: ['CHĂM SÓC KHÁCH HÀNG & ĐẢM BẢO CHẤT LƯỢNG:', 'Bảo hành 1 năm', 'Màu kem', 'Chất liệu inox'], benefits: ['Chính sách hoàn trả 15 ngày']}
  const result = planAdaptiveVideo(sample, 22, 'features', [{assetId: 'image-0', role: 'primary', source: 'vision', observation: 'Bảo hành người bán 1 năm', productBounds: {x: 10, y: 10, width: 80, height: 80}}])
  assert.deepEqual(result.contentPlan.facts.map((fact) => fact.text), ['Màu kem', 'Chất liệu inox'])
  assert.doesNotMatch(result.creativePlan.story, merchantPattern)
  assert.equal(validateCommerceCopy({text: 'Shop chăm sóc khách hàng chu đáo.', evidenceIds: ['fact-1']}, result.contentPlan.facts, sample.name, 'body'), false)
})

async function mocked(respond: (calls: number, init?: RequestInit) => Response, run: (calls: () => number) => Promise<void>) {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, init) => respond(++calls, init)
  try {await run(() => calls)} finally {globalThis.fetch = original}
}

test('Gemini quota/auth errors are visible, sanitized and do not trigger another model request', async () => {
  for (const status of [429, 403]) await mocked(() => new Response('sensitive provider body must not leak', {status}), async (calls) => {
    const result = await analyzeProductWithGemini(product, 'test-only-key', 22, {images: [{assetId: 'image-0', dataUrl: 'data:image/jpeg;base64,YWJj'}]})
    assert.equal(calls(), 1)
    assert.equal(result.contentPlan.aiStatus?.reason, status === 429 ? 'quota' : 'auth')
    assert.equal(result.contentPlan.aiStatus?.attachedImages, 1)
    assert.match(result.contentPlan.aiStatus!.message, new RegExp(String(status)))
    assert.doesNotMatch(JSON.stringify(result), /test-only-key|sensitive provider body/)
    assert.doesNotMatch(result.creativePlan.story, merchantPattern)
  })
})

test('Valid vision observations survive an invalid AI script and a subsequent unavailable model', async () => {
  const observation = 'Tay cầm màu kem'
  await mocked((calls) => calls === 1 ? new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify({images: [{assetId: 'image-0', role: 'primary', observation, focus: {x: 90, y: 90, width: 50, height: 50}, productBounds: {x: 10, y: 10, width: 80, height: 80}}], scenes: []})}]}}]})) : new Response('', {status: 503}), async () => {
    const result = await analyzeProductWithGemini(product, 'test-key', 22, {images: [{assetId: 'image-0', dataUrl: 'data:image/jpeg;base64,YWJj'}]})
    assert.equal(result.contentPlan.source, 'rules')
    assert.equal(result.contentPlan.images[0].source, 'vision')
    assert.equal(result.contentPlan.images[0].focus, undefined)
    assert.equal(result.contentPlan.images[0].productBounds?.width, 80)
    assert.equal(result.contentPlan.primaryBuyingReason, observation)
    assert.equal(result.contentPlan.aiStatus?.state, 'failed')
    assert.doesNotMatch(result.creativePlan.story, merchantPattern)
  })
})

test('Gemini receives cleaned product data and cannot treat a shop policy as the selected fact', async () => {
  const sample = {...product, description: `${policies}\nThông số sản phẩm:\nChất liệu inox\nKích thước 20cm`}
  const base = planAdaptiveVideo(sample)
  const response = {focusFactId: 'missing-policy-fact', images: [], scenes: base.storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice, assetId: scene.renderPlan!.assetId, evidenceIds: scene.renderPlan!.evidenceIds}))}
  await mocked((_calls, init) => {
    const prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text
    const suppliedProduct = JSON.parse(prompt.split('Sản phẩm: ')[1].split('\nẢnh:')[0])
    assert.doesNotMatch(JSON.stringify(suppliedProduct), merchantPattern)
    return new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify(response)}]}}]}))
  }, async (calls) => {
    const result = await analyzeProductWithGemini(sample, 'test-key')
    assert.equal(calls(), 1)
    assert.notEqual(result.contentPlan.focusFactId, 'missing-policy-fact')
    assert.equal(result.contentPlan.aiStatus?.state, 'partial')
    assert.doesNotMatch(result.creativePlan.story, merchantPattern)
    assert.ok(result.contentPlan.warnings.some((warning) => warning.includes('ảnh hợp lệ')))
  })
})

test('A later text-only AI response also retains valid observations from the earlier failed draft', async () => {
  const base = planAdaptiveVideo(product)
  const scenes = base.storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice, assetId: scene.renderPlan!.assetId, evidenceIds: scene.renderPlan!.evidenceIds}))
  await mocked((calls) => new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify(calls === 1 ? {images: [{assetId: 'image-0', role: 'primary', observation: 'Màu kem'}], scenes: []} : {images: [], scenes})}]}}]})), async (calls) => {
    const result = await analyzeProductWithGemini(product, 'test-key', 22, {images: [{assetId: 'image-0', dataUrl: 'data:image/jpeg;base64,YWJj'}]})
    assert.equal(calls(), 2)
    assert.equal(result.contentPlan.images[0].source, 'vision')
    assert.equal(result.contentPlan.images[0].observation, 'Màu kem')
    assert.doesNotMatch(result.creativePlan.story, merchantPattern)
  })
})

test('Generic shop promises and a duplicated product title cannot displace actual product details', () => {
  const name = 'Kệ để đồ rửa chén rửa bát tiện lợi cho nhà bếp'
  const result = extractProductFacts({...product, name, description: `${name}\nThiết kế tiện lợi, phù hợp với mọi không gian bếp.\nGiúp bạn sắp xếp đồ dùng một cách có tổ chức, tiết kiệm thời gian.\nTăng tính thẩm mỹ cho không gian bếp của bạn.\nKệ có thể đặt ở nhiều vị trí trong nhà bếp.\nKích thước: 23 x 9 x 11 cm.\nMàu đen.`})
  assert.deepEqual(result.facts.map(fact => fact.text), ['Kích thước: 23 x 9 x 11 cm', 'Màu đen'])
  assert.ok(result.excludedCount >= 4)
  assert.equal(extractProductFacts({...product, name: 'Bộ dao 6 món', description: '', features: ['Bộ dao 6 món']}).facts[0]?.text, 'Bộ dao 6 món', 'Explicit features remain usable even when matching the title')
})
