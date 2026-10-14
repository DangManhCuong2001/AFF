import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'
import {analyzeProductWithGemini} from '../src/lib/ai/gemini'
import {VipeeVisualDirector} from '../src/engines/visual/VipeeVisualDirector'
import {InfographicEngine} from '../src/engines/infographic/InfographicEngine'
import {applySceneAudioTimings, parseSceneAudioTimings} from '../src/lib/video/scene-timing'
import type {ProductInput} from '../src/engines/core/types'

const product: ProductInput = {id: 'test', name: 'Tai nghe X', category: 'tech', features: ['Kết nối USB-C', 'Dây dài 1,2 mét'], assets: [{id: 'main', type: 'PRODUCT_IMAGE', url: '/main.jpg'}, {id: 'detail', type: 'DETAIL_IMAGE', url: '/detail.jpg'}]}

test('Sparse single-photo inputs stay short and do not invent utility claims', () => {
  const p = planAdaptiveVideo({...product, features: [], assets: [product.assets[0]]}, 45)
  assert.equal(p.contentPlan.format, 'design-showcase')
  assert.equal(p.strategy.targetDuration, 18)
  assert.equal(p.storyboard.scenes.length, 4)
  assert.ok(p.contentPlan.warnings.some((warning) => warning.includes('một ảnh')))
  assert.doesNotMatch(JSON.stringify(p), /freeship|gọn gàng 100%|bền đẹp|đã dùng|kháng khuẩn/i)
  assert.equal(p.storyboard.scenes.reduce((sum, scene) => sum + scene.duration, 0), 18)
})

test('Different categories preserve product facts and selected images', () => {
  for (const name of ['Váy linen', 'Nước hoa A', 'Bộ dao', 'Tai nghe X']) {
    const p = planAdaptiveVideo({...product, name}, 22)
    assert.equal(p.contentPlan.format, 'feature-explainer')
    assert.ok(p.storyboard.scenes.some((scene) => scene.voice === 'Kết nối USB-C'))
    assert.equal(p.storyboard.scenes[2].renderPlan?.assetId, 'detail')
    assert.equal(p.storyboard.scenes[2].renderPlan?.assetIndex, 1)
    assert.doesNotMatch(p.strategy.hook, /bừa bộn|nhà cửa|dọn dẹp/)
  }
})

test('Changing content angle rebuilds body and purpose, not just the hook', () => {
  const features = planAdaptiveVideo(product, 22, 'features')
  const fit = planAdaptiveVideo(product, 22, 'fit')
  assert.equal(fit.contentPlan.format, 'buying-guide')
  assert.notEqual(features.storyboard.scenes[2].voice, fit.storyboard.scenes[2].voice)
  assert.equal(fit.creativePlan.creativeScore, undefined)
})

test('Vision crop and evidence persist through director and infographic fallback', () => {
  const p = planAdaptiveVideo(product, 22, 'features', [{assetId: 'detail', role: 'detail', source: 'vision', observation: 'Có cổng USB-C trong ảnh', focus: {x: 20, y: 30, width: 40, height: 40}}])
  const speechTimings = p.storyboard.scenes.map((scene, index) => ({segmentId: scene.id, text: scene.voice, emotion: scene.type, startSec: index * 4, endSec: (index + 1) * 4, durationSec: 4}))
  const beats = new VipeeVisualDirector().createVisualStoryplan({scenes: p.storyboard.scenes, speechTimings, productImages: ['blob:main', 'blob:detail'], productName: product.name, category: product.category}).beats
  assert.equal(beats[2].layers.product.url, 'blob:detail')
  assert.equal(beats[2].plannedScene?.renderPlan?.crop?.x, 20)
  assert.ok(beats.every((beat) => beat.productVisible && !beat.offer && !beat.benefitChips?.length))
  const deck = new InfographicEngine().generateDeck({productName: product.name, price: 99_000, primaryImageUrl: 'blob:main', galleryImages: ['blob:main', 'blob:detail'], scenes: p.storyboard.scenes})
  assert.equal(deck.cards[2].productImageUrl, 'blob:detail')
  assert.ok(deck.cards.every((card) => !card.offer && !card.featureChips?.length && !card.hasHandInteraction))
  assert.equal(deck.cards.at(-1)?.headline, p.storyboard.scenes.at(-1)?.headline)
})

test('No images are reported rather than treated as product evidence', () => {
  const result = planAdaptiveVideo({...product, assets: []})
  assert.equal(result.contentPlan.inputMode, 'details-only')
  assert.ok(result.contentPlan.warnings.some((warning) => warning.includes('Chưa có ảnh')))
})

test('Audio durations override estimates by scene ID, and invalid headers are ignored', () => {
  const scenes = planAdaptiveVideo(product).storyboard.scenes
  const timings = parseSceneAudioTimings(JSON.stringify([{segmentId: scenes[1].id, durationSec: 5.2}, {segmentId: scenes[0].id, durationSec: -1}]))
  const output = applySceneAudioTimings(scenes, timings)
  assert.equal(output[1].duration, 5.2)
  assert.equal(output[0].duration, scenes[0].duration)
  assert.equal(scenes[1].duration !== 5.2, true)
  assert.deepEqual(parseSceneAudioTimings('{bad json'), [])
})

async function withMockResponse(value: unknown, fn: () => Promise<void>) {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify(value)}]}}]}), {status: 200})
  try { await fn() } finally { globalThis.fetch = original }
}

test('Malformed/ungrounded model output falls back to sourced scenes', async () => {
  await withMockResponse({images: [], scenes: [{headline: 'Số 1', voice: 'Mình đã dùng và thấy tốt nhất', assetId: 'unknown', evidenceIds: []}]}, async () => {
    const result = await analyzeProductWithGemini(product, 'test-key', 22)
    assert.equal(result.contentPlan.source, 'rules')
    assert.doesNotMatch(result.storyboard.scenes.map((scene) => scene.voice).join(' '), /đã dùng|tốt nhất/)
    assert.ok(result.contentPlan.warnings.some((warning) => warning.includes('hợp lệ')))
  })
})

test('Valid model response binds known evidence and ignores observations of unseen images', async () => {
  const base = planAdaptiveVideo(product, 22)
  const value = {images: [{assetId: 'detail', role: 'detail', observation: 'Cổng không có thật', focus: {x: 0, y: 0, width: 50, height: 50}}], scenes: base.storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice, assetId: scene.renderPlan!.assetId, evidenceIds: scene.renderPlan!.evidenceIds}))}
  await withMockResponse(value, async () => {
    const result = await analyzeProductWithGemini(product, 'test-key', 22)
    assert.equal(result.contentPlan.source, 'gemini')
    assert.ok(result.contentPlan.images.every((image) => image.source === 'metadata'))
    assert.equal(result.storyboard.scenes[2].renderPlan?.assetId, 'detail')
  })
})

test('Out-of-bounds vision crops are rejected', async () => {
  const base = planAdaptiveVideo(product)
  const value = {images: [{assetId: 'main', role: 'primary', focus: {x: 80, y: 0, width: 50, height: 100}}], scenes: base.storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice, assetId: scene.renderPlan!.assetId, evidenceIds: scene.renderPlan!.evidenceIds}))}
  await withMockResponse(value, async () => {
    const result = await analyzeProductWithGemini(product, 'test-key')
    assert.equal(result.contentPlan.source, 'rules')
    assert.ok(result.storyboard.scenes.every((scene) => !scene.renderPlan?.crop))
  })
})

 test('Decimal specifications remain intact in sourced statements', () => {
  const result = planAdaptiveVideo({...product, features: ['Bluetooth 5.3', 'Kích thước 1.2 mét']})
  assert.ok(result.contentPlan.facts.some((fact) => fact.text === 'Bluetooth 5.3'))
  assert.ok(result.contentPlan.facts.some((fact) => fact.text === 'Kích thước 1.2 mét'))
})

test('Vision sees only submitted photos and supplies validated whole-product bounds', async () => {
  const base = planAdaptiveVideo(product, 22)
  const value = {images: [{assetId: 'main', role: 'primary', observation: 'Tay cầm màu đen', productBounds: {x: 10, y: 10, width: 80, height: 80}}], scenes: base.storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice, assetId: scene.renderPlan!.assetId, evidenceIds: scene.renderPlan!.evidenceIds}))}
  const original = globalThis.fetch
  let receivedImage = false
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(String(init?.body))
    receivedImage = payload.contents[0].parts.some((part: {inlineData?: {mimeType: string}}) => part.inlineData?.mimeType === 'image/jpeg')
    return new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify(value)}]}}]}), {status: 200})
  }
  try {
    const result = await analyzeProductWithGemini(product, 'test-key', 22, {images: [{assetId: 'main', dataUrl: 'data:image/jpeg;base64,YWJj'}]})
    assert.equal(receivedImage, true)
    assert.equal(result.contentPlan.images[0].source, 'vision')
    assert.equal(result.storyboard.scenes[0].renderPlan?.crop?.x, 10)
    assert.equal(result.contentPlan.source, 'gemini')
  } finally {globalThis.fetch = original}
})

 test('Context asset survives the standard director and audio timing updates', async () => {
  const {attachContextImage, getContextImage} = await import('../src/lib/ai/context-scenes')
  const original = planAdaptiveVideo(product).storyboard.scenes
  const scenes = attachContextImage(original, 'data:image/jpeg;base64,YWJj')
  assert.equal(getContextImage(scenes), 'data:image/jpeg;base64,YWJj')
  assert.equal(scenes[1].renderPlan?.contextImageUrl, undefined)
  assert.equal(original[0].renderPlan?.contextImageUrl, undefined)
  const timed = applySceneAudioTimings(scenes, [{segmentId: scenes[0].id, durationSec: 3.5}])
  const beats = new VipeeVisualDirector().createVisualStoryplan({scenes: timed, speechTimings: timed.map((scene, i) => ({segmentId: scene.id, text: scene.voice, emotion: scene.type, startSec: i * 4, endSec: i * 4 + scene.duration, durationSec: scene.duration})), productImages: ['main', 'detail'], productName: product.name, category: 'tech'}).beats
  assert.equal(beats[0].plannedScene?.renderPlan?.contextImageUrl, getContextImage(scenes))
  assert.equal(beats.at(-1)?.plannedScene?.renderPlan?.contextImageUrl, getContextImage(scenes))
})

async function withCloudflare(fn: () => Promise<void>) {
  const savedId = process.env.CLOUDFLARE_ACCOUNT_ID
  const savedToken = process.env.CLOUDFLARE_API_TOKEN
  process.env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32)
  process.env.CLOUDFLARE_API_TOKEN = 'test-cloudflare-token'
  try {await fn()} finally {
    if (savedId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = savedId
    if (savedToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = savedToken
  }
}

async function contextFixture() {
  const sharp = createRequire(require.resolve('next/package.json'))('sharp')
  const png = await sharp({create: {width: 1000, height: 1500, channels: 3, background: '#eeeeee'}}).png().toBuffer()
  return {sharp, png, reference: {assetId: 'main', dataUrl: `data:image/png;base64,${png.toString('base64')}`}}
}

test('Cloudflare uses real reference multipart, compresses output, deduplicates and caches success', async () => {
  await withCloudflare(async () => {
    const {generateContextImage} = await import('../src/lib/ai/context-image')
    const {sharp, png, reference} = await contextFixture()
    const original = globalThis.fetch
    let calls = 0
    globalThis.fetch = async (url, init) => {
      calls++
      assert.equal(String(url), `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`)
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-cloudflare-token')
      assert.equal(new Headers(init?.headers).has('Content-Type'), false)
      assert.equal(new Headers(init?.headers).has('x-goog-api-key'), false)
      const body = init?.body as FormData
      assert.equal(body.get('width'), '768')
      assert.equal(body.get('height'), '1344')
      assert.match(String(body.get('prompt')), /authoritative product reference/)
      const file = body.get('input_image_0') as Blob
      const dimensions = await sharp(Buffer.from(await file.arrayBuffer())).metadata()
      assert.ok(dimensions.width < 512 && dimensions.height < 512)
      return new Response(JSON.stringify({success: true, result: {image: png.toString('base64')}}), {status: 200})
    }
    try {
      const [image, same] = await Promise.all([generateContextImage('Test Cloudflare caching', 'tech', reference), generateContextImage('Test Cloudflare caching', 'tech', reference)])
      assert.equal(image, same)
      assert.ok(image.startsWith('data:image/jpeg;base64,'))
      assert.ok(image.length < 600_100)
      assert.equal(await generateContextImage('Test Cloudflare caching', 'tech', reference), image)
      assert.equal(calls, 1)
    } finally {globalThis.fetch = original}
  })
})

test('Cloudflare exhausted free quota makes one call with no paid fallback; failed requests can be retried', async () => {
  await withCloudflare(async () => {
    const {generateContextImage} = await import('../src/lib/ai/context-image')
    const {reference} = await contextFixture()
    const original = globalThis.fetch
    let calls = 0
    globalThis.fetch = async (url) => {
      calls++
      assert.ok(String(url).startsWith('https://api.cloudflare.com/'))
      return new Response(JSON.stringify({success: false, errors: [{code: 3036, message: 'daily free allocation exhausted'}]}), {status: 429})
    }
    try {
      await assert.rejects(generateContextImage('Test exhausted Cloudflare', 'home', reference), (error: unknown) => (error as {code: string}).code === 'QUOTA_UNAVAILABLE')
      assert.equal(calls, 1)
      await assert.rejects(generateContextImage('Test exhausted Cloudflare', 'home', reference))
      assert.equal(calls, 2)
    } finally {globalThis.fetch = original}
  })
})

test('Cloudflare daily quota and temporary capacity errors are distinct', async () => {
  const {contextQuotaError} = await import('../src/lib/ai/context-errors')
  const exhausted = contextQuotaError(429, {errors: [{code: 3036}]})
  assert.equal(exhausted?.code, 'QUOTA_UNAVAILABLE')
  assert.equal(exhausted?.retryable, false)
  assert.match(exhausted!.message, /7 giờ sáng/)
  assert.equal(contextQuotaError(429, {errors: [{code: 3040}]})?.code, 'RATE_LIMITED')
  assert.equal(contextQuotaError(429, {})?.retryable, true)
  assert.equal(contextQuotaError(500, {}), undefined)
})

test('Missing Cloudflare config fails before any network call even if Gemini is configured', async () => {
  await withCloudflare(async () => {
    const {generateContextImage} = await import('../src/lib/ai/context-image')
    delete process.env.CLOUDFLARE_API_TOKEN
    const original = globalThis.fetch
    globalThis.fetch = async () => {throw new Error('Unexpected network call')}
    try {
      await assert.rejects(generateContextImage('Missing config', 'home', {assetId: 'main', dataUrl: 'data:image/png;base64,YWJj'}), (error: unknown) => (error as {code: string}).code === 'CONFIGURATION_REQUIRED')
    } finally {globalThis.fetch = original}
  })
})

test('Cloudflare auth errors and invalid outputs do not leak token or call another provider', async () => {
  await withCloudflare(async () => {
    const {generateContextImage} = await import('../src/lib/ai/context-image')
    const {reference} = await contextFixture()
    const original = globalThis.fetch
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      return new Response(JSON.stringify({success: false, errors: [{message: 'test-cloudflare-token'}]}), {status: 403})
    }
    try {
      await assert.rejects(generateContextImage('Test Cloudflare auth', 'home', reference), (error: unknown) => {
        const e = error as {code: string; message: string}
        return e.code === 'CONFIGURATION_REQUIRED' && !e.message.includes('test-cloudflare-token')
      })
      assert.equal(calls, 1)
      globalThis.fetch = async () => new Response(JSON.stringify({success: true, result: {image: 'not-an-image'}}), {status: 200})
      await assert.rejects(generateContextImage('Test invalid Cloudflare response', 'home', reference), /chưa trả ảnh/)
    } finally {globalThis.fetch = original}
  })
})
