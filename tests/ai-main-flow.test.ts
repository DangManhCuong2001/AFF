import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {analyzeProductWithGemini} from '../src/lib/ai/gemini'
import {isAllowedProductImageUrl} from '../src/lib/ai/remote-image-url'
import {loadRemoteAnalysisImage} from '../src/lib/ai/remote-image'
import {loadProductImageBlob, prepareAnalysisImages} from '../src/lib/ai/prepare-images'
import type {ProductInput} from '../src/engines/core/types'

const product: ProductInput = {id: 'main-flow', name: 'Tai nghe X', category: 'tech', features: ['Kết nối USB-C', 'Dây dài 1,2 mét'], assets: [{id: 'main', type: 'PRODUCT_IMAGE', url: '/main.jpg'}, {id: 'detail', type: 'DETAIL_IMAGE', url: '/detail.jpg'}]}
const images = [{assetId: 'main', dataUrl: 'data:image/jpeg;base64,YWJj'}]
function authored() {
  return {
    recommendedAngle: 'features', focusFactId: 'fact-1',
    images: [{assetId: 'main', role: 'primary', observation: 'Dây màu đen', productBounds: {x: 10, y: 10, width: 80, height: 80}}],
    hookCandidates: [
      {headline: 'Chọn tai nghe USB-C', text: 'Bạn đang chọn tai nghe USB-C?', evidenceIds: ['fact-1']},
      {headline: 'Đối chiếu cổng USB-C', text: 'Cổng USB-C trên mẫu tai nghe này có hợp thiết bị?', evidenceIds: ['fact-1']},
      {headline: 'Kiểm tra trước khi đặt', text: 'Đối chiếu cổng USB-C trước khi đặt tai nghe.', evidenceIds: ['fact-1']},
    ],
    scenes: [
      {headline: 'Chọn tai nghe USB-C', voice: 'Bạn đang chọn tai nghe USB-C?', assetId: 'main', evidenceIds: ['fact-1']},
      {headline: 'Kiểu kết nối USB-C', voice: 'Mẫu này dùng kết nối USB-C.', assetId: 'main', evidenceIds: ['fact-1']},
      {headline: 'Dây 1,2 mét', voice: 'Dây có chiều dài 1,2 mét.', assetId: 'detail', evidenceIds: ['fact-2']},
      {headline: 'Kiểm tra cổng USB-C', voice: 'Nhấn sản phẩm để kiểm tra kết nối USB-C trước khi đặt.', assetId: 'main', evidenceIds: ['fact-1']},
    ],
  }
}
const completion = (value: unknown) => new Response(JSON.stringify({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(value)}]}}]}))
async function mockFetch(respond: (url: string, init: RequestInit | undefined, calls: number) => Response | Promise<Response>, run: (calls: () => number) => Promise<void>) {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (url, init) => respond(String(url), init, ++calls)
  try {await run(() => calls)} finally {globalThis.fetch = original}
}

test('Main Gemini request includes a structured contract, submitted images and valid source/asset enums', async () => {
  await mockFetch((url, init) => {
    assert.match(url, /\/gemini-flash-lite-latest:generateContent$/)
    const body = JSON.parse(String(init?.body))
    const format = body.generationConfig.responseFormat.text
    assert.equal(format.mimeType, 'APPLICATION_JSON')
    assert.equal(body.generationConfig.responseSchema, undefined)
    assert.equal(body.generationConfig.maxOutputTokens, 8192)
    assert.deepEqual(format.schema.properties.scenes.items.properties.assetId.enum, ['main', 'detail'])
    assert.deepEqual(format.schema.properties.images.items.properties.assetId.enum, ['main'])
    assert.equal(format.schema.properties.images.maxItems, 1)
    assert.equal(format.schema.properties.hookCandidates.minItems, 3)
    assert.deepEqual(format.schema.properties.scenes.items.properties.evidenceIds.items.enum, ['fact-1', 'fact-2', 'image-main', 'image-main-detail-1', 'image-main-detail-2', 'image-main-detail-3'])
    assert.ok(body.contents[0].parts.some((part: {inlineData?: unknown}) => part.inlineData))
    return completion(authored())
  }, async (calls) => {
    const result = await analyzeProductWithGemini(product, 'mock-key', 22, {images})
    assert.equal(calls(), 1)
    assert.equal(result.contentPlan.aiStatus?.state, 'completed')
    assert.deepEqual(result.contentPlan.copySources, {hooks: 'gemini', script: 'gemini', cta: 'gemini'})
    assert.equal(result.contentPlan.images[0].source, 'vision')
    assert.equal(result.contentPlan.aiStatus?.attempts?.[0].httpStatus, 200)
    assert.equal(result.contentPlan.aiStatus?.attempts?.[0].outcome, 'completed')
  })
})

test('A malformed scene or optional buyer question does not discard other valid Gemini copy or retry the API', async () => {
  const response: Record<string, unknown> = authored()
  const scenes = response.scenes as Record<string, unknown>[]
  scenes[2] = {voice: 'Dây có chiều dài 1,2 mét.', assetId: 'detail', evidenceIds: ['fact-2']}
  response.buyerQuestion = {text: 123}
  await mockFetch(() => completion(response), async (calls) => {
    const result = await analyzeProductWithGemini(product, 'mock-key', 22, {images})
    assert.equal(calls(), 1)
    assert.equal(result.contentPlan.aiStatus?.state, 'partial')
    assert.equal(result.storyboard.scenes[1].voice, authored().scenes[1].voice)
    assert.equal(result.storyboard.scenes[2].voice, 'Dây dài 1,2 mét')
    assert.equal(result.storyboard.scenes[2].renderPlan?.copySource, 'rules')
    assert.equal(result.contentPlan.copySources?.hooks, 'gemini')
    assert.equal(result.contentPlan.copySources?.cta, 'gemini')
  })
})

test('Bad request and blocked generation are distinct, sanitized and stop further model calls', async () => {
  for (const [response, reason] of [[new Response('private diagnostic mock-key', {status: 400}), 'request'], [new Response(JSON.stringify({promptFeedback: {blockReason: 'SAFETY', blockReasonMessage: 'private diagnostic mock-key'}})), 'blocked']] as const) {
    await mockFetch(() => response, async (calls) => {
      const result = await analyzeProductWithGemini(product, 'mock-key')
      assert.equal(calls(), 1)
      assert.equal(result.contentPlan.aiStatus?.reason, reason)
      assert.equal(result.contentPlan.aiStatus?.attempts?.[0].outcome, reason)
      assert.doesNotMatch(JSON.stringify(result), /mock-key|private diagnostic/)
    })
  }
})

test('A truncated first response is recorded before a successful second model response', async () => {
  await mockFetch((_url, _init, calls) => calls === 1 ? new Response(JSON.stringify({candidates: [{finishReason: 'MAX_TOKENS', content: {parts: [{text: '{"scenes": ['}]}}]})) : completion(authored()), async (calls) => {
    const result = await analyzeProductWithGemini(product, 'mock-key', 22, {images})
    assert.equal(calls(), 2)
    assert.equal(result.contentPlan.aiStatus?.state, 'completed')
    assert.deepEqual(result.contentPlan.aiStatus?.attempts?.map((attempt) => attempt.outcome), ['output-limit', 'completed'])
  })
})

test('Thinking parts are excluded from the JSON parser', async () => {
  await mockFetch(() => new Response(JSON.stringify({candidates: [{finishReason: 'STOP', content: {parts: [{thought: true, text: 'Non-JSON thinking text'}, {text: JSON.stringify(authored())}]}}]})), async (calls) => {
    const result = await analyzeProductWithGemini(product, 'mock-key', 22, {images})
    assert.equal(calls(), 1)
    assert.equal(result.contentPlan.aiStatus?.state, 'completed')
  })
})

test('Timeouts remain visible for both bounded model attempts', async () => {
  await mockFetch(() => {throw new DOMException('private diagnostic mock-key', 'TimeoutError')}, async (calls) => {
    const result = await analyzeProductWithGemini(product, 'mock-key')
    assert.equal(calls(), 2)
    assert.equal(result.contentPlan.aiStatus?.reason, 'timeout')
    assert.deepEqual(result.contentPlan.aiStatus?.attempts?.map((attempt) => attempt.outcome), ['timeout', 'timeout'])
    assert.doesNotMatch(JSON.stringify(result), /mock-key|private diagnostic/)
  })
})

test('Remote analysis images only allow HTTPS product CDNs, with no credentials, custom ports or lookalike domains', async () => {
  assert.equal(isAllowedProductImageUrl('https://p16-oec-sg.ibyteimg.com/photo.jpeg'), true)
  for (const url of ['http://p16.ibyteimg.com/photo', 'https://127.0.0.1/photo', 'https://localhost/photo', 'https://p16.ibyteimg.com.evil.test/photo', 'https://evil-ibyteimg.com/photo', 'https://user:password@p16.ibyteimg.com/photo', 'https://p16.ibyteimg.com:8443/photo', 'file:///private/image.jpg']) {
    assert.equal(isAllowedProductImageUrl(url), false, url)
    await mockFetch(() => {throw new Error('Unexpected network call')}, async (calls) => {
      await assert.rejects(loadRemoteAnalysisImage(url))
      assert.equal(calls(), 0)
    })
  }
})

test('Server image recovery disables redirects, limits input and returns a resized JPEG without an AI request', async () => {
  const png = await sharp({create: {width: 2000, height: 1250, channels: 3, background: '#ffeeaa'}}).png().toBuffer()
  await mockFetch((url, init) => {
    assert.equal(url, 'https://p16.ibyteimg.com/product.png')
    assert.equal(init?.redirect, 'error')
    return new Response(new Uint8Array(png), {headers: {'Content-Type': 'image/png'}})
  }, async (calls) => {
    const image = await loadRemoteAnalysisImage('https://p16.ibyteimg.com/product.png')
    assert.equal(calls(), 1)
    const metadata = await sharp(image).metadata()
    assert.equal(metadata.format, 'jpeg')
    assert.equal(metadata.width, 1600)
    assert.equal(metadata.height, 1000)
  })
})

test('Server image recovery rejects non-images, redirects and oversized streams', async () => {
  for (const response of [new Response('html', {headers: {'Content-Type': 'text/html'}}), new Response('', {status: 302, headers: {Location: 'http://127.0.0.1/'}}), new Response(new Uint8Array(8 * 1024 * 1024 + 1), {headers: {'Content-Type': 'image/jpeg'}})]) {
    await mockFetch(() => response, async (calls) => {
      await assert.rejects(loadRemoteAnalysisImage('https://p16.ibyteimg.com/product.png'))
      assert.equal(calls(), 1)
    })
  }
})

test('A browser CORS failure recovers via the local image endpoint and attaches the photo for vision', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const originalBitmap = globalThis.createImageBitmap
  let closed = false
  globalThis.createImageBitmap = async () => ({width: 1600, height: 1000, close: () => {closed = true}} as ImageBitmap)
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: () => ({width: 0, height: 0, getContext: () => ({fillRect() {}, drawImage() {}}), toDataURL: () => 'data:image/jpeg;base64,YWJj'})}})
  try {
    await mockFetch((url, init, calls) => {
      if (calls === 1) {assert.equal(url, 'https://p16.ibyteimg.com/product.png'); throw new TypeError('Failed to fetch')}
      assert.equal(url, '/api/assets/analysis-image')
      assert.deepEqual(JSON.parse(String(init?.body)), {url: 'https://p16.ibyteimg.com/product.png'})
      return new Response('image bytes', {headers: {'Content-Type': 'image/jpeg'}})
    }, async (calls) => {
      const prepared = await prepareAnalysisImages([{id: 'main', type: 'PRODUCT_IMAGE', url: 'https://p16.ibyteimg.com/product.png'}])
      assert.equal(calls(), 2)
      assert.deepEqual(prepared, images)
      assert.equal(closed, true)
    })
  } finally {
    globalThis.createImageBitmap = originalBitmap
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})

test('The render source loader recovers the original photo through the same CORS fallback without requiring canvas', async () => {
  await mockFetch((url, init, calls) => {
    if (calls === 1) {assert.equal(url, 'https://p16.ibyteimg.com/product.png'); throw new TypeError('CORS blocked')}
    assert.equal(url, '/api/assets/analysis-image')
    assert.deepEqual(JSON.parse(String(init?.body)), {url: 'https://p16.ibyteimg.com/product.png'})
    return new Response('original render photo bytes', {headers: {'Content-Type': 'image/jpeg'}})
  }, async (calls) => {
    const blob = await loadProductImageBlob({id: 'main', type: 'PRODUCT_IMAGE', url: 'https://p16.ibyteimg.com/product.png'})
    assert.equal(calls(), 2)
    assert.equal(blob.type, 'image/jpeg')
    assert.equal(await blob.text(), 'original render photo bytes')
  })
})

test('A temporary service 503 gets one bounded same-model retry', async () => {
  await mockFetch((url, _init, calls) => {
    assert.match(url, /\/gemini-flash-lite-latest:generateContent$/)
    return calls === 1 ? new Response('', {status: 503}) : completion(authored())
  }, async (calls) => {
    const result = await analyzeProductWithGemini(product, 'mock-key', 22, {images})
    assert.equal(calls(), 2)
    assert.equal(result.contentPlan.aiStatus?.state, 'completed')
    assert.deepEqual(result.contentPlan.aiStatus?.attempts?.map(attempt => attempt.outcome), ['service', 'completed'])
  })
})
