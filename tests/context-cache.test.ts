import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import {readCachedContext, writeCachedContext} from '../src/lib/ai/context-cache'
import {contextContentError} from '../src/lib/ai/context-errors'
import {generateContextImage, saveUploadedContext} from '../src/lib/ai/context-image'

test('An accepted context image survives a fresh disk read without network, and another source key cannot reuse it', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aff-context-cache-'))
  const image = await sharp({create: {width: 20, height: 20, channels: 3, background: '#f5f2eb'}}).jpeg().toBuffer()
  try {
    await writeCachedContext('a'.repeat(64), image, directory)
    assert.deepEqual(await readCachedContext('a'.repeat(64), directory), image)
    assert.equal(await readCachedContext('b'.repeat(64), directory), undefined)
    assert.equal(await readCachedContext('../escape', directory), undefined)
    await writeFile(path.join(directory, `${'a'.repeat(64)}.jpg`), image.subarray(0, 10))
    assert.equal(await readCachedContext('a'.repeat(64), directory), undefined)
  } finally {await rm(directory, {recursive: true, force: true})}
})

test('Cloudflare output flag 3030 is distinguished from quota and is never automatically retried', async () => {
  const payload = {success: false, errors: [{code: 3030, message: 'Your output has been flagged'}]}
  const classified = contextContentError(payload)
  assert.equal(classified?.code, 'CONTENT_REJECTED')
  assert.equal(classified?.retryable, false)
  assert.equal(classified?.status, 422)
  const savedId = process.env.CLOUDFLARE_ACCOUNT_ID, savedToken = process.env.CLOUDFLARE_API_TOKEN
  const original = globalThis.fetch
  process.env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32)
  process.env.CLOUDFLARE_API_TOKEN = 'mock-secret'
  let calls = 0
  globalThis.fetch = async () => {calls++; return new Response(JSON.stringify(payload), {status: 400})}
  const image = await sharp({create: {width: 20, height: 20, channels: 3, background: '#fff'}}).jpeg().toBuffer()
  try {
    await assert.rejects(generateContextImage('A new flagged product', 'home', {assetId: 'photo', dataUrl: `data:image/jpeg;base64,${image.toString('base64')}`}), error => {
      const typed = error as {code: string; retryable: boolean; message: string}
      assert.equal(typed.code, 'CONTENT_REJECTED')
      assert.equal(typed.retryable, false)
      assert.doesNotMatch(typed.message, /mock-secret/)
      return true
    })
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = original
    if (savedId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = savedId
    if (savedToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = savedToken
  }
})

test('A supplied existing context is reused for that exact product reference without generating another image', async () => {
  const savedId = process.env.CLOUDFLARE_ACCOUNT_ID, savedToken = process.env.CLOUDFLARE_API_TOKEN
  process.env.CLOUDFLARE_ACCOUNT_ID = 'b'.repeat(32)
  process.env.CLOUDFLARE_API_TOKEN = 'mock-token'
  const original = globalThis.fetch
  globalThis.fetch = async () => {throw new Error('Unexpected generation request')}
  const image = await sharp({create: {width: 20, height: 20, channels: 3, background: '#e8e0d0'}}).jpeg().toBuffer()
  const dataUrl = `data:image/jpeg;base64,${image.toString('base64')}`
  const reference = {assetId: 'main', dataUrl}
  try {
    const saved = await saveUploadedContext('Existing context product', 'home', reference, dataUrl)
    assert.equal(await generateContextImage('Existing context product', 'home', reference), saved)
  } finally {
    globalThis.fetch = original
    if (savedId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = savedId
    if (savedToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = savedToken
  }
})
