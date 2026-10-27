import test from 'node:test'
import assert from 'node:assert/strict'
import type {ProductInput} from '../src/engines/core/types'
import type {ProductFact} from '../src/engines/planning/types'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {validateCommerceCopy} from '../src/lib/ai/validate-commerce-copy'
import {analyzeProductForVideo} from '../src/lib/ai/product-video-analysis'
import {analyzeProductWithGemini, readImageInsights} from '../src/lib/ai/gemini'
import {VipeeSpeechDirector} from '../src/engines/speech/VipeeSpeechDirector'

const asset = {id: 'main', type: 'PRODUCT_IMAGE' as const, url: '/product.jpg'}
const cable: ProductInput = {id: 'sales', name: 'Cáp USB-C', category: 'tech', features: ['Dây dài 2 mét', 'Màu trắng'], assets: [asset]}
const fact: ProductFact = {id: 'fact-1', text: 'Dây dài 2 mét', source: 'user_input'}

test('Fallback connects a sourced detail to a shopper preference across categories, without invented performance', () => {
  for (const sample of [
    {...cable, expected: /bố trí dây xa thiết bị/},
    {...cable, name: 'Áo cotton', category: 'fashion', features: ['Chất liệu cotton', 'Màu xanh'], expected: /ưu tiên chất liệu này/},
    {...cable, name: 'Bình nước', category: 'home', features: ['Dung tích 500 ml', 'Màu xanh'], expected: /dung tích này đúng nhu cầu/},
    {...cable, name: 'Nước hoa', category: 'perfume', features: ['Mùi hương gỗ', 'Dung tích 30 ml'], expected: /nhóm hương này/},
    {...cable, name: 'Bộ dao', category: 'home', features: ['Màu trắng sữa', 'Cán dao có đinh tán'], expected: /thích tông này/},
  ]) {
    const result = planAdaptiveVideo(sample, 22, 'features')
    const body = result.storyboard.scenes[1]
    assert.match(body.voice, sample.expected)
    assert.equal(validateCommerceCopy({text: body.voice, evidenceIds: body.renderPlan!.evidenceIds}, result.contentPlan.facts, sample.name, 'body'), true)
    assert.doesNotMatch(result.creativePlan.story, /cắt ngọt|chắc tay|chống gỉ|thoáng mát|giữ nhiệt|lưu hương lâu|đã dùng/i)
    assert.match(result.strategy.cta, /giá hiện tại/)
    assert.ok(!result.strategy.cta.includes(sample.features![0]), 'CTA should help decide rather than recite the full specification again')
    assert.equal(result.storyboard.scenes[0].voice, result.strategy.hook)
    assert.equal(result.contentPlan.message?.answer, body.voice)
  }
})

test('Decision CTAs may refer to the sourced attribute category and current price, while altered numbers/devices/claims still fail', () => {
  assert.equal(validateCommerceCopy({text: 'Nhấn sản phẩm để xem chiều dài và giá hiện tại nhé.', evidenceIds: [fact.id]}, [fact], cable.name, 'cta', fact.id), true)
  assert.equal(validateCommerceCopy({text: 'Xem chiều dài dây', evidenceIds: [fact.id]}, [fact], cable.name, 'cta-label', fact.id), true)
  for (const text of ['Nhấn sản phẩm xem chiều dài 3 mét.', 'Nhấn sản phẩm xem chiều dài 2 kg.', 'Nhấn sản phẩm xem kết nối Bluetooth.', 'Nhấn sản phẩm để xem dây sạc nhanh.', 'Nhấn sản phẩm để xem chiều dài, giá chỉ 9k.']) {
    assert.equal(validateCommerceCopy({text, evidenceIds: [fact.id]}, [fact], cable.name, 'cta', fact.id), false, text)
  }
  assert.equal(validateCommerceCopy({text: 'Nhấn sản phẩm xem chiều dài và giá hiện tại.', evidenceIds: []}, [fact], cable.name, 'cta', fact.id), false)
})

test('Only an explicitly included item supports a no-separate-purchase statement; a photo cannot establish the sold bundle', () => {
  const included: ProductFact = {id: 'bundle', source: 'user_input', text: 'Bộ dao kèm ống đựng'}
  const photo = {...included, source: 'image' as const, assetId: 'main', text: 'Ảnh có dao và ống đựng'}
  const voice = 'Bộ dao kèm ống đựng nên không phải mua riêng.'
  assert.equal(validateCommerceCopy({text: voice, evidenceIds: [included.id]}, [included], 'Bộ dao', 'body'), true)
  assert.equal(validateCommerceCopy({text: voice, evidenceIds: [photo.id]}, [photo], 'Bộ dao', 'body'), false)
  assert.equal(validateCommerceCopy({text: 'Dao màu kem, không phải mua riêng.', evidenceIds: ['color']}, [{id: 'color', text: 'Dao màu kem', source: 'user_input'}], 'Bộ dao', 'body'), false)
  for (const text of ['Dao màu kem cắt ngọt và cầm chắc tay.', 'Dao màu kem chống gỉ, dễ vệ sinh.']) {
    assert.equal(validateCommerceCopy({text, evidenceIds: ['color']}, [{id: 'color', text: 'Dao màu kem', source: 'image'}], 'Bộ dao', 'body'), false)
  }
})

test('Negative facts and sparse images do not acquire positive performance or bundle claims in fallback', () => {
  const negative = planAdaptiveVideo({...cable, features: ['Không hỗ trợ Bluetooth']}, 22, 'features')
  assert.match(negative.storyboard.scenes[1].voice, /Không hỗ trợ Bluetooth/)
  assert.doesNotMatch(negative.creativePlan.story, /bạn đang tìm kiểu kết nối này/)
  const sparse = planAdaptiveVideo({...cable, features: []}, 22)
  assert.equal(sparse.strategy.targetDuration, 12)
  assert.equal(sparse.contentPlan.facts.length, 0)
  assert.doesNotMatch(sparse.creativePlan.story, /sạc nhanh|không phải mua riêng|2 mét/)
})

test('A visual description cannot promote stability or cutting performance to a source fact', () => {
  const images = [{assetId: 'main', dataUrl: 'data:image/jpeg;base64,YWJj'}]
  const inspected = readImageInsights({images: [{assetId: 'main', role: 'primary', details: [{text: 'Đế cắm dao màu kem đứng vững'}, {text: 'Dao màu trắng cắt ngọt'}, {text: 'Cán dao có tông màu kem'}]}]}, images)
  assert.deepEqual(inspected[0].details?.map(detail => detail.text), ['', '', 'Cán dao có tông màu kem'])
})

test('A model putting a secondary detail first reuses its validated primary explanation in the same AI request', async () => {
  const original = globalThis.fetch
  let calls = 0
  const answer = 'Dây dài 2 mét, đáng cân nhắc nếu bạn cần bố trí dây xa thiết bị.'
  globalThis.fetch = async () => {
    calls++
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({
      focusFactId: fact.id, images: [],
      messagePlan: {viewerNeed: 'Bạn đang tìm dây dài 2 mét?', answer, evidenceIds: [fact.id]},
      hookCandidates: [{text: 'Bạn đang tìm dây dài 2 mét?', headline: 'Dây dài 2 mét', evidenceIds: [fact.id]}],
      scenes: [
        {headline: 'Dây dài 2 mét', voice: 'Bạn đang tìm dây dài 2 mét?', assetId: 'main', evidenceIds: [fact.id]},
        {headline: 'Màu trắng', voice: 'Mẫu này có màu trắng.', assetId: 'main', evidenceIds: ['fact-2']},
        {headline: 'Xem chiều dài', voice: 'Nhấn sản phẩm để xem chiều dài và giá hiện tại nhé.', assetId: 'main', evidenceIds: [fact.id]},
      ],
    })}]}}]})
  }
  try {
    const result = await analyzeProductWithGemini(cable, 'mock-key', 22)
    assert.equal(calls, 1)
    assert.equal(result.storyboard.scenes[1].voice, answer)
    assert.equal(result.storyboard.scenes[1].renderPlan?.copySource, 'gemini')
    assert.deepEqual(result.storyboard.scenes[1].renderPlan?.evidenceIds, [fact.id])
    assert.ok(result.contentPlan.aiStatus?.review?.some(item => item.reason === 'focus-from-message'))
  } finally {globalThis.fetch = original}
})

test('A persuasive AI headline reaches the spoken hook when the model repeats only a feature in all three text fields', async () => {
  const original = globalThis.fetch
  let calls = 0
  const sample = {...cable, name: 'Bộ dao', category: 'home', features: ['Bộ dao màu kem', 'Cán dao màu trắng']}
  const text = 'Bộ dao màu kem.'
  globalThis.fetch = async () => {
    calls++
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({
      images: [], focusFactId: fact.id,
      hookCandidates: ['Thích bếp tông kem?', 'Chọn bộ dao màu kem', 'Đang tìm bộ dao màu kem?'].map(headline => ({text, headline, evidenceIds: [fact.id]})),
      scenes: [
        {headline: 'Thích bếp tông kem?', voice: text, assetId: 'main', evidenceIds: [fact.id]},
        {headline: 'Chọn theo màu', voice: 'Bộ dao màu kem, đáng xem nếu bạn thích đồ cùng tông.', assetId: 'main', evidenceIds: [fact.id]},
        {headline: 'Chi tiết cán dao', voice: 'Cán dao có màu trắng.', assetId: 'main', evidenceIds: ['fact-2']},
        {headline: 'Xem màu', voice: 'Nhấn sản phẩm để xem màu và giá hiện tại.', assetId: 'main', evidenceIds: [fact.id]},
      ],
    })}]}}]})
  }
  try {
    const result = await analyzeProductWithGemini(sample, 'mock-key', 22)
    assert.equal(calls, 1)
    assert.match(result.strategy.hook, /^(?:Thích bếp tông kem|Đang tìm bộ dao màu kem)\?/)
    assert.equal(result.creativePlan.selectedHook?.source, 'gemini')
    assert.equal(result.storyboard.scenes[0].voice, result.strategy.hook)
    assert.equal(new Set(result.creativePlan.hookCandidates?.map(hook => hook.text)).size, 3)
  } finally {globalThis.fetch = original}
})

test('Natural narration may use the requested 22 seconds instead of being discarded at the old 18-second scene estimate', async () => {
  const original = globalThis.fetch
  let calls = 0
  const sample = {...cable, features: ['Ống cắm dao có màu be nhạt và chân đế trắng', 'Cán dao màu trắng'], name: 'Bộ dao', category: 'home'}
  globalThis.fetch = async () => {
    calls++
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({
      images: [], focusFactId: fact.id,
      hookCandidates: [{text: 'Bạn đang tìm ống cắm dao màu be nhạt và chân đế trắng?', headline: 'Ống cắm dao màu be', evidenceIds: [fact.id]}],
      scenes: [
        {headline: 'Ống cắm dao màu be', voice: 'Bạn đang tìm ống cắm dao màu be nhạt và chân đế trắng?', assetId: 'main', evidenceIds: [fact.id]},
        {headline: 'Chọn theo tông màu', voice: 'Ống cắm dao có màu be nhạt và chân đế trắng, đáng cân nhắc nếu bạn thích tông màu này.', assetId: 'main', evidenceIds: [fact.id]},
        {headline: 'Chi tiết cán dao', voice: 'Bên cạnh đó, phần cán dao có màu trắng để bạn xem rõ kiểu dáng trong ảnh.', assetId: 'main', evidenceIds: ['fact-2']},
        {headline: 'Xem màu và kiểu dáng', voice: 'Nếu thích tông màu này, bạn hãy mở sản phẩm để xem kiểu dáng và giá hiện tại.', assetId: 'main', evidenceIds: [fact.id]},
      ],
    })}]}}]})
  }
  try {
    const result = await analyzeProductWithGemini(sample, 'mock-key', 22)
    assert.equal(calls, 1)
    assert.equal(result.contentPlan.source, 'gemini')
    assert.equal(result.contentPlan.copySources?.script, 'gemini')
    assert.equal(result.contentPlan.copySources?.cta, 'gemini')
    assert.match(result.strategy.cta, /^Mở sản phẩm/)
    assert.match(result.strategy.cta, /giá hiện tại/)
    assert.equal(result.contentPlan.message?.nextStep, result.strategy.cta)
    assert.ok(result.strategy.targetDuration > 18 && result.strategy.targetDuration <= 22)
    assert.equal(result.storyboard.totalDuration, result.strategy.targetDuration)
  } finally {globalThis.fetch = original}
})

test('Both photo-first and text-only production paths keep natural sales narration, decision CTA and speech meaning in the final plan', async () => {
  const original = globalThis.fetch
  for (const withPhoto of [false, true]) {
    let calls = 0
    const authored = {
      images: [], focusFactId: fact.id,
      messagePlan: {viewerNeed: 'Bạn đang tìm dây dài 2 mét?', answer: 'Dây dài 2 mét, đáng cân nhắc nếu cần bố trí dây xa thiết bị.', evidenceIds: [fact.id]},
      hookCandidates: [
        {text: 'Bạn đang tìm dây dài 2 mét?', headline: 'Dây dài 2 mét', evidenceIds: [fact.id]},
        {text: 'Dây dài 2 mét cho nhu cầu của bạn?', headline: 'Chọn dây 2 mét', evidenceIds: [fact.id]},
        {text: 'Muốn bố trí dây xa thiết bị? Xem dây dài 2 mét.', headline: 'Bố trí dây 2 mét', evidenceIds: [fact.id]},
      ],
      cta: {headline: 'Xem chiều dài dây', voice: 'Nếu đang cần dây dài, nhấn sản phẩm xem chiều dài và giá hiện tại nhé.', assetId: 'main', evidenceIds: [fact.id], ctaLabel: 'Xem chiều dài dây'},
      scenes: [
        {headline: 'Dây dài 2 mét', voice: 'Bạn đang tìm dây dài 2 mét?', assetId: 'main', evidenceIds: [fact.id]},
        {headline: 'Bố trí dây theo nhu cầu', voice: 'Dây dài 2 mét, đáng cân nhắc nếu cần bố trí dây xa thiết bị.', assetId: 'main', evidenceIds: [fact.id]},
        {headline: 'Màu trắng', voice: 'Dây có màu trắng, thêm lựa chọn nếu bạn thích đồ tông sáng.', assetId: 'main', evidenceIds: ['fact-2']},
        {headline: 'Xem chiều dài dây', voice: 'Nhấn sản phẩm xem chiều dài và giá hiện tại.', assetId: 'main', evidenceIds: [fact.id]},
      ],
    }
    globalThis.fetch = async (_url, init) => {
      calls++
      const body = JSON.parse(String(init?.body))
      if (withPhoto && calls === 1) return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({images: [{assetId: 'main', role: 'primary', details: [{text: 'Dây có màu trắng'}]}]})}]}}]})
      const prompt = body.contents[0].parts[0].text
      assert.match(prompt, /NHU CẦU → LÝ DO CÂN NHẮC/)
      assert.match(prompt, /Tình huống gợi ý để biên tập, KHÔNG PHẢI nguồn tính năng mới/)
      assert.doesNotMatch(prompt, /voice BẮT ĐẦU|8–14 từ và cùng evidenceIds/)
      return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(authored)}]}}]})
    }
    try {
      const result = await analyzeProductForVideo(cable, 'mock-key', 22, {images: withPhoto ? [{assetId: 'main', dataUrl: 'data:image/jpeg;base64,YWJj'}] : []})
      assert.equal(calls, withPhoto ? 2 : 1)
      assert.deepEqual(result.contentPlan.copySources, {hooks: 'gemini', script: 'gemini', cta: 'gemini'})
      assert.equal(result.storyboard.scenes[1].voice, authored.scenes[1].voice)
      assert.equal(result.strategy.cta, authored.cta.voice)
      assert.equal(result.storyboard.scenes.at(-1)?.renderPlan?.ctaLabel, authored.cta.ctaLabel)
      assert.equal(result.contentPlan.message?.source, 'gemini')
      const speech = new VipeeSpeechDirector().createSpeechPlan({scenes: result.storyboard.scenes.map(scene => ({id: scene.id, voice: scene.voice, storyBeat: scene.type}))}, {voicePreset: 'Natural Friend'})
      assert.deepEqual(speech.segments.map(segment => segment.text), result.storyboard.scenes.map(scene => scene.voice))
      assert.match(speech.segments.at(-1)!.ttsScript || '', /giá hiện tại/)
      assert.equal(result.creativePlan.story, result.storyboard.scenes.map(scene => scene.voice).join(' '))
    } finally {globalThis.fetch = original}
  }
})
