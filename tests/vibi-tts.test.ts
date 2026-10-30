import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {parseVoiceProvider} from '../src/lib/audio/provider'
import {generateVibiTTS} from '../src/lib/audio/vibi'
import {VipeeTTSProvider} from '../src/engines/speech/VipeeSpeechDirector'

const fakeAudio = new Uint8Array(700).fill(7)

function withVibiEnv() {
  const previous = {key: process.env.VIBI_API_KEY, voice: process.env.VIBI_DEFAULT_VOICE_ID, capcutVoice: process.env.VIBI_CAPCUT_VOICE_ID, upstream: process.env.VIBI_UPSTREAM_PROVIDER, model: process.env.VIBI_MODEL_ID}
  process.env.VIBI_API_KEY = 'fixture-vibi-key'
  process.env.VIBI_DEFAULT_VOICE_ID = 's6W2NupNY6TykGJoDtWy'
  process.env.VIBI_CAPCUT_VOICE_ID = 'capcut-vi-fixture'
  process.env.VIBI_UPSTREAM_PROVIDER = 'elevenlabs'
  process.env.VIBI_MODEL_ID = 'eleven_v4'
  return () => {
    if (previous.key === undefined) delete process.env.VIBI_API_KEY; else process.env.VIBI_API_KEY = previous.key
    if (previous.voice === undefined) delete process.env.VIBI_DEFAULT_VOICE_ID; else process.env.VIBI_DEFAULT_VOICE_ID = previous.voice
    if (previous.capcutVoice === undefined) delete process.env.VIBI_CAPCUT_VOICE_ID; else process.env.VIBI_CAPCUT_VOICE_ID = previous.capcutVoice
    if (previous.upstream === undefined) delete process.env.VIBI_UPSTREAM_PROVIDER; else process.env.VIBI_UPSTREAM_PROVIDER = previous.upstream
    if (previous.model === undefined) delete process.env.VIBI_MODEL_ID; else process.env.VIBI_MODEL_ID = previous.model
  }
}

test('Vibi is an explicit supported voice provider', () => {
  assert.equal(parseVoiceProvider('vibi'), 'vibi')
  assert.equal(parseVoiceProvider('vibi-capcut'), 'vibi-capcut')
})

test('Vibi CapCut uses its separate voice ID and CapCut request shape', async () => {
  const restoreEnv = withVibiEnv()
  const previousFetch = globalThis.fetch
  const requests: Array<{url: string; body?: Record<string, unknown>}> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    requests.push({url, body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined})
    if (url.includes('/text-to-speech/')) return Response.json({id: 'task-capcut', status: 'pending'}, {status: 202})
    if (url.endsWith('/v1/history/task-capcut')) return Response.json({id: 'task-capcut', status: 'completed', result: {audio_url: '/audio/task-capcut.mp3'}})
    if (url.endsWith('/audio/task-capcut.mp3')) return new Response(fakeAudio, {status: 200})
    return Response.json({error: 'unexpected'}, {status: 500})
  }
  try {
    const result = await generateVibiTTS('Xin chào.', {pollIntervalMs: 0, upstreamProvider: 'capcut'})
    assert.equal(result.length, 700)
    assert.ok(requests[0].url.endsWith('/v1/text-to-speech/capcut-vi-fixture'))
    assert.equal(requests[0].body?.provider, 'capcut')
    assert.equal(requests[0].body?.model_id, 'capcut')
    assert.equal(requests[0].body?.language_code, 'vi')
    assert.deepEqual(requests[0].body?.voice_settings, {speed: 1, pitch: 0})
  } finally {
    globalThis.fetch = previousFetch
    restoreEnv()
  }
})

test('Vibi submits the configured voice ID, polls once and downloads audio', async () => {
  const restoreEnv = withVibiEnv()
  const previousFetch = globalThis.fetch
  const requests: Array<{url: string; body?: Record<string, unknown>}> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    requests.push({url, body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined})
    if (url.includes('/text-to-speech/')) return Response.json({id: 'task-1', status: 'pending'}, {status: 202})
    if (url.endsWith('/v1/history/task-1')) return Response.json({id: 'task-1', status: 'completed', result: {audio_url: '/audio/task-1.mp3'}})
    if (url.endsWith('/audio/task-1.mp3')) return new Response(fakeAudio, {status: 200, headers: {'Content-Type': 'audio/mpeg'}})
    return Response.json({error: 'unexpected'}, {status: 500})
  }
  try {
    const result = await generateVibiTTS('Xin chào.', {pollIntervalMs: 0})
    assert.equal(result.length, 700)
    assert.equal(requests.length, 3)
    assert.ok(requests[0].url.endsWith('/v1/text-to-speech/s6W2NupNY6TykGJoDtWy'))
    assert.equal(requests[0].body?.provider, 'elevenlabs')
    assert.equal(requests[0].body?.model_id, 'eleven_v4')
    assert.equal(requests[0].body?.language_code, 'vi')
    assert.deepEqual(requests[0].body?.voice_settings, {stability: 0.44, similarity_boost: 0.8, speed: 1.1})
  } finally {
    globalThis.fetch = previousFetch
    restoreEnv()
  }
})

test('Production speech adapter writes the same Vibi audio without provider fallback', async () => {
  const restoreEnv = withVibiEnv()
  const previousFetch = globalThis.fetch
  const outputPath = path.join(os.tmpdir(), `vibi-audio-${Date.now()}.mp3`)
  const urls: string[] = []
  globalThis.fetch = async (input) => {
    const url = String(input); urls.push(url)
    if (url.includes('/text-to-speech/')) return Response.json({id: 'task-2', status: 'pending'}, {status: 202})
    if (url.endsWith('/v1/history/task-2')) return Response.json({id: 'task-2', status: 'completed', result: {audio_url: '/audio/task-2.mp3'}})
    return new Response(fakeAudio, {status: 200})
  }
  try {
    const success = await (new VipeeTTSProvider() as unknown as {synthesizeVibi(text: string, outputPath: string): Promise<boolean>}).synthesizeVibi('Nội dung.', outputPath)
    assert.equal(success, true)
    assert.equal(fs.readFileSync(outputPath).length, 700)
    assert.ok(urls.every(url => !url.includes('api.elevenlabs.io')))
  } finally {
    globalThis.fetch = previousFetch
    restoreEnv()
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
  }
})
