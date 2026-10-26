import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {VipeeSpeechDirector, VipeeTTSProvider} from '../src/engines/speech/VipeeSpeechDirector'
import {sanitizeTextForTTS} from '../src/lib/audio/tts'
import {getFfmpegBinaryPath} from '../src/lib/video/ffmpeg'
import {applySceneAudioTimings, parseSceneAudioTimings} from '../src/lib/video/scene-timing'
import {speechProgressAtTime} from '../src/remotion/scene-captions'
import {planAdaptiveVideo} from '../src/engines/planning/AdaptiveVideoPlanner'

test('Speech preserves authored meaning and pronounces measurements without decimal pauses', () => {
  const voice = 'Đây là giải pháp giúp tối ưu không gian. Dây 1,2m, đầu USB-C, nhãn 3M.'
  const segment = new VipeeSpeechDirector().createSpeechPlan({scenes: [{id: 'a', voice, storyBeat: 'hook'}]}).segments[0]
  assert.equal(segment.text, voice)
  assert.equal(segment.displayScript, voice)
  assert.match(segment.ttsScript!, /một phẩy hai mét/)
  assert.match(segment.ttsScript!, /u ét bê xi/)
  assert.match(segment.ttsScript!, /ba mờ/)
  assert.doesNotMatch(segment.ttsScript!, /mình kiếm|hẳn luôn|1, 2/)
  assert.match(sanitizeTextForTTS('Dài 3m, dày 0,05cm, 1.5kg.'), /ba mét, dày không phẩy không năm xen ti mét, một phẩy năm ki lô gam/)
  assert.doesNotMatch(sanitizeTextForTTS('Giá 99.000đ, dài 1,2m.'), /99000 phẩy|chín phẩy/)
  assert.match(sanitizeTextForTTS('Giá 99.000đ.'), /99000đ/)
})

test('Speaking windows survive headers, reach planned scenes and exclude pauses from caption pacing', () => {
  const scenes = planAdaptiveVideo({id: 'a', name: 'Kệ', category: 'home', assets: []}).storyboard.scenes
  const timings = parseSceneAudioTimings(JSON.stringify([{segmentId: scenes[0].id, durationSec: 4, speechOffsetSec: 0.2, speechDurationSec: 2}]))
  const output = applySceneAudioTimings(scenes, timings)
  assert.deepEqual(output[0].renderPlan?.speechTiming, {offsetSec: 0.2, durationSec: 2})
  assert.equal(speechProgressAtTime(0.1, 4, output[0].renderPlan?.speechTiming), 0)
  assert.equal(speechProgressAtTime(1.2, 4, output[0].renderPlan?.speechTiming), 0.5)
  assert.equal(speechProgressAtTime(3, 4, output[0].renderPlan?.speechTiming), 1)
  assert.equal(scenes[0].renderPlan?.speechTiming, undefined)
  assert.equal(applySceneAudioTimings(output, [{segmentId: scenes[0].id, durationSec: 3}])[0].renderPlan?.speechTiming, undefined)
  assert.deepEqual(parseSceneAudioTimings(JSON.stringify([{segmentId: 'a', durationSec: 3, speechOffsetSec: -1, speechDurationSec: 5}])), [{segmentId: 'a', durationSec: 3}])
})

test('Real audio processing honors pace, before/after silence and minimum viewing time without extra TTS calls', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vipee-timing-test-'))
  try {
    const fixture = path.join(tmp, 'tone.mp3')
    await promisify(execFile)(getFfmpegBinaryPath(), ['-y', '-f', 'lavfi', '-i', 'sine=frequency=500:duration=0.6', '-c:a', 'libmp3lame', fixture])
    let calls = 0
    const provider = new VipeeTTSProvider()
    // Stub only the network boundary; exercise the actual FFmpeg processing and concat.
    Object.assign(provider, {synthesizeGoogleTTS: async (_text: string, output: string) => {calls++; fs.copyFileSync(fixture, output); return true}})
    const plan = new VipeeSpeechDirector().createSpeechPlan({scenes: [
      {id: 'a', voice: 'Xem sản phẩm.', storyBeat: 'hook'},
      {id: 'b', voice: 'Xem chi tiết.', storyBeat: 'cta'},
    ]})
    const result = await provider.generateSpeech(plan, {provider: 'google'})
    assert.equal(calls, 2)
    assert.equal(result.segmentTimings.length, 2)
    assert.ok(result.audioBuffer.length > 1000)
    for (const [i, timing] of result.segmentTimings.entries()) {
      assert.ok(Math.abs(timing.durationSec - plan.segments[i].minimumDurationSec!) < 0.15)
      assert.equal(timing.speechOffsetSec, plan.segments[i].pauseBeforeMs / 1000)
      assert.ok(timing.speechDurationSec! > 0.5 && timing.speechDurationSec! < 0.9)
      assert.ok(timing.speechOffsetSec! + timing.speechDurationSec! < timing.durationSec)
    }
    assert.equal(result.segmentTimings[1].startSec, result.segmentTimings[0].endSec)
    const output = path.join(tmp, 'master.mp3')
    fs.writeFileSync(output, result.audioBuffer)
    const {stderr} = await promisify(execFile)(getFfmpegBinaryPath(), ['-i', output, '-f', 'null', '-'])
    assert.match(stderr, /Audio: pcm_s16le/)
  } finally { fs.rmSync(tmp, {recursive: true, force: true}) }
})
