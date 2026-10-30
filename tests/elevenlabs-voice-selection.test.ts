import test from 'node:test'
import assert from 'node:assert/strict'
import {generateVietnameseTTS} from '../src/lib/audio/tts'
import {VipeeSpeechDirector, VipeeTTSProvider} from '../src/engines/speech/VipeeSpeechDirector'

test('Preview uses the configured ElevenLabs voice and does not substitute a different voice on HTTP 402', async () => {
  const previousFetch = globalThis.fetch
  const previousKey = process.env.ELEVENLABS_API_KEY
  const previousVoice = process.env.ELEVENLABS_DEFAULT_VOICE_ID
  process.env.ELEVENLABS_API_KEY = 'fixture-key'
  process.env.ELEVENLABS_DEFAULT_VOICE_ID = ' fixture-voice '
  const requests: string[] = []
  globalThis.fetch = async url => {requests.push(String(url)); return Response.json({detail: 'cannot use library voices'}, {status: 402})}
  try {
    await assert.rejects(generateVietnameseTTS('Xin chào.', {provider: 'elevenlabs'}), /ElevenLabs/)
    assert.deepEqual(requests, ['https://api.elevenlabs.io/v1/text-to-speech/fixture-voice'])
  } finally {
    globalThis.fetch = previousFetch
    if (previousKey === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = previousKey
    if (previousVoice === undefined) delete process.env.ELEVENLABS_DEFAULT_VOICE_ID; else process.env.ELEVENLABS_DEFAULT_VOICE_ID = previousVoice
  }
})

test('Storyboard production voice uses the configured ID for every preset and never silently falls back', async () => {
  const previousFetch = globalThis.fetch
  const previousKey = process.env.ELEVENLABS_API_KEY
  const previousVoice = process.env.ELEVENLABS_DEFAULT_VOICE_ID
  process.env.ELEVENLABS_API_KEY = 'fixture-key'
  process.env.ELEVENLABS_DEFAULT_VOICE_ID = 'fixture-voice'
  const requests: string[] = []
  globalThis.fetch = async url => {requests.push(String(url)); return Response.json({detail: 'cannot use library voices'}, {status: 402})}
  try {
    for (const voicePreset of ['Natural Friend', 'Warm Reviewer', 'Energetic Seller'] as const) {
      const plan = new VipeeSpeechDirector().createSpeechPlan({scenes: [{id: 's1', voice: 'Xin chào.', storyBeat: 'hook'}]}, {voicePreset})
      await assert.rejects(new VipeeTTSProvider().generateSpeech(plan, {provider: 'elevenlabs'}), /ElevenLabs/)
    }
    assert.equal(requests.length, 3)
    assert.ok(requests.every(url => url.endsWith('/fixture-voice')))
  } finally {
    globalThis.fetch = previousFetch
    if (previousKey === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = previousKey
    if (previousVoice === undefined) delete process.env.ELEVENLABS_DEFAULT_VOICE_ID; else process.env.ELEVENLABS_DEFAULT_VOICE_ID = previousVoice
  }
})
