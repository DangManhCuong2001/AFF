import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {POST} from '../src/app/api/tiktok/publish/route'
import {GET as authorize} from '../src/app/api/tiktok/auth/route'
import {GET as queryStatus} from '../src/app/api/tiktok/publish-status/route'
import {tikTokTokenStore} from '../src/lib/tiktok/token-store'
import {fileUploadPlan, uploadRanges, hasPostingScope, postingProgress} from '../src/lib/tiktok/posting-mode'
import {sendTikTokVideo, fetchTikTokProgress} from '../src/lib/tiktok/upload-client'
import {uploadVideoChunk} from '../src/lib/tiktok/posting'

const uploadUrl = 'https://open-upload.tiktokapis.com/video/?upload_id=test&upload_token=fixture'
const initResult = {data: {publish_id: 'test-id', upload_url: uploadUrl}, error: {code: 'ok', message: ''}}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}})
async function mockTikTok(fetcher: typeof fetch, run: () => Promise<void>) {
  const originalFetch = globalThis.fetch, originalGet = tikTokTokenStore.get
  globalThis.fetch = fetcher
  // Isolate authentication: never read/write the user's real token store or call TikTok.
  tikTokTokenStore.get = async () => ({accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600_000, openId: 'test-user', scope: 'video.upload,video.publish', tokenType: 'Bearer'})
  try {await run()} finally {globalThis.fetch = originalFetch; tikTokTokenStore.get = originalGet}
}
const request = (body: unknown) => new NextRequest('http://localhost/api/tiktok/publish', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})

test('Upload option initializes only Inbox, without caption, privacy or AI publishing metadata', async () => {
  let calls = 0
  await mockTikTok(async (url, init) => {
    calls++
    assert.equal(String(url), 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/')
    assert.deepEqual(JSON.parse(String(init?.body)), {source_info: {source: 'FILE_UPLOAD', video_size: 1024, chunk_size: 1024, total_chunk_count: 1}})
    return json(initResult)
  }, async () => {
    const response = await POST(request({mode: 'upload', videoSize: 1024, title: '', privacyLevel: 'PUBLIC_TO_EVERYONE', isAigc: true}))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {success: true, mode: 'upload', publishId: 'test-id', uploadUrl, chunkSize: 1024, totalChunkCount: 1})
    assert.equal(calls, 1)
  })
})

test('Existing requests without a mode still initialize Direct Post with their settings', async () => {
  await mockTikTok(async (url, init) => {
    assert.equal(String(url), 'https://open.tiktokapis.com/v2/post/publish/video/init/')
    const body = JSON.parse(String(init?.body))
    assert.equal(body.post_info.title, 'Caption thử')
    assert.equal(body.post_info.privacy_level, 'SELF_ONLY')
    assert.equal(body.post_info.is_aigc, true)
    return json(initResult)
  }, async () => {
    const response = await POST(request({title: 'Caption thử', videoSize: 1024, isAigc: true}))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).mode, 'publish')
  })
})

test('Invalid modes and file sizes cannot accidentally initialize a publication', async () => {
  await mockTikTok(async () => {throw new Error('Unexpected external call')}, async () => {
    for (const body of [{mode: 'draft', videoSize: 1024, title: 'Caption'}, {mode: 'upload', videoSize: 0}, {mode: 'upload', videoSize: 1.5}, {mode: 'upload', videoSize: 5 * 1024 ** 3}, {mode: 'publish', videoSize: 1024, title: ''}]) {
      assert.equal((await POST(request(body))).status, 400)
    }
  })
})

test('Multipart upload mode also goes to Inbox and sends the MP4 with a complete Content-Range', async () => {
  const video = new File([new Uint8Array(1024)], 'test.mp4', {type: 'video/mp4'})
  const form = new FormData(); form.set('mode', 'upload'); form.set('video', video)
  let calls = 0
  await mockTikTok(async (url, init) => {
    calls++
    if (String(url) === uploadUrl) {
      assert.equal(init?.method, 'PUT')
      assert.equal((init?.headers as Record<string, string>)['Content-Range'], 'bytes 0-1023/1024')
      return new Response(null, {status: 201})
    }
    assert.ok(String(url).includes('/inbox/video/init/'))
    return json(initResult)
  }, async () => {
    const result = await POST(new NextRequest('http://localhost/api/tiktok/publish', {method: 'POST', body: form}))
    assert.equal(result.status, 200)
    assert.equal((await result.json()).mode, 'upload')
    assert.equal(calls, 2)
  })
})

test('File plans follow the declared chunk geometry, including trailing bytes above 64MB', () => {
  for (const size of [1024, 4 * 1024 ** 2, 64 * 1024 ** 2, 65 * 1024 ** 2, 100 * 1024 ** 2 + 123, 4 * 1024 ** 3]) {
    const plan = fileUploadPlan(size)
    const ranges = uploadRanges(size, plan.chunkSize, plan.totalChunkCount)
    assert.equal(ranges[0].start, 0)
    assert.equal(ranges.at(-1)!.end, size)
    assert.equal(ranges.reduce((sum, range) => sum + range.end - range.start, 0), size)
    ranges.forEach((range, index) => {
      if (index) assert.equal(range.start, ranges[index - 1].end)
      if (size > 64 * 1024 ** 2) assert.ok(range.end - range.start >= 5 * 1024 ** 2 && range.end - range.start <= 64 * 1024 ** 2)
    })
  }
  assert.throws(() => uploadRanges(1024, 512, 2))
})

test('Upload proxy rejects foreign destinations and incorrectly sliced chunks before sending bytes', async () => {
  await mockTikTok(async () => {throw new Error('Unexpected external call')}, async () => {
    for (const url of ['https://example.com/video', 'http://open-upload.tiktokapis.com/video', 'https://open-upload.tiktokapis.com.evil.test/video', 'not-a-url']) {
      await assert.rejects(uploadVideoChunk(url, Buffer.alloc(10)), /Địa chỉ/)
    }
    const form = new FormData()
    form.set('action', 'chunk'); form.set('uploadUrl', uploadUrl); form.set('startByte', '0'); form.set('totalBytes', '2048'); form.set('chunk', new Blob([new Uint8Array(1024)]), 'part.mp4')
    assert.equal((await POST(new NextRequest('http://localhost/api/tiktok/publish', {method: 'POST', body: form}))).status, 400)
  })
})

test('OAuth can request only video.upload and scope checks do not treat it as video.publish', async () => {
  const key = process.env.TIKTOK_CLIENT_KEY, redirect = process.env.TIKTOK_REDIRECT_URI
  process.env.TIKTOK_CLIENT_KEY = 'test-key'; process.env.TIKTOK_REDIRECT_URI = 'http://localhost/api/tiktok/callback'
  try {
    const response = await authorize(new NextRequest('http://localhost/api/tiktok/auth?scope=upload&returnTo=/create'))
    const location = new URL(response.headers.get('location')!)
    assert.equal(location.searchParams.get('scope'), 'user.info.basic,video.upload')
    assert.equal(hasPostingScope('user.info.basic,video.upload', 'upload'), true)
    assert.equal(hasPostingScope('user.info.basic,video.upload', 'publish'), false)
    assert.equal(hasPostingScope('video.publish, video.upload', 'upload'), true)
    assert.equal(hasPostingScope('video.upload.other', 'upload'), false)
  } finally {
    if (key === undefined) delete process.env.TIKTOK_CLIENT_KEY; else process.env.TIKTOK_CLIENT_KEY = key
    if (redirect === undefined) delete process.env.TIKTOK_REDIRECT_URI; else process.env.TIKTOK_REDIRECT_URI = redirect
  }
})

test('SEND_TO_USER_INBOX means manual completion, never publication; unknown states stay pending', () => {
  assert.equal(postingProgress('upload', 'SEND_TO_USER_INBOX').phase, 'inbox')
  assert.match(postingProgress('upload', 'SEND_TO_USER_INBOX').message, /chưa được xuất bản/)
  assert.equal(postingProgress('publish', 'SEND_TO_USER_INBOX').phase, 'processing')
  for (const status of ['PROCESSING_UPLOAD', 'PROCESSING_DOWNLOAD', 'UNKNOWN', 'SUCCESS']) assert.equal(postingProgress('upload', status).terminal, false)
  assert.equal(postingProgress('upload', 'PUBLISH_COMPLETE').phase, 'published')
  assert.equal(postingProgress('publish', 'PUBLISH_COMPLETE').phase, 'published')
  assert.equal(postingProgress('upload', 'FAILED', 'test').phase, 'failed')
})

test('Status route carries Inbox state and accepted bytes through to the client', async () => {
  await mockTikTok(async (url) => {
    assert.ok(String(url).endsWith('/post/publish/status/fetch/'))
    return json({data: {status: 'SEND_TO_USER_INBOX', uploaded_bytes: 1024}, error: {code: 'ok', message: ''}})
  }, async () => {
    const response = await queryStatus(new NextRequest('http://localhost/api/tiktok/publish-status?publish_id=test-id'))
    const body = await response.json()
    assert.equal(body.status, 'SEND_TO_USER_INBOX')
    assert.equal(body.uploadedBytes, 1024)
  })
})

test('Browser upload initializes once, preserves the declared chunk and polls separately after a CORS proxy fallback', async () => {
  const video = new Blob([new Uint8Array(3 * 1024 ** 2)], {type: 'video/mp4'})
  let initialized = 0, proxied = 0
  await mockTikTok(async (url, init) => {
    if (String(url) === uploadUrl) throw new TypeError('CORS')
    if (init?.body instanceof FormData) {
      proxied++
      assert.equal((init.body.get('chunk') as File).size, video.size)
      return json({success: true})
    }
    if (String(url).includes('publish-status')) return json({status: proxied ? 'SEND_TO_USER_INBOX' : 'PROCESSING_UPLOAD', uploadedBytes: proxied ? video.size : 0})
    initialized++
    assert.deepEqual(JSON.parse(String(init?.body)), {mode: 'upload', videoSize: video.size})
    return json({publishId: 'test-id', uploadUrl, ...fileUploadPlan(video.size)})
  }, async () => {
    const result = await sendTikTokVideo(video, {mode: 'upload', title: 'Must not be sent', privacyLevel: 'PUBLIC_TO_EVERYONE', isAigc: true})
    assert.equal(result.mode, 'upload')
    assert.equal(initialized, 1); assert.equal(proxied, 1)
    const progress = await fetchTikTokProgress(result.publishId, 'upload')
    assert.equal(progress.phase, 'inbox')
  })
})

test('A CORS-hidden successful transfer is not resent or reinitialized', async () => {
  let initialized = 0
  await mockTikTok(async (url, init) => {
    if (String(url) === uploadUrl) throw new TypeError('CORS hidden response')
    if (String(url).includes('publish-status')) return json({status: 'SEND_TO_USER_INBOX'})
    assert.ok(!(init?.body instanceof FormData), 'Already accepted video must not be uploaded again')
    initialized++
    return json({publishId: 'test-id', uploadUrl, ...fileUploadPlan(1024)})
  }, async () => {
    await sendTikTokVideo(new Blob([new Uint8Array(1024)]), {mode: 'upload', title: '', privacyLevel: 'SELF_ONLY', isAigc: false})
    assert.equal(initialized, 1)
  })
})

test('Missing upload scope fails without a hidden Direct Post fallback', async () => {
  let calls = 0
  await mockTikTok(async (_url, init) => {
    calls++
    assert.equal(JSON.parse(String(init?.body)).mode, 'upload')
    return json({error: {code: 'scope_not_authorized', message: 'Missing scope'}}, 403)
  }, async () => {
    await assert.rejects(sendTikTokVideo(new Blob([new Uint8Array(1024)]), {mode: 'upload', title: '', privacyLevel: 'SELF_ONLY', isAigc: false}), /video.upload/)
    assert.equal(calls, 1)
  })
})
