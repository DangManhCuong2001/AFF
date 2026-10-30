import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeProductWithGemini} from '../src/lib/ai/gemini'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {hookIsAnswered, rankCommerceHooks} from '../src/engines/planning/hook-ranking'
import type {ProductInput} from '../src/engines/core/types'
import {validateCommerceCopy} from '../src/lib/ai/validate-commerce-copy'

const product: ProductInput = {id: 'image-only', name: 'Bộ dao Redchef', category: 'home', assets: [{id: 'main', type: 'PRODUCT_IMAGE', url: '/original.jpg'}]}
const focus = 'image-main-detail-1'
function draft() {
  return {
    recommendedAngle: 'features', focusFactId: focus,
    images: [{assetId: 'main', role: 'primary', observation: 'Bộ dao gồm ống cắm và nhiều dao cùng màu kem sáng, tay cầm có những chi tiết tròn, các món được xếp cạnh nhau.', productBounds: {x: 20, y: 20, width: 60, height: 60}, details: [
      {text: 'Cán dao và ống cắm cùng tông kem'},
      {text: 'Có dao, kéo và ống cắm', focus: {x: 20, y: 30, width: 50, height: 50}},
    ]}],
    messagePlan: {viewerNeed: 'Bạn đang tìm bộ dao tông kem?', answer: 'Cán dao và ống cắm đều cùng tông kem.', evidenceIds: [focus]},
    buyerQuestion: {text: 'Tông kem này có hợp góc bếp của bạn?', evidenceIds: [focus]},
    hookCandidates: [
      {headline: 'Cùng tông kem', text: 'Tìm bộ dao cùng tông kem?', evidenceIds: [focus]},
      {headline: 'Cán dao và ống cắm màu kem', text: 'Cán dao, ống cắm đều màu kem.', evidenceIds: [focus]},
      {headline: 'Tông kem cho góc bếp', text: 'Tông kem này có hợp góc bếp bạn?', evidenceIds: [focus]},
    ],
    scenes: [
      {headline: 'Cùng tông kem', voice: 'Tìm bộ dao cùng tông kem?', assetId: 'main', evidenceIds: [focus]},
      {headline: 'Cán dao và ống cắm màu kem', voice: 'Cán dao và ống cắm đều cùng tông kem.', assetId: 'main', evidenceIds: [focus]},
      {headline: 'Dao, kéo và ống cắm', voice: 'Ảnh còn cho thấy dao, kéo và ống cắm.', assetId: 'main', evidenceIds: ['image-main-detail-2']},
      {headline: 'Xem bộ dao màu kem', voice: 'Nhấn sản phẩm trong giỏ hàng để xem bộ dao màu kem.', assetId: 'main', evidenceIds: [focus], ctaLabel: 'Xem bộ dao màu kem'},
    ],
  }
}
async function analyze(response: unknown, sample = product) {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {calls++; return new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify(response)}]}}]}))}
  try {
    const result = await analyzeProductWithGemini(sample, 'mock-key', 22, {images: [{assetId: 'main', dataUrl: 'data:image/jpeg;base64,YWJj'}]})
    assert.equal(calls, 1, 'Valid image-led copy should need one Gemini request')
    return result
  } finally {globalThis.fetch = original}
}

test('Long vision summaries do not erase short visual facts, the chosen focus, authored hooks or CTA', async () => {
  const value = draft()
  const result = await analyze(value)
  assert.equal(result.contentPlan.aiStatus?.state, 'completed')
  assert.equal(result.contentPlan.focusFactId, focus)
  assert.equal(result.contentPlan.primaryBuyingReason, value.images[0].details[0].text)
  assert.deepEqual(result.contentPlan.copySources, {hooks: 'gemini', script: 'gemini', cta: 'gemini'})
  assert.equal(result.contentPlan.message?.source, 'gemini')
  assert.equal(result.contentPlan.message?.evidenceIds[0], focus)
  assert.equal(result.strategy.cta, value.scenes.at(-1)!.voice)
  assert.equal(result.storyboard.scenes.at(-1)?.renderPlan?.ctaLabel, 'Xem bộ dao màu kem')
  assert.equal(result.storyboard.scenes[2].renderPlan?.layout, 'detail')
  assert.equal(result.storyboard.scenes[2].renderPlan?.crop?.x, 20)
  assert.equal(hookIsAnswered(result.creativePlan.selectedHook, result.contentPlan.facts, result.storyboard.scenes), true)
  assert.doesNotMatch(result.creativePlan.story, /bảo hành|chăm sóc|đảm bảo chất lượng/)
})

test('Short details remain usable without a redundant overall image observation', async () => {
  const value = draft()
  value.images[0].observation = ''
  const result = await analyze(value)
  assert.equal(result.contentPlan.aiStatus?.state, 'completed')
  assert.equal(result.contentPlan.focusFactId, focus)
  assert.ok(result.contentPlan.message?.proof.every((proof) => proof.kind === 'image'))
  assert.equal(result.storyboard.scenes[2].renderPlan?.layout, 'detail')
})

test('Gemini quoted image details survive source checks, layout selection and final scene timing', async () => {
  const value = draft()
  Object.assign(value.scenes[2], {visualFocus: [{phrase: 'kéo và ống cắm', assetId: 'main', detailIndex: 2}, {phrase: 'chi tiết không được đọc', assetId: 'main', detailIndex: 1}]})
  const result = await analyze(value)
  const step = result.storyboard.scenes[2].renderPlan?.visualSteps
  assert.equal(step?.length, 1)
  assert.equal(step?.[0].phrase, 'kéo và ống cắm')
  assert.deepEqual(step?.[0].crop, value.images[0].details[1].focus)
})

test('Rejecting an unsafe visual detail cannot shift the source IDs of later valid details', async () => {
  const value = draft()
  value.images[0].details.unshift({text: 'Bảo hành 1 năm'})
  value.focusFactId = 'image-main-detail-2'
  for (const piece of [...value.hookCandidates, ...value.scenes, value.messagePlan, value.buyerQuestion]) piece.evidenceIds = piece.evidenceIds.map(id => id === focus ? 'image-main-detail-2' : id === 'image-main-detail-2' ? 'image-main-detail-3' : id)
  const result = await analyze(value)
  assert.equal(result.contentPlan.focusFactId, 'image-main-detail-2')
  assert.equal(result.contentPlan.facts.find(fact => fact.id === 'image-main-detail-2')?.text, 'Cán dao và ống cắm cùng tông kem')
  assert.equal(result.contentPlan.facts.find(fact => fact.id === 'image-main-detail-3')?.text, 'Có dao, kéo và ống cắm')
  assert.equal(result.contentPlan.facts.some(fact => fact.id === focus), false)
  assert.equal(result.contentPlan.aiStatus?.state, 'completed')
})

test('Equivalent summary/detail copy retains the explicitly chosen detail source ID', async () => {
  const value = draft()
  value.images[0].observation = value.images[0].details[0].text
  const result = await analyze(value)
  assert.equal(result.contentPlan.focusFactId, focus)
  assert.equal(result.contentPlan.aiStatus?.state, 'completed')
})

test('Canned introductions lose to concrete product hooks even when they mention the product name', async () => {
  const value = draft()
  value.hookCandidates[0] = {headline: 'Bộ dao màu kem', text: 'Bạn đã xem qua thiết kế bộ dao Redchef này chưa?', evidenceIds: [focus]}
  const result = await analyze(value)
  assert.doesNotMatch(result.strategy.hook, /Bạn đã xem qua/)
  assert.match(result.strategy.hook, /kem/)
  assert.ok(result.contentPlan.aiStatus?.review?.some(item => item.part === 'hook' && item.reason === 'generic'))
})

test('Visual focus selection also works for clothing, electronics and storage products', () => {
  for (const [name, category, text] of [['Áo A', 'fashion', 'Áo màu xanh'], ['Tai nghe A', 'tech', 'Có đầu nối USB-C'], ['Hộp A', 'home', 'Nắp hộp có quai xách']] as const) {
    const sample = {...product, name, category}
    const result = planAdaptiveVideo(sample, 22, undefined, [{assetId: 'main', role: 'primary', source: 'vision', details: [{text}]}], focus)
    assert.equal(result.contentPlan.focusFactId, focus)
    assert.equal(result.contentPlan.primaryBuyingReason, text)
    assert.match(result.storyboard.scenes[1].voice, new RegExp(text))
    const ranked = rankCommerceHooks([{id: 'specific', text: `${text}?`, evidenceIds: [focus]}], {product: sample, facts: result.contentPlan.facts, scenes: result.storyboard.scenes, images: result.contentPlan.images, focusId: focus})
    assert.equal(ranked[0]?.id, 'specific')
  }
})

test('A product choice instruction is not accepted as a click CTA, and inferred benefits cannot pass as visible details', async () => {
  const facts = [{id: focus, text: 'Cán dao và ống cắm cùng tông kem', source: 'image' as const, assetId: 'main'}]
  assert.equal(validateCommerceCopy({text: 'Hãy chọn ngay bộ dao Redchef màu kem này nhé.', evidenceIds: [focus]}, facts, product.name, 'cta', focus), false)
  assert.equal(validateCommerceCopy({text: 'Cần bộ dao màu kem có ống đựng tiện lợi?', evidenceIds: [focus]}, facts, product.name, 'hook', focus), false)
  assert.equal(validateCommerceCopy({text: 'Nhấn sản phẩm để xem bộ dao màu kem.', headline: 'Màu kem sang trọng', evidenceIds: [focus]}, facts, product.name, 'cta', focus), false)
  assert.equal(validateCommerceCopy({text: 'Nhấn sản phẩm để xem bộ dao màu kem.', evidenceIds: [focus]}, facts, product.name, 'cta', focus), true)
  const value = draft()
  const result = await analyze({...value, cta: value.scenes.at(-1), scenes: value.scenes.map((scene, index) => index === value.scenes.length - 1 ? {...scene, voice: 'Hãy chọn ngay bộ dao màu kem.'} : scene)})
  assert.equal(result.contentPlan.aiStatus?.state, 'completed')
  assert.equal(result.strategy.cta, value.scenes.at(-1)!.voice)
})

test('Image-generated claims about material and convenience cannot turn into trusted product facts', async () => {
  const value = draft()
  value.images[0].details.push({text: 'Chất liệu inox tiện lợi'})
  const result = await analyze(value)
  assert.ok(result.contentPlan.facts.every(fact => !/inox|tiện lợi/.test(fact.text)))
  assert.equal(result.contentPlan.facts.some(fact => fact.id === 'image-main-detail-3'), false)
  assert.equal(result.contentPlan.aiStatus?.state, 'completed')
})

test('A concrete buying question outranks a longer reading of the same color fact', () => {
  const sample = planAdaptiveVideo(product, 22, undefined, [{assetId: 'main', role: 'primary', source: 'vision', details: [{text: 'Bộ sản phẩm có màu trắng kem đồng bộ'}]}], focus)
  const hooks = [{id: 'need', text: 'Bạn đang tìm bộ dao màu trắng kem?', evidenceIds: [focus]}, {id: 'readout', text: 'Bộ sản phẩm có màu trắng kem đồng bộ.', evidenceIds: [focus]}]
  const ranked = rankCommerceHooks(hooks, {product, facts: sample.contentPlan.facts, scenes: sample.storyboard.scenes, images: sample.contentPlan.images, focusId: focus})
  assert.equal(ranked[0].id, 'need')
})

test('Unnamed accessories cannot displace a concrete visual focus or imply a complete set', () => {
  const sample = planAdaptiveVideo(product, 22, undefined, [{assetId: 'main', role: 'primary', source: 'vision', details: [{text: 'Đế cắm dao có màu kem'}, {text: 'Bộ dao Redchef gồm các dao và phụ kiện nhà bếp'}]}])
  assert.equal(sample.contentPlan.focusFactId, focus)
  assert.equal(validateCommerceCopy({text: 'Bộ dao có đầy đủ các phụ kiện nhà bếp.', evidenceIds: ['image-main-detail-2']}, sample.contentPlan.facts, product.name, 'body'), false)
})
