import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {POST} from '../src/app/api/tiktok/publish/route'
import {GET as authorize} from '../src/app/api/tiktok/auth/route'
import {GET as queryStatus} from '../src/app/api/tiktok/publish-status/route'
import {tikTokTokenStore} from '../src/lib/tiktok/token-store'
import {fileUploadPlan, uploadRanges, hasPostingScope, postingProgress} from '../src/lib/tiktok/posting-mode'
import {sendTikTokVideo, fetchTikTokProgress, type TikTokUploadSession} from '../src/lib/tiktok/upload-client'
import {uploadDirectChunk} from '../src/lib/tiktok/upload-transport'
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

test('Retrying an interrupted transfer reuses the task and checks accepted bytes before sending', async () => {
  const video = new Blob([new Uint8Array(1024)])
  let session: TikTokUploadSession | undefined
  let initializations = 0, transfers = 0, checks = 0
  await mockTikTok(async (url) => {
    if (String(url) === uploadUrl) {
      transfers++
      if (transfers === 1) throw new TypeError('Connection interrupted')
      return new Response(null, {status: 201})
    }
    if (String(url).includes('publish-status')) {
      checks++
      if (checks === 1) throw new TypeError('Status unavailable')
      return json({status: 'PROCESSING_UPLOAD', uploadedBytes: 0})
    }
    initializations++
    return json({publishId: 'original-task', uploadUrl, ...fileUploadPlan(video.size)})
  }, async () => {
    const options = {mode: 'upload' as const, title: '', privacyLevel: 'SELF_ONLY' as const, isAigc: false, onSession: (value: TikTokUploadSession) => {session = value}}
    await assert.rejects(sendTikTokVideo(video, options), /Status unavailable/)
    assert.ok(session)
    assert.equal((await sendTikTokVideo(video, {...options, session})).publishId, 'original-task')
    assert.equal(initializations, 1)
    assert.equal(transfers, 2)
    assert.equal(checks, 2)
  })
})

test('A resumed task already accepted by TikTok never resends the MP4 or initializes again', async () => {
  const video = new Blob([new Uint8Array(1024)])
  await mockTikTok(async (url) => {
    assert.ok(String(url).includes('publish-status'))
    return json({status: 'SEND_TO_USER_INBOX'})
  }, async () => {
    const result = await sendTikTokVideo(video, {mode: 'upload', title: '', privacyLevel: 'SELF_ONLY', isAigc: false, session: {publishId: 'original-task', uploadUrl, videoSize: video.size, mode: 'upload', ...fileUploadPlan(video.size)}})
    assert.equal(result.publishId, 'original-task')
  })
})

test('Hosted fallback refuses an oversized proxy request without splitting TikTok chunks or creating a second task', async () => {
  const video = new Blob([new Uint8Array(5_239_130)])
  let initializations = 0
  await mockTikTok(async (url, init) => {
    if (String(url) === uploadUrl) throw new TypeError('CORS')
    if (String(url).includes('publish-status')) return json({status: 'PROCESSING_UPLOAD', uploadedBytes: 0})
    assert.ok(!(init?.body instanceof FormData), 'Oversized file must not be posted to the serverless function')
    initializations++
    return json({publishId: 'original-task', uploadUrl, maxProxyBytes: 4_000_000, ...fileUploadPlan(video.size)})
  }, async () => {
    await assert.rejects(sendTikTokVideo(video, {mode: 'upload', title: '', privacyLevel: 'SELF_ONLY', isAigc: false}), /vượt giới hạn/)
    assert.equal(initializations, 1)
  })
})

test('Partially accepted chunks are not resent when resuming; completed ranges are skipped', async () => {
  const size = 65 * 1024 ** 2
  const video = new Blob([new Uint8Array(size)])
  let bytes = 1, transfers = 0
  const plan = fileUploadPlan(size)
  await mockTikTok(async (url, init) => {
    if (String(url).includes('publish-status')) return json({status: 'PROCESSING_UPLOAD', uploadedBytes: bytes})
    assert.equal(String(url), uploadUrl)
    transfers++
    assert.equal((init?.headers as Record<string, string>)['Content-Range'], `bytes ${plan.chunkSize}-${size - 1}/${size}`)
    return new Response(null, {status: 201})
  }, async () => {
    const options = {mode: 'upload' as const, title: '', privacyLevel: 'SELF_ONLY' as const, isAigc: false, session: {mode: 'upload' as const, videoSize: size, publishId: 'original-task', uploadUrl, ...plan}}
    await assert.rejects(sendTikTokVideo(video, options), /nhận dở/)
    assert.equal(transfers, 0)
    bytes = plan.chunkSize
    await sendTikTokVideo(video, options)
    assert.equal(transfers, 1)
  })
})

class UploadRequestFixture {
  upload: {onprogress: ((event: {loaded: number}) => void) | null} = {onprogress: null}
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null
  status = 201
  timeout = 0
  aborted = false
  headers: Record<string, string> = {}
  open() {}
  setRequestHeader(name: string, value: string) {this.headers[name] = value}
  send() {}
  abort() {this.aborted = true; this.onabort?.()}
}

test('A stalled browser PUT is aborted after inactivity instead of leaving the button pending forever', async (context) => {
  const original = globalThis.XMLHttpRequest
  const request = new UploadRequestFixture()
  globalThis.XMLHttpRequest = function () {return request} as unknown as typeof XMLHttpRequest
  context.mock.timers.enable({apis: ['setTimeout']})
  try {
    const result = uploadDirectChunk(uploadUrl, new Blob([new Uint8Array(100)]), 0, 100)
    const rejected = assert.rejects(result, /60 giây/)
    context.mock.timers.tick(60_000)
    await rejected
    assert.equal(request.aborted, true)
  } finally {globalThis.XMLHttpRequest = original; context.mock.timers.reset()}
})

test('A slow upload stays alive while bytes advance and reports progress without claiming Inbox delivery', async (context) => {
  const original = globalThis.XMLHttpRequest
  const request = new UploadRequestFixture()
  globalThis.XMLHttpRequest = function () {return request} as unknown as typeof XMLHttpRequest
  context.mock.timers.enable({apis: ['setTimeout']})
  try {
    const progress: number[] = []
    const result = uploadDirectChunk(uploadUrl, new Blob([new Uint8Array(100)]), 200, 300, bytes => progress.push(bytes))
    context.mock.timers.tick(59_000)
    request.upload.onprogress?.({loaded: 40})
    context.mock.timers.tick(59_000)
    request.upload.onprogress?.({loaded: 100})
    assert.equal(request.aborted, false)
    assert.equal(request.headers['Content-Range'], 'bytes 200-299/300')
    request.onload?.()
    assert.equal(await result, 201)
    assert.deepEqual(progress, [40, 100])
    context.mock.timers.tick(600_000)
    assert.equal(request.aborted, false)
  } finally {globalThis.XMLHttpRequest = original; context.mock.timers.reset()}
})
