import test from 'node:test'
import assert from 'node:assert/strict'
import type {ProductInput} from '../src/engines/core/types'
import type {ProductFact} from '../src/engines/planning/types'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {validateCommerceCopy} from '../src/lib/ai/validate-commerce-copy'
import {analyzeProductForVideo} from '../src/lib/ai/product-video-analysis'
import {analyzeProductWithGemini, readImageInsights} from '../src/lib/ai/gemini'
import {VipeeSpeechDirector} from '../src/engines/speech/VipeeSpeechDirector'
import {salesWritingBudget} from '../src/lib/ai/sales-writing'
import {hasPriceOrDiscount} from '../src/engines/planning/product-facts'
import {hasExplicitNegation} from '../src/engines/planning/negation'

const asset = {id: 'main', type: 'PRODUCT_IMAGE' as const, url: '/product.jpg'}
const cable: ProductInput = {id: 'sales', name: 'Cáp USB-C', category: 'tech', features: ['Dây dài 2 mét', 'Màu trắng'], assets: [asset]}
const fact: ProductFact = {id: 'fact-1', text: 'Dây dài 2 mét', source: 'user_input'}

test('Vietnamese contains is not a negative fact; real negatives and incomplete conditionals stay protected', () => {
  assert.equal(hasExplicitNegation('Khoang chứa đồ'), false)
  assert.equal(hasExplicitNegation('Chưa hỗ trợ Bluetooth'), true)
  assert.equal(hasExplicitNegation('Không hỗ trợ Bluetooth'.normalize('NFD')), true)
  const stored: ProductFact = {id: 'storage', source: 'image', text: 'Khoang chứa đồ có đáy nan'}
  assert.equal(validateCommerceCopy({text: 'Nhấn sản phẩm để xem cấu tạo và giá hiện tại.', evidenceIds: ['storage']}, [stored], 'Kệ để đồ', 'cta', 'storage'), true)
  assert.equal(validateCommerceCopy({text: 'Nếu bạn cần khoang chứa đồ có đáy nan.', evidenceIds: ['storage']}, [stored], 'Kệ để đồ', 'hook', 'storage'), false)
  assert.equal(validateCommerceCopy({text: 'Bạn đang tìm kệ có khoang chứa đồ dạng nan?', evidenceIds: ['storage']}, [stored], 'Kệ để đồ', 'hook', 'storage'), true)
  const result = planAdaptiveVideo({id: 'storage', name: 'Kệ để đồ', category: 'home', features: ['Khoang chứa đồ có đáy nan'], assets: [asset]}, 30)
  assert.match(result.strategy.cta, /cấu tạo và giá hiện tại/)
})

test('Feature planning retains sourced construction over colour and cannot change focus after the copy request', async () => {
  const product: ProductInput = {id: 'construction', name: 'Đồ dùng mới', category: 'home', assets: [asset]}
  const insights = [{assetId: 'main', role: 'primary' as const, source: 'vision' as const, details: [{text: 'Thân sản phẩm màu đen'}, {text: 'Khoang chứa có đáy nan và miệng mở'}, {text: 'Khay đặt dưới đáy sản phẩm'}]}]
  const base = planAdaptiveVideo(product, 24, undefined, insights)
  assert.equal(base.contentPlan.angle, 'features')
  const focus = base.contentPlan.facts.find(f => f.id === base.contentPlan.focusFactId)!
  assert.match(focus.text, /Khoang|Khay/)
  const design = planAdaptiveVideo(product, 24, 'design', insights)
  assert.match(design.contentPlan.facts.find(f => f.id === design.contentPlan.focusFactId)!.text, /màu đen/)
  const original = globalThis.fetch
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body))
    assert.ok(request.generationConfig.responseFormat.text.schema.required.includes('focusFactId'))
    const scenes = base.storyboard.scenes.map(s => ({headline: s.headline, voice: s.voice, assetId: 'main', evidenceIds: s.renderPlan!.evidenceIds}))
    // Regression: older responses could omit focus and change angle to design.
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify({recommendedAngle: 'design', images: [], scenes})}]}}]})
  }
  try {
    const result = await analyzeProductWithGemini(product, 'fixture-key', 24, {insights})
    assert.equal(result.contentPlan.angle, base.contentPlan.angle)
    assert.equal(result.contentPlan.focusFactId, base.contentPlan.focusFactId)
    assert.ok(result.storyboard.scenes[1].renderPlan!.evidenceIds.includes(focus.id))
  } finally {globalThis.fetch = original}
})

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
  for (const text of ['Dao màu kem cắt ngọt và cầm chắc tay.', 'Dao màu kem chống gỉ, dễ vệ sinh.', 'Cán dao màu kem giúp cầm nắm thuận tay.']) {
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

test('Clean empty product evidence prevents displayed props from becoming facts, without removing occupied photos', () => {
  const submitted = [{assetId: 'main', dataUrl: 'data:image/jpeg;base64,YWJj'}, {assetId: 'empty', dataUrl: 'data:image/jpeg;base64,YWJj'}]
  const images = [{assetId: 'main', role: 'lifestyle', quality: 'clean', usageSpace: 'occupied-support', productBounds: {x: 10, y: 10, width: 80, height: 80}, details: [{text: 'Khăn lau treo trên thanh ngang phía trước', subject: 'product'}]}, {assetId: 'empty', role: 'primary', quality: 'clean', usageSpace: 'empty-support', details: [{text: 'Khoang trống có đáy nan đan chéo', subject: 'product'}]}]
  const read = readImageInsights({images}, submitted)
  assert.equal(read.length, 2)
  assert.deepEqual(read[0].details?.map(detail => detail.text), [''])
  assert.equal(read[1].details?.[0].text, 'Khoang trống có đáy nan đan chéo')
  const alone = readImageInsights({images: images.slice(0, 1)}, submitted)
  assert.equal(alone[0].details?.[0].text, images[0].details[0].text, 'do not discard the only available photo without an unobstructed alternative')
})

test('A literal body in the first slot is retained when the actual hook was supplied separately', async () => {
  const product: ProductInput = {id: 'opening', name: 'Đồ dùng bếp', category: 'home', features: ['Khoang chứa có đáy nan', 'Khay hứng nước phía dưới', 'Thanh treo ngang phía trước'], assets: [asset]}
  const base = planAdaptiveVideo(product, 30, 'features')
  const facts = base.contentPlan.facts
  const focus = facts.find(f => f.id === base.contentPlan.focusFactId)!
  const rest = facts.filter(f => f.id !== focus.id)
  const hook = {headline: 'Khoang đáy nan', text: 'Bạn đang tìm khoang chứa có đáy nan?', evidenceIds: [focus.id]}
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json({candidates: [{content: {parts: [{text: JSON.stringify({focusFactId: focus.id, hookCandidates: [hook], scenes: [focus, ...rest].map(f => ({headline: f.text, voice: f.text + '.', evidenceIds: [f.id], assetId: 'main'})).concat([{headline: 'Xem cấu tạo', voice: 'Nhấn sản phẩm để xem cấu tạo và giá hiện tại.', assetId: 'main', evidenceIds: [focus.id]}])})}]}}]})
  try {
    const result = await analyzeProductWithGemini(product, 'fixture-key', 30, {angle: 'features'})
    assert.equal(result.storyboard.scenes[0].type, 'hook')
    for (const f of facts) assert.ok(result.storyboard.scenes.slice(1, -1).some(s => s.renderPlan!.evidenceIds.includes(f.id)), `retain ${f.text}`)
    assert.ok(result.contentPlan.aiStatus?.review?.some(item => item.reason === 'separate-hook-from-body'))
  } finally {globalThis.fetch = original}
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
        {headline: 'Màu trắng', voice: 'Mẫu này có màu trắng.', assetId: 'main', evidenceIds: [fact.id]},
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

test('longer sales scripts add distinct sourced details instead of fixing every product to four scenes', () => {
  const facts: ProductFact[] = [
    {id: 'one', source: 'user_input', text: 'Màu kem'},
    {id: 'two', source: 'user_input', text: 'Bộ gồm 6 món'},
    {id: 'three', source: 'user_input', text: 'Ống đựng rộng 190 mm'},
    {id: 'four', source: 'user_input', text: 'Cán có các chấm tròn'},
  ]
  assert.equal(salesWritingBudget(facts, 22).sceneCount, 5)
  assert.equal(salesWritingBudget(facts, 30).sceneCount, 6)
  assert.equal(salesWritingBudget(facts, 15).sceneCount, 4)
  assert.equal(salesWritingBudget([facts[0], {...facts[0], id: 'duplicate'}], 30).sceneCount, 3)
  assert.equal(salesWritingBudget([{id: 'policy', source: 'user_input', text: 'Bảo hành 1 năm'}], 30).sceneCount, 3)
  assert.ok(salesWritingBudget(facts, 22).wordTarget > salesWritingBudget(facts, 15).wordTarget)
})

test('Vietnamese item counts are retained while actual price and discount text is rejected', () => {
  const text = 'Bộ gồm 6 món: 4 dao, 1 kéo và 1 ống đựng'
  const input = {...cable, name: 'Bộ dao', features: [text, 'Có 1 đế cắm và 2 kéo', 'Tải trọng 2 kg']}
  const result = planAdaptiveVideo(input, 22)
  assert.ok(result.contentPlan.facts.some(fact => fact.text === text))
  assert.equal(validateCommerceCopy({text, evidenceIds: ['bundle']}, [{id: 'bundle', text, source: 'user_input'}], 'Bộ dao', 'body'), true)
  for (const phrase of ['1 kéo', '1 đế cắm', '2 kg', '4 đinh tán']) assert.equal(hasPriceOrDiscount(phrase), false, phrase)
  for (const phrase of ['Giá 99k', 'Giá 99kđ', 'Giá 99 k₫', 'Giá 100.000đ', 'Giá 100000 đồng', 'Giá ₫100000', 'Giá 100000 VND', 'Giảm 20%']) assert.equal(hasPriceOrDiscount(phrase), true, phrase)
})

test('an overlong six-scene model response keeps grounded AI copy instead of discarding the whole script', async () => {
  const product: ProductInput = {...cable, name: 'Bộ đồ màu kem', features: ['Cán và ống đựng màu kem', 'Bộ gồm 6 món: 4 dao, 1 kéo và 1 ống đựng', 'Ống đựng cao 225 mm và rộng 190 mm', 'Cán có các chấm tròn']}
  const response = {
    images: [], focusFactId: 'fact-1',
    messagePlan: {viewerNeed: 'Bạn thích cán màu kem?', answer: 'Cán và ống đựng cùng màu kem.', evidenceIds: ['fact-1']},
    hookCandidates: [
      {headline: 'Bộ đồ màu kem', text: 'Bạn tìm bộ đồ có cán và ống đựng màu kem?', evidenceIds: ['fact-1']},
      {headline: 'Cán và ống màu kem', text: 'Cán và ống đựng cùng màu kem.', evidenceIds: ['fact-1']},
      {headline: 'Bạn thích màu kem?', text: 'Màu kem của cán và ống đựng có hợp bạn?', evidenceIds: ['fact-1']},
    ],
    scenes: [
      {headline: 'Bộ đồ màu kem', voice: 'Bạn tìm bộ đồ có cán và ống đựng màu kem?', assetId: 'main', evidenceIds: ['fact-1']},
      {headline: 'Cùng tông màu', voice: 'Phần cán và ống đựng có màu kem, một lựa chọn đáng xem nếu bạn thích đồ cùng tông màu kem cho gian bếp.', assetId: 'main', evidenceIds: ['fact-1']},
      {headline: 'Thành phần bộ', voice: 'Theo mô tả, bộ gồm 6 món với 4 dao, 1 kéo và 1 ống đựng.', assetId: 'main', evidenceIds: ['fact-2']},
      {headline: 'Kích thước ống đựng', voice: 'Ống đựng cao 225 mm và rộng 190 mm để bạn đối chiếu với chỗ đặt trước khi chọn.', assetId: 'main', evidenceIds: ['fact-3']},
      {headline: 'Chi tiết cán', voice: 'Nhìn gần phần cán, bạn sẽ thấy các chấm tròn xuất hiện trên cán của những món trong ảnh.', assetId: 'main', evidenceIds: ['fact-4']},
      {headline: 'Xem bộ đồ màu kem', voice: 'Nhấn sản phẩm để xem màu sắc, thành phần bộ và giá hiện tại nhé.', assetId: 'main', evidenceIds: ['fact-1']},
    ],
  }
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {calls++; return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(response)}]}}]})}
  try {
    const result = await analyzeProductWithGemini(product, 'fixture-key', 22, {angle: 'design'})
    assert.equal(calls, 1)
    assert.equal(result.contentPlan.source, 'gemini')
    assert.ok(result.storyboard.scenes.length <= 5)
    assert.ok(result.storyboard.scenes.some(scene => scene.renderPlan?.copySource === 'gemini'))
    assert.ok(result.contentPlan.aiStatus?.review?.some(item => item.reason === 'duration-budget'))
    assert.ok(result.storyboard.scenes.every(scene => /[.!?]$/.test(scene.voice)))
    assert.ok(result.contentPlan.facts.some(fact => fact.text.includes('1 kéo')))
  } finally {globalThis.fetch = original}
})
