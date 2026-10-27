import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {POST} from '../src/app/api/engines/analyze/route'
import {analyzeProductForVideo} from '../src/lib/ai/product-video-analysis'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {automaticDuration, isVideoDurationSelection} from '../src/engines/planning/duration'
import {applySceneAudioTimings} from '../src/lib/video/scene-timing'
import type {ProductInput} from '../src/engines/core/types'

const product: ProductInput = {id: 'auto', name: 'Cáp A', category: 'tech', features: ['Dây dài 2 mét', 'Màu trắng'], assets: [{id: 'main', type: 'PRODUCT_IMAGE', url: '/fixture.jpg'}]}
function draft(suggestion: unknown = {seconds: 24, reason: 'Một nhu cầu, hai chi tiết có nguồn và lời mời xem sản phẩm.'}) {
  const base = planAdaptiveVideo(product)
  return {durationSuggestion: suggestion, focusFactId: 'fact-1', images: [],
    hookCandidates: [
      {headline: 'Dây dài 2 mét', text: 'Bạn đang tìm dây dài 2 mét?', evidenceIds: ['fact-1']},
      {headline: 'Xem chiều dài dây', text: 'Dây dài 2 mét cho nhu cầu của bạn.', evidenceIds: ['fact-1']},
      {headline: 'Chọn dây dài', text: 'Nếu cần dây dài 2 mét, bạn có thể xem mẫu này.', evidenceIds: ['fact-1']},
    ],
    scenes: base.storyboard.scenes.map(scene => ({headline: scene.headline, voice: scene.type === 'benefit' ? 'Mẫu này có màu trắng, đáng xem nếu bạn thích đồ cùng tông sáng.' : scene.voice, assetId: 'main', evidenceIds: scene.renderPlan!.evidenceIds, ctaLabel: scene.renderPlan?.ctaLabel})),
  }
}
const response = (value: unknown) => Response.json({candidates: [{content: {parts: [{text: JSON.stringify(value)}]}}]})
async function mocked(reply: (index: number, init?: RequestInit) => Response, run: (calls: () => number) => Promise<void>) {
  const original = globalThis.fetch, key = process.env.GEMINI_API_KEY
  let count = 0
  process.env.GEMINI_API_KEY = 'fixture-auto-key'
  globalThis.fetch = async (_url, init) => reply(++count, init)
  try {await run(() => count)} finally {globalThis.fetch = original; if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key}
}
const request = (targetDuration?: unknown) => new NextRequest('http://localhost/api/engines/analyze', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...product, targetDuration})})

test('Auto duration is content-aware, not a twenty-second minimum, and duplicate facts cannot inflate it', () => {
  const empty = automaticDuration([])
  const single = automaticDuration([{id: 'one', source: 'user_input', text: 'Màu trắng'}])
  const repeated = automaticDuration([{id: 'one', source: 'user_input', text: 'Màu trắng'}, {id: 'two', source: 'user_input', text: 'Màu trắng'}])
  assert.ok(empty.seconds < 20)
  assert.ok(single.seconds < 20)
  assert.equal(single.seconds, repeated.seconds)
  assert.equal(automaticDuration([{id: 'policy', source: 'user_input', text: 'Bảo hành 1 năm'}]).seconds, empty.seconds)
  for (const value of ['auto', 15, 22, 30, 45]) assert.equal(isVideoDurationSelection(value), true)
  for (const value of ['22', 0, 24, 60, true, null, {}, []]) assert.equal(isVideoDurationSelection(value), false)
})

test('Production analyze route accepts auto, requests duration and rationale in the same Gemini call, and retains manual options', async () => {
  await mocked((_index, init) => {
    const body = JSON.parse(String(init?.body))
    const schema = body.generationConfig.responseFormat.text.schema
    assert.ok(schema.required.includes('durationSuggestion'))
    assert.equal(schema.properties.durationSuggestion.properties.seconds.minimum, 12)
    assert.equal(schema.properties.durationSuggestion.properties.seconds.maximum, 45)
    assert.match(body.contents[0].parts[0].text, /THỜI LƯỢNG TỰ ĐỘNG/)
    assert.match(body.contents[0].parts[0].text, /không ép tối thiểu 20 giây/)
    return response(draft())
  }, async calls => {
    const result = await POST(request('auto'))
    assert.equal(result.status, 200)
    const body = await result.json()
    assert.equal(calls(), 1)
    assert.equal(body.contentPlan.durationPlan.mode, 'auto')
    assert.equal(body.contentPlan.durationPlan.source, 'gemini')
    assert.equal(body.contentPlan.durationPlan.modelSuggestedSeconds, 24)
    assert.match(body.contentPlan.durationPlan.reason, /hai chi tiết/)
    assert.ok(body.contentPlan.recommendedDuration >= 20 && body.contentPlan.recommendedDuration <= 30)
    assert.equal(body.contentPlan.durationPlan.suggestedSeconds, body.storyboard.totalDuration)
    assert.equal(body.strategy.targetDuration, body.storyboard.totalDuration)
  })
})

test('A manual target is never overwritten by the model duration suggestion; legacy requests still default to 22', async () => {
  await mocked((_index, init) => {
    const schema = JSON.parse(String(init?.body)).generationConfig.responseFormat.text.schema
    assert.ok(!schema.required.includes('durationSuggestion'))
    return response(draft({seconds: 45, reason: 'Đề xuất dài hơn nhưng người dùng đã chọn thủ công.'}))
  }, async () => {
    for (const target of [15, 22, 30, 45, undefined]) {
      const res = await POST(request(target))
      assert.equal(res.status, 200)
      const result = await res.json()
      assert.equal(result.contentPlan.durationPlan.mode, 'manual')
      assert.equal(result.contentPlan.durationPlan.requestedSeconds, target ?? 22)
      assert.ok(result.storyboard.totalDuration <= (target ?? 22))
    }
  })
})

test('Missing or invalid duration output retains valid AI copy and labels the duration as a local estimate', async () => {
  for (const value of [undefined, {seconds: 999, reason: 'Không hợp lệ'}, {seconds: 24, reason: ''}]) {
    const data = draft(value)
    if (value === undefined) delete (data as {durationSuggestion?: unknown}).durationSuggestion
    await mocked(() => response(data), async calls => {
      const result = await analyzeProductForVideo(product, 'fixture-key', 'auto')
      assert.equal(calls(), 1)
      assert.equal(result.contentPlan.source, 'gemini')
      assert.equal(result.contentPlan.durationPlan?.source, 'rules')
      assert.equal(result.contentPlan.durationPlan?.mode, 'auto')
      assert.ok(result.strategy.targetDuration <= 30)
      assert.equal(result.contentPlan.copySources?.script, 'gemini')
    })
  }
})

test('An extreme but syntactically valid model suggestion is bounded by the actual available content', async () => {
  await mocked(() => response(draft({seconds: 45, reason: 'Đề xuất nhiều thời gian để đọc các thông tin.'})), async calls => {
    const result = await analyzeProductForVideo(product, 'fixture-key', 'auto')
    assert.equal(calls(), 1)
    assert.equal(result.contentPlan.durationPlan?.source, 'gemini')
    assert.ok(result.strategy.targetDuration <= 30)
    assert.match(result.contentPlan.durationPlan!.reason, /cân lại/)
  })
})

test('Photo-first auto planning still uses just vision then writing; measured voice wins over the estimate', async () => {
  await mocked((index, init) => {
    const schema = JSON.parse(String(init?.body)).generationConfig.responseFormat.text.schema
    if (index === 1) {
      assert.ok(!schema.properties.durationSuggestion)
      return response({images: [{assetId: 'main', role: 'primary', details: [{text: 'Dây có tông màu trắng'}]}]})
    }
    assert.ok(schema.properties.durationSuggestion)
    return response(draft())
  }, async calls => {
    const result = await analyzeProductForVideo(product, 'fixture-key', 'auto', {images: [{assetId: 'main', dataUrl: 'data:image/jpeg;base64,YWJj'}]})
    assert.equal(calls(), 2)
    assert.equal(result.contentPlan.durationPlan?.source, 'gemini')
    const initial = result.contentPlan.durationPlan!.suggestedSeconds
    const timings = result.storyboard.scenes.map((scene, index) => ({segmentId: scene.id, durationSec: 4 + index}))
    const playback = applySceneAudioTimings(result.storyboard.scenes, timings)
    assert.equal(playback.reduce((sum, scene) => sum + scene.duration, 0), timings.reduce((sum, timing) => sum + timing.durationSec, 0))
    assert.equal(result.contentPlan.durationPlan!.suggestedSeconds, initial, 'The initial recommendation remains separate from measured audio')
  })
})

test('Gemini quota failures preserve auto fallback without another provider or a hard minimum', async () => {
  await mocked(() => new Response('', {status: 429}), async calls => {
    const result = await analyzeProductForVideo({...product, features: []}, 'fixture-key', 'auto')
    assert.equal(calls(), 1)
    assert.equal(result.contentPlan.aiStatus?.reason, 'quota')
    assert.equal(result.contentPlan.durationPlan?.source, 'rules')
    assert.equal(result.contentPlan.durationPlan?.mode, 'auto')
    assert.ok(result.strategy.targetDuration < 20)
  })
})

test('Invalid duration choices are rejected before any Gemini call', async () => {
  await mocked(() => {throw new Error('Unexpected AI request')}, async calls => {
    for (const value of [null, '30', 24, 60, true]) assert.equal((await POST(request(value))).status, 400)
    assert.equal(calls(), 0)
  })
})
