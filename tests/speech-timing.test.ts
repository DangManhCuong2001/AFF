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
import {applySceneAudioTimings, hasCompleteSceneAudioTimings, parseSceneAudioTimings, sceneVoiceSignature} from '../src/lib/video/scene-timing'
import {analyzeVoiceFile, joinVoiceChunks, speechBounds} from '../src/lib/audio/voice-processing'
import {splitTTSText} from '../src/lib/audio/text-chunks'
import {validateCommerceCopy} from '../src/lib/ai/validate-commerce-copy'
import {assertNarrationDuration, NarrationSyncError} from '../src/lib/video/narration-sync'
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

test('Real audio processing preserves speech and bounded natural pauses without padding short lines into long silent holds', async () => {
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
      assert.ok(timing.durationSec < 1.2, 'A short spoken line should not create two seconds of dead air')
      assert.ok(Math.abs(timing.speechOffsetSec! - plan.segments[i].pauseBeforeMs / 1000) < 0.02)
      assert.ok(timing.speechDurationSec! > 0.5 && timing.speechDurationSec! < 0.9)
      assert.ok(timing.speechOffsetSec! + timing.speechDurationSec! < timing.durationSec)
      assert.ok(timing.durationSec - timing.speechOffsetSec! - timing.speechDurationSec! < 0.4)
    }
    assert.equal(result.segmentTimings[1].startSec, result.segmentTimings[0].endSec)
    const output = path.join(tmp, 'master.mp3')
    fs.writeFileSync(output, result.audioBuffer)
    const {stderr} = await promisify(execFile)(getFfmpegBinaryPath(), ['-i', output, '-f', 'null', '-'])
    assert.match(stderr, /Audio: pcm_s16le/)
    const decoded = await analyzeVoiceFile(output)
    assert.ok(Math.abs(decoded.durationSec - result.durationSec) < 1 / 44100, 'One master encode must preserve the exact PCM timeline')
    const synced = applySceneAudioTimings(planAdaptiveVideo({id: 'a', name: 'Kệ', category: 'home', assets: []}).storyboard.scenes.slice(0, 2).map((scene, index) => ({...scene, id: plan.segments[index].id})), result.segmentTimings)
    for (const fps of [15, 30, 60]) {
      const boundary = Math.round(synced[0].duration * fps) / fps
      const first = result.segmentTimings[0], next = result.segmentTimings[1]
      assert.ok(first.speechOffsetSec! + first.speechDurationSec! < boundary, 'Scene cannot switch before its sentence ends')
      assert.ok(boundary < next.startSec + next.speechOffsetSec!, 'Next scene must be visible before its speech starts')
    }
  } finally { fs.rmSync(tmp, {recursive: true, force: true}) }
})

test('Outer-silence detection retains internal sentence pauses and a quiet final phoneme', () => {
  const rate = 44100
  const samples = new Float32Array(rate * 3)
  for (let index = Math.round(rate * 0.3); index < Math.round(rate * 0.9); index++) samples[index] = 0.1 * Math.sin(index * 0.1)
  for (let index = Math.round(rate * 1.4); index < Math.round(rate * 2); index++) samples[index] = (index > rate * 1.85 ? 0.001 : 0.1) * Math.sin(index * 0.2)
  const bounds = speechBounds(samples)
  assert.ok(bounds.trimStartSec < 0.3 && bounds.trimStartSec > 0.2)
  assert.ok(bounds.trimEndSec >= 2 && bounds.trimEndSec < 2.1)
  assert.ok(bounds.speechEndSec >= 2, 'Quiet final phoneme must survive')
  assert.ok(bounds.speechStartSec <= 0.3)
  assert.throws(() => speechBounds(new Float32Array(rate)), /khoảng lặng/)
})

test('Google chunks prefer whole sentences or clauses, retain all words and never split measurement tokens', () => {
  const text = 'Nếu thích đồ cùng tông, bạn có thể xem bộ dao màu kem. Ống đựng có chân đế màu trắng và cán dao cũng dùng tông màu sáng. Nhấn sản phẩm để xem chi tiết và giá hiện tại nhé.'
  const chunks = splitTTSText(text, 90)
  assert.equal(chunks.join(' '), text)
  assert.ok(chunks.every(chunk => chunk.length <= 90))
  assert.match(chunks[0], /[.!?,]$/)
  const decimal = 'Dây dài 1,2m và đầu cắm USB-C, phù hợp nếu bạn cần kiểu kết nối này.'
  assert.equal(splitTTSText(decimal, 25).join(' '), decimal)
  assert.ok(splitTTSText(decimal, 25).some(chunk => chunk.includes('1,2m')))
})

test('Independently encoded Google responses are joined without losing the second sentence or accumulating MP3 padding', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vipee-chunks-test-'))
  const run = promisify(execFile), ffmpeg = getFfmpegBinaryPath()
  try {
    const files = [path.join(tmp, 'first.mp3'), path.join(tmp, 'second.mp3')]
    for (const [index, file] of files.entries()) await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', `sine=frequency=${index ? 1200 : 500}:duration=${index ? 0.9 : 0.6}`, '-c:a', 'libmp3lame', file])
    const durations = await Promise.all(files.map(file => analyzeVoiceFile(file)))
    const joined = await joinVoiceChunks(files.map(file => fs.readFileSync(file)))
    const target = path.join(tmp, 'joined.mp3')
    fs.writeFileSync(target, joined)
    const actual = await analyzeVoiceFile(target)
    assert.ok(Math.abs(actual.durationSec - durations.reduce((sum, item) => sum + item.durationSec, 0)) < 1 / 44100)
    assert.ok(actual.speechEndSec > 1.45, 'Last sentence cannot disappear at an embedded MP3 header')
  } finally {fs.rmSync(tmp, {recursive: true, force: true})}
})

test('A partial timing header or a previous script cannot be accepted as synchronized narration', () => {
  const scenes = [{id: 'a', voice: 'Câu mở đầu.', headline: 'Mở đầu'}, {id: 'b', voice: 'Câu tiếp theo.', headline: 'Chi tiết'}]
  const timings = [{segmentId: 'a', durationSec: 2}, {segmentId: 'b', durationSec: 3}]
  assert.equal(hasCompleteSceneAudioTimings(scenes, timings), true)
  assert.equal(hasCompleteSceneAudioTimings(scenes, timings.slice(0, 1)), false)
  assert.equal(hasCompleteSceneAudioTimings(scenes, [timings[0], timings[0]]), false)
  assert.equal(hasCompleteSceneAudioTimings(scenes, [{segmentId: 'a', durationSec: NaN}, timings[1]]), false)
  assert.notEqual(sceneVoiceSignature(scenes), sceneVoiceSignature([{...scenes[0], voice: 'Câu mở đã chỉnh.'}, scenes[1]]))
})

test('Narration validation rejects a dangling connector instead of carrying half a sentence into another scene', () => {
  const facts = [{id: 'color', text: 'Dao màu kem', source: 'user_input' as const}]
  for (const text of ['Dao màu kem và', 'Dao màu kem nhưng.', 'Dao màu kem,']) assert.equal(validateCommerceCopy({text, evidenceIds: ['color']}, facts, 'Bộ dao', 'body'), false)
  assert.equal(validateCommerceCopy({text: 'Dao màu kem, đáng xem nếu bạn thích tông này.', evidenceIds: ['color']}, facts, 'Bộ dao', 'body'), true)
})

test('Export refuses audio paired with estimated durations instead of quietly cutting or shifting the narration', () => {
  assert.doesNotThrow(() => assertNarrationDuration([{duration: 2.1}, {duration: 3.7}], 5.8))
  assert.throws(() => assertNarrationDuration([{duration: 2}, {duration: 3}], 5.17), NarrationSyncError)
  assert.throws(() => assertNarrationDuration([{duration: 2}, {duration: NaN}], 5), NarrationSyncError)
  assert.throws(() => assertNarrationDuration([], 5), NarrationSyncError)
})
