import test from 'node:test'
import assert from 'node:assert/strict'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {rankCommerceHooks, hookIsAnswered} from '../src/engines/planning/hook-ranking'
import {buildCommerceMessage} from '../src/engines/planning/message-plan'
import {analyzeProductWithGemini} from '../src/lib/ai/gemini'
import type {ProductInput} from '../src/engines/core/types'

const product: ProductInput = {id: 'test', name: 'Tai nghe X', category: 'tech', features: ['Kết nối USB-C', 'Dây dài 1,2 mét'], assets: [{id: 'main', type: 'PRODUCT_IMAGE', url: '/main.jpg'}]}
function authored() {
  const base = planAdaptiveVideo(product)
  return {
    images: [], focusFactId: 'fact-1',
    messagePlan: {viewerNeed: 'Bạn cần tai nghe kết nối USB-C?', answer: 'Mẫu tai nghe này dùng kết nối USB-C.', evidenceIds: ['fact-1']},
    hookCandidates: [
      {headline: 'Chọn tai nghe USB-C', text: 'Chọn tai nghe? Xem kết nối USB-C.', evidenceIds: ['fact-1']},
      {headline: 'Cần kết nối USB-C?', text: 'Cần tai nghe kết nối USB-C?', evidenceIds: ['fact-1']},
      {headline: 'Đối chiếu đầu kết nối', text: 'Đối chiếu cổng USB-C trước khi chọn tai nghe.', evidenceIds: ['fact-1']},
    ],
    scenes: base.storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice, assetId: scene.renderPlan!.assetId, evidenceIds: scene.renderPlan!.evidenceIds, ctaLabel: scene.renderPlan!.ctaLabel})),
  }
}
async function withResponse(value: unknown, inspect: (result: Awaited<ReturnType<typeof analyzeProductWithGemini>>, calls: number) => void) {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, init) => {
    calls++
    assert.match(JSON.parse(String(init?.body)).contents[0].parts[0].text, /messagePlan/)
    return new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify(value)}]}}]}))
  }
  try {inspect(await analyzeProductWithGemini(product, 'test-key'), calls)} finally {globalThis.fetch = original}
}

test('The strongest supported AI hook can be the second proposal, selected in one request', async () => {
  const value = authored()
  await withResponse(value, (result, calls) => {
    assert.equal(calls, 1)
    assert.equal(result.strategy.hook, value.hookCandidates[1].text)
    assert.equal(result.storyboard.scenes[0].voice, value.hookCandidates[1].text)
    assert.equal(result.creativePlan.selectedHook?.headline, value.hookCandidates[1].headline)
    assert.equal(result.creativePlan.selectedHook?.source, 'gemini')
    assert.equal(result.creativePlan.hookCandidates?.length, 3)
    assert.ok(result.creativePlan.hookCandidates!.every((hook) => hook.source === 'gemini'))
    assert.deepEqual(result.contentPlan.message?.evidenceIds, ['fact-1'])
    assert.equal(result.contentPlan.message?.viewerNeed, value.messagePlan.viewerNeed)
    assert.equal(result.contentPlan.message?.answer, value.messagePlan.answer)
    assert.equal(result.contentPlan.message?.source, 'gemini')
    assert.equal(result.contentPlan.message?.nextStep, result.strategy.cta)
    assert.ok(result.contentPlan.message?.proof.every((proof) => result.storyboard.scenes.some((scene) => scene.id === proof.sceneId)))
  })
})

test('A sourced hook is still rejected if the final body does not answer its extra promise', async () => {
  const value = authored()
  value.scenes.splice(2, 1) // The cable specification is absent from this short edit.
  value.hookCandidates[1] = {headline: 'Dây 1,2 mét?', text: 'Cần tai nghe USB-C, dây dài 1,2 mét?', evidenceIds: ['fact-1', 'fact-2']}
  await withResponse(value, (result, calls) => {
    assert.equal(calls, 1)
    assert.ok(result.creativePlan.hookCandidates!.every((hook) => !hook.text.includes('1,2')))
    assert.equal(result.storyboard.scenes.length, 3)
  })
})

test('A malformed or invented message falls back locally while valid authored scenes survive', async () => {
  for (const draft of [{viewerNeed: 'Bạn cần USB-C?', answer: 'Kết nối Bluetooth.', evidenceIds: ['missing']}, {bad: true}]) {
    const value = {...authored(), messagePlan: draft}
    await withResponse(value, (result, calls) => {
      assert.equal(calls, 1)
      assert.equal(result.contentPlan.source, 'gemini')
      assert.equal(result.contentPlan.message?.source, 'rules')
      assert.equal(result.contentPlan.message?.answer, result.storyboard.scenes[1].voice)
      assert.doesNotMatch(result.contentPlan.message!.answer, /Bluetooth/)
    })
  }
})

test('An unanswered opening is repaired with a sourced body sentence without another AI call', async () => {
  const value = authored()
  value.scenes[1].voice = 'Bạn cần kết nối USB-C?'
  await withResponse(value, (result, calls) => {
    assert.equal(calls, 1)
    assert.equal(result.storyboard.scenes[1].voice, value.messagePlan.answer)
    assert.equal(result.storyboard.scenes[1].renderPlan?.copySource, 'gemini')
    assert.equal(hookIsAnswered(result.creativePlan.selectedHook, result.contentPlan.facts, result.storyboard.scenes), true)
  })
})

test('Photos are illustration for visible details, not proof of material or numeric specifications', () => {
  const sample = {...product, assets: [...product.assets, {...product.assets[0], id: 'second', url: '/second.jpg'}, {...product.assets[0], id: 'third', url: '/third.jpg'}], features: ['Dây dài 1,2 mét', 'Chất liệu cotton', 'Màu đen']}
  const result = planAdaptiveVideo(sample, 40, 'features', [{assetId: 'main', role: 'primary', source: 'vision', observation: 'Dây 1,2 mét, màu đen, cotton'}])
  const message = buildCommerceMessage(sample, result.contentPlan.facts, result.storyboard.scenes, result.contentPlan.images, result.contentPlan.focusFactId)
  assert.equal(message.proof.find((proof) => proof.factId === 'fact-1')?.kind, 'description')
  assert.equal(message.proof.find((proof) => proof.factId === 'fact-2')?.kind, 'description')
  assert.equal(message.proof.find((proof) => proof.factId === 'fact-3')?.kind, 'image')
})

test('Hook scoring stays deterministic, rejects fake urgency and preserves the caller input', () => {
  const base = planAdaptiveVideo(product)
  const candidates = authored().hookCandidates.map((hook, index) => ({...hook, id: `h${index}`}))
  candidates.push({...candidates[0], id: 'unsafe', text: 'Tai nghe USB-C bán chạy, mua ngay kẻo hết hàng!'})
  const snapshot = structuredClone(candidates)
  const context = {product, facts: base.contentPlan.facts, scenes: base.storyboard.scenes, images: base.contentPlan.images, focusId: 'fact-1'}
  const ranked = rankCommerceHooks(candidates, context)
  assert.equal(ranked[0].id, 'h1')
  assert.ok(ranked.every((hook) => hook.id !== 'unsafe'))
  assert.deepEqual(rankCommerceHooks(candidates, context), ranked)
  assert.deepEqual(candidates, snapshot)
})

test('Body evidence IDs alone cannot fulfill a missing numeric specification', () => {
  const base = planAdaptiveVideo({...product, features: ['Kích thước 20 cm']})
  const body = base.storyboard.scenes.map((scene) => scene.type === 'product_hero' ? {...scene, voice: 'Mẫu này có thông tin kích thước.'} : scene)
  assert.equal(hookIsAnswered({text: 'Bạn cần kích thước 20cm?', evidenceIds: ['fact-1']}, base.contentPlan.facts, body), false)
})
