import test from 'node:test'
import assert from 'node:assert/strict'
import {collectProductFacts, planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {equivalentCopy, removeRepeatedScenes} from '../src/engines/planning/copy-novelty'
import {analyzeProductWithGemini} from '../src/lib/ai/gemini'
import {VipeeVisualDirector} from '../src/engines/visual/VipeeVisualDirector'
import type {ProductInput} from '../src/engines/core/types'

const product: ProductInput = {id: 'test', name: 'Tai nghe', category: 'tech', features: ['Kết nối USB-C', 'Dây dài 1,2 mét'], assets: [{id: 'main', type: 'PRODUCT_IMAGE', url: '/main.jpg'}, {id: 'detail', type: 'DETAIL_IMAGE', url: '/detail.jpg'}]}

test('Repeated facts cannot inflate scene count; measurements and negatives remain distinct', () => {
  assert.equal(equivalentCopy('Dây dài 1,2 mét', 'Dây có chiều dài 1.2m.'), true)
  assert.equal(equivalentCopy('Dây dài 1,2 mét', 'Dây dài 12 mét'), false)
  assert.equal(equivalentCopy('Hỗ trợ Bluetooth', 'Không hỗ trợ Bluetooth'), false)
  assert.equal(equivalentCopy('Không hỗ trợ Bluetooth, có USB-C', 'Có Bluetooth, không hỗ trợ USB-C'), false)
  assert.equal(equivalentCopy('Cáp kết nối thiết bị trong bộ sản phẩm này dành cho iPhone', 'Cáp kết nối thiết bị trong bộ sản phẩm này dành cho Android'), false)
  const repeated = {...product, features: ['Dây dài 1,2 mét', 'Dây có chiều dài 1.2m.', 'Dây dài 12 mét', 'Hỗ trợ Bluetooth', 'Không hỗ trợ Bluetooth']}
  assert.equal(collectProductFacts(repeated).length, 4)
  const sparse = planAdaptiveVideo({...product, features: ['Dây dài 1,2 mét', 'Dây có chiều dài 1.2m.']}, 40)
  assert.equal(sparse.storyboard.scenes.length, 3)
  assert.ok(sparse.strategy.targetDuration <= 14)
  assert.equal(planAdaptiveVideo(product).storyboard.scenes.length, 4)
})

test('Buying priorities vary by category and never turn absent criteria into product claims', () => {
  for (const sample of [
    {category: 'fashion', features: ['Màu đen', 'Vải cotton', 'Form rộng'], expected: 'Vải cotton'},
    {category: 'tech', features: ['Màu đen', 'Công suất 20W', 'Kết nối USB-C'], expected: 'Kết nối USB-C'},
    {category: 'beauty', features: ['Vỏ nhựa', 'Thành phần niacinamide', 'Dung tích 30ml'], expected: 'Thành phần niacinamide'},
    {category: 'perfume', features: ['Dung tích 50ml', 'Nồng độ EDP', 'Mùi hương hoa'], expected: 'Mùi hương hoa'},
    {category: 'home', name: 'Hộp đựng', features: ['Màu kem', 'Kích thước 20cm', 'Chất liệu inox'], expected: 'Kích thước 20cm'},
  ]) {
    const result = planAdaptiveVideo({...product, ...sample})
    assert.equal(result.contentPlan.buyingProfile?.id, sample.category)
    assert.equal(result.contentPlan.primaryBuyingReason, sample.expected)
    assert.ok(result.contentPlan.facts.every((fact) => sample.features.includes(fact.text)))
  }
  const sparse = planAdaptiveVideo({...product, category: 'fashion', features: ['Màu đen']})
  assert.doesNotMatch(sparse.creativePlan.story, /cotton|linen|co giãn|thoáng|size S/i)
  const defaultCategory = planAdaptiveVideo({...product, category: 'home', name: 'Tai nghe USB-C', features: ['Màu đen', 'Kết nối USB-C']})
  assert.equal(defaultCategory.contentPlan.buyingProfile?.id, 'tech')
  assert.equal(defaultCategory.contentPlan.primaryBuyingReason, 'Kết nối USB-C')
  assert.equal(planAdaptiveVideo({...product, category: 'home', name: 'Sơn màu trắng'}).contentPlan.buyingProfile?.id, 'home')
})

test('Same evidence may explain a new attribute; repeated paraphrases and filler questions are removed', () => {
  const base = planAdaptiveVideo({...product, features: ['Vải cotton, form rộng']})
  const hero = base.storyboard.scenes[1]
  const repeat = {...hero, id: 'repeat', voice: 'Mẫu này có vải cotton.'}
  const newDetail = {...hero, id: 'new', voice: 'Form rộng.', type: 'benefit' as const}
  const initial = {...hero, voice: 'Vải cotton.'}
  const question = {...hero, id: 'question', voice: 'Bạn chọn vải cotton?', type: 'benefit' as const}
  const result = removeRepeatedScenes([base.storyboard.scenes[0], initial, repeat, newDetail, question, base.storyboard.scenes.at(-1)!], base.contentPlan.facts)
  assert.equal(result.removed, 2)
  assert.deepEqual(result.scenes.map((scene) => scene.id), [base.storyboard.scenes[0].id, initial.id, 'new', base.storyboard.scenes.at(-1)!.id])
})

test('Gallery, specification and detail layouts keep source identity through actual rendering props', () => {
  const full = {x: 5, y: 10, width: 90, height: 80}
  const focus = {x: 25, y: 30, width: 40, height: 30}
  const result = planAdaptiveVideo(product, 22, 'features', [{assetId: 'detail', role: 'detail', source: 'vision', observation: 'Cổng USB-C màu đen', focus, productBounds: full}])
  assert.equal(result.storyboard.scenes[0].renderPlan?.layout, 'hero')
  assert.equal(result.storyboard.scenes[1].renderPlan?.layout, 'gallery')
  const cable = result.storyboard.scenes.find((scene) => scene.voice === 'Dây dài 1,2 mét')!
  assert.equal(cable.renderPlan?.layout, 'spec')
  assert.equal(cable.renderPlan?.spec?.value, 'Dây dài 1,2 mét')
  assert.equal(cable.renderPlan?.crop, undefined)
  const closeup = result.storyboard.scenes.find((scene) => scene.renderPlan?.layout === 'detail')!
  assert.deepEqual(closeup.renderPlan?.crop, focus)
  assert.deepEqual(closeup.renderPlan?.fullProductCrop, full)
  let cursor = 0
  const timings = result.storyboard.scenes.map((scene) => {const startSec = cursor; cursor += scene.duration; return {segmentId: scene.id, text: scene.voice, emotion: scene.type, startSec, endSec: cursor, durationSec: scene.duration}})
  const beats = new VipeeVisualDirector().createVisualStoryplan({scenes: result.storyboard.scenes, speechTimings: timings, productImages: ['blob:main', 'blob:detail'], productName: product.name, category: product.category}).beats
  const hero = beats[1]
  const primaryIndex = hero.plannedScene!.renderPlan!.assetIndex
  assert.equal(hero.layers.product.url, ['blob:main', 'blob:detail'][primaryIndex])
  assert.equal(hero.secondaryImageUrl, ['blob:main', 'blob:detail'][hero.plannedScene!.renderPlan!.secondaryAsset!.assetIndex])
  const duplicate = planAdaptiveVideo({...product, assets: [product.assets[0], {...product.assets[1], url: '/main.jpg'}]})
  assert.ok(duplicate.storyboard.scenes.every((scene) => scene.renderPlan?.layout !== 'gallery'))
})

test('Gemini scenes are shortened locally without a second API call and all plan summaries stay consistent', async () => {
  const base = planAdaptiveVideo(product)
  const scenes = base.storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice, assetId: scene.renderPlan!.assetId, evidenceIds: scene.renderPlan!.evidenceIds}))
  scenes.splice(2, 0, {...scenes[1], voice: 'Mẫu này có kết nối USB-C.'})
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, init) => {
    calls++
    assert.match(JSON.parse(String(init?.body)).contents[0].parts[0].text, /Tiêu chí chọn mua theo nhóm hàng/)
    return new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify({images: [], scenes})}]}}]}))
  }
  try {
    const result = await analyzeProductWithGemini(product, 'mock-key')
    assert.equal(calls, 1)
    assert.equal(result.contentPlan.source, 'gemini')
    assert.equal(result.storyboard.scenes.length, 4)
    assert.equal(result.creativePlan.totalScenes, 4)
    assert.equal(result.creativePlan.spokenScenes?.length, 4)
    assert.equal(new Set(result.storyboard.scenes.map((scene) => scene.id)).size, 4)
    assert.equal(result.storyboard.totalDuration, result.strategy.targetDuration)
    assert.equal(result.contentPlan.recommendedDuration, result.strategy.targetDuration)
    assert.equal(result.creativePlan.story, result.storyboard.scenes.map((scene) => scene.voice).join(' '))
    assert.ok(result.contentPlan.warnings.some((warning) => warning.includes('cảnh lặp')))
  } finally {globalThis.fetch = original}
})
