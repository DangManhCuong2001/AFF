/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test runner. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto').webcrypto;
const protocol = require('../../tools/google-vids-bridge/extension/protocol.js');
const extension = path.resolve(__dirname, '../../tools/google-vids-bridge/extension');

function template() {
  const value = [376, null, [], [null, null, null, [[[null, null, 'Original prompt']]]], [null, ['unknown-model-options']], [], 1];
  const image = Array(14).fill(null);
  image[8] = [null, null, null, 'old-image-handle-xxxxxxxx', 1];
  image[13] = 'Image1';
  value[2][25] = [[[null, image]]];
  value[2][8] = ['document-id-fixture', 'application/vnd.google-apps.flix'];
  return value;
}
const result = [[[null, null, ['asset-fixture', 'bard_storage', 'temp_data', 'lookup_temp_data', 'https://contribution-rt.usercontent.google.com/download?c=fixture&filename=video.mp4', 720, 1280]]]];

test('replace exactly prompt and image handle, preserving unknown protocol settings', () => {
  const original = template();
  const updated = protocol.buildPayload(original, '  New product prompt  ', 'new-image-handle-xxxxxxxx');
  assert.equal(updated[3][3][0][0][2], 'New product prompt');
  assert.equal(updated[2][25][0][0][1][8][3], 'new-image-handle-xxxxxxxx');
  assert.equal(original[3][3][0][0][2], 'Original prompt');
  assert.equal(original[2][25][0][0][1][8][3], 'old-image-handle-xxxxxxxx');
  assert.deepEqual(updated[4], original[4]);
  assert.deepEqual(updated[2][8], original[2][8]);
});
test('fail closed on schema changes or multiple image references', () => {
  assert.throws(() => protocol.inspectTemplate([377]), /UNSUPPORTED_TEMPLATE/);
  const changed = template();
  changed[2][25].push(structuredClone(changed[2][25][0]));
  assert.throws(() => protocol.inspectTemplate(changed), /SINGLE_IMAGE/);
  assert.throws(() => protocol.buildPayload(template(), '', 'new-image-handle-xxxxxxxx'), /INVALID_PROMPT/);
});
test('parse Google anti-XSSI JSON, reject malformed upload output', () => {
  assert.equal(protocol.uploadHandle(')]}\'\n["uploaded-image-handle-xxxxxxxx"]'), 'uploaded-image-handle-xxxxxxxx');
  assert.throws(() => protocol.uploadHandle('["a", "b"]'), /INVALID_UPLOAD_RESPONSE/);
});
test('only accept MP4 result URL on the observed Google host', () => {
  assert.deepEqual(protocol.videoResult(JSON.stringify(result)), {url: result[0][0][2][4], width: 720, height: 1280});
  assert.throws(() => protocol.videoResult(JSON.stringify(result).replace('contribution-rt.usercontent.google.com', 'evil.example')), /NO_VIDEO_RESULT/);
  assert.throws(() => protocol.videoResult(JSON.stringify(result).replace('video.mp4', 'image.png')), /NO_VIDEO_RESULT/);
});

function pageHarness({generateStatus = 200, quotaStatus = 200, quotaBody = '[1]', badHandle = false, fetchRequest = false, reused = false, missingUploadUrl = false, uploadNetworkStage = null, uploadStartStatus = 200, uploadPutStatus = 200, legacy = false, installPage = true} = {}) {
  const calls = [];
  let declaredSize = null;
  class FakeXHR {
    open(method, url) { this.method = method; this.url = String(url); this.headers = {}; this.responseHeaders = {}; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    getResponseHeader(name) { return this.responseHeaders[name.toLowerCase()] || null; }
    addEventListener(name, handler) { this.listener = handler; }
    send(body) {
      if (this.url.includes('/genai/generate')) { this.status = 200; this.responseText = JSON.stringify(result).replace('c=fixture', 'c=previous'); this.listener?.(); return; }
      calls.push({url: this.url, options: {method: this.method, headers: this.headers, body}});
      const start = this.method === 'POST';
      if (uploadNetworkStage === (start ? 'start' : 'put')) { this.onerror(); return; }
      // A strict resumable receiver rejects the earlier incomplete bare PUT.
      if (!start && (this.headers['X-Goog-Upload-Command'] !== 'upload, finalize' || this.headers['X-Goog-Upload-Offset'] !== '0' || body.size !== declaredSize)) { this.onerror(); return; }
      this.status = start ? uploadStartStatus : uploadPutStatus;
      if (start) {
        declaredSize = Number(this.headers['X-Goog-Upload-Content-Length']);
        this.responseHeaders = missingUploadUrl ? {} : {'x-goog-upload-url': 'https://docs.google.com/upload/temporaryblob/videos?authuser=0&upload_id=fixture'};
        this.responseText = '';
      } else {
        this.responseHeaders = {'x-goog-upload-status': 'final'};
        this.responseText = badHandle ? '["bad"]' : '["uploaded-image-handle-xxxxxxxx"]';
      }
      this.onload();
    }
  }
  const fakeFetch = async (url, options = {}) => {
    calls.push({url: String(url), options});
    if (String(url).includes('/genai/quotaSummary')) return new Response(quotaBody, {status: quotaStatus});
    if (String(url).startsWith('/upload/')) return new Response('', {headers: {'X-Goog-Upload-URL': 'https://docs.google.com/upload/temporaryblob/videos?authuser=0&upload_id=fixture'}});
    if (String(url).startsWith('https://docs.google.com/upload/')) return new Response(badHandle ? '["bad"]' : '["uploaded-image-handle-xxxxxxxx"]');
    const learning = options.body?.includes('Original prompt');
    return new Response(JSON.stringify(result).replace('c=fixture', learning || reused ? 'c=previous' : 'c=fixture'), {status: learning ? 200 : generateStatus});
  };
  const context = vm.createContext({URL, Headers, Request, Response, Blob, Uint8Array, Uint32Array, crypto, AbortSignal, atob, Date, console, XMLHttpRequest: FakeXHR, location: {href: 'https://docs.google.com/videos/d/fixture/edit', origin: 'https://docs.google.com'}, fetch: fakeFetch});
  context.window = context;
  if (legacy) Object.defineProperty(context, '__affVidsBridge', {value: {status: () => ({installed: true, ready: false}), run: () => { throw new Error('OLD_BRIDGE_MUST_NOT_RUN'); }}, configurable: false});
  if (installPage) {
    vm.runInContext(fs.readFileSync(path.join(extension, 'protocol.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(extension, 'page.js'), 'utf8'), context);
  }
  const requestUrl = 'https://appsgenaiserver-pa.clients6.google.com/v1/genai/generate?key=fixture-not-real';
  const headers = {authorization: 'SAPISIDHASH fixture-not-real', 'x-server-token': 'fixture-server-token-not-real', 'x-goog-authuser': '0', 'content-type': 'application/json+protobuf'};
  const capture = async () => {
    if (fetchRequest) {
      await context.fetch(requestUrl, {method: 'POST', headers, body: JSON.stringify(template())});
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    else {
      const xhr = new context.XMLHttpRequest();
      xhr.open('POST', requestUrl);
      Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
      xhr.send(JSON.stringify(template()));
    }
    calls.length = 0;
  };
  return {context, calls, capture, bridge: context.__affVidsBridgeV4};
}
const job = {prompt: 'New product', image: `data:image/png;base64,${Buffer.from('new image fixture').toString('base64')}`};
test('in-page upload → new image handle → generate → video, no auth in status', async () => {
  const {calls, capture, bridge} = pageHarness();
  assert.equal(bridge.status().ready, false);
  await capture();
  assert.equal(bridge.status().ready, true);
  assert.doesNotMatch(JSON.stringify(bridge.status()), /SAPISID|server-token|fixture-not-real/);
  const output = await bridge.run(job);
  assert.equal(output.ok, true);
  assert.equal(output.width, 720);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.headers['X-Goog-Upload-Content-Length'], String(Buffer.from('new image fixture').length));
  assert.equal(calls[1].options.method, 'PUT');
  assert.equal(calls[1].options.headers['X-Goog-Upload-Command'], 'upload, finalize');
  assert.equal(calls[1].options.headers['X-Goog-Upload-Offset'], '0');
  assert.equal(calls[1].options.body.size, Number(calls[0].options.headers['X-Goog-Upload-Content-Length']));
  const submitted = JSON.parse(calls[2].options.body);
  assert.equal(submitted[2][25][0][0][1][8][3], 'uploaded-image-handle-xxxxxxxx');
  assert.equal(submitted[3][3][0][0][2], 'New product');
  assert.equal(calls[2].options.headers.authorization, 'SAPISIDHASH fixture-not-real');
});
test('fetch-based capture works and generation errors never trigger retries', async () => {
  const {calls, capture, bridge} = pageHarness({generateStatus: 429, fetchRequest: true});
  await capture();
  const output = await bridge.run(job);
  assert.equal(output.ok, false);
  assert.equal(output.code, 'GENERATE_HTTP_429');
  assert.equal(output.uncertain, true);
  assert.equal(calls.filter(call => call.url.includes('/genai/generate')).length, 1);
  assert.doesNotMatch(JSON.stringify(output), /SAPISID|fixture-server-token|key=/);
});
test('invalid upload result blocks generation', async () => {
  const {calls, capture, bridge} = pageHarness({badHandle: true});
  await capture();
  const output = await bridge.run(job);
  assert.equal(output.code, 'INVALID_UPLOAD_RESPONSE');
  assert.equal(output.uncertain, false);
  assert.equal(calls.filter(call => call.url.includes('/genai/generate')).length, 0);
});
test('refuse a response that returns the learned clip instead of a new result', async () => {
  const {capture, bridge} = pageHarness({reused: true});
  await capture();
  const output = await bridge.run(job);
  assert.equal(output.code, 'REUSED_VIDEO_RESULT');
  assert.equal(output.uncertain, true);
});
test('fetch capture only becomes ready after the learning request produces a video', async () => {
  const {capture, bridge} = pageHarness({fetchRequest: true});
  await capture();
  assert.equal(bridge.status().ready, true);
  assert.equal((await bridge.run(job)).ok, true);
});
test('missing upload URL produces an exact diagnostic and does not call Generate', async () => {
  const {capture, bridge, calls} = pageHarness({missingUploadUrl: true});
  await capture();
  const output = await bridge.run(job);
  assert.equal(output.code, 'UPLOAD_START_URL_MISSING');
  assert.equal(output.stage, 'upload_start');
  assert.equal(output.uncertain, false);
  assert.equal(calls.length, 1);
});
test('distinguish upload-init and PUT network failures without retrying', async () => {
  for (const [step, code, count] of [['start', 'UPLOAD_START_NETWORK_ERROR', 1], ['put', 'UPLOAD_PUT_NETWORK_ERROR', 2]]) {
    const {capture, bridge, calls} = pageHarness({uploadNetworkStage: step});
    await capture();
    const output = await bridge.run(job);
    assert.equal(output.code, code);
    assert.equal(output.uncertain, false);
    assert.equal(calls.length, count);
    assert.doesNotMatch(JSON.stringify(output), /SAPISID|fixture-not-real|upload_id/);
  }
});
test('upload HTTP failures remain distinct and never consume a generation call', async () => {
  for (const [settings, code] of [[{uploadStartStatus: 403}, 'UPLOAD_START_HTTP_403'], [{uploadPutStatus: 400}, 'UPLOAD_PUT_HTTP_400']]) {
    const {capture, bridge, calls} = pageHarness(settings);
    await capture();
    assert.equal((await bridge.run(job)).code, code);
    assert.equal(calls.filter(call => call.url.includes('/genai/generate')).length, 0);
  }
});
test('upload-only probe works without a learned generation and never returns an asset token', async () => {
  const {bridge, calls} = pageHarness();
  assert.equal(bridge.status().ready, false);
  const output = await bridge.run({...job, prompt: '', uploadOnly: true});
  assert.equal(output.ok, true);
  assert.equal(output.uploadOnly, true);
  assert.equal(calls.length, 2);
  assert.equal(calls.filter(call => call.url.includes('/genai/generate')).length, 0);
  assert.doesNotMatch(JSON.stringify(output), /image-handle|token|url/);
});
test('versioned bridge can install over an old non-configurable slot without a Vids reload', async () => {
  const {bridge, context, calls} = pageHarness({legacy: true});
  assert.equal(context.__affVidsBridge.status().protocolVersion, undefined);
  assert.equal(bridge.status().protocolVersion, 4);
  assert.equal(bridge.status().uploadReady, true);
  assert.equal(bridge.status().ready, false);
  assert.equal((await bridge.run({...job, prompt: '', uploadOnly: true})).ok, true);
  assert.equal(calls.length, 2);
});
test('controller upgrades old page, passes uploadOnly and completes upload without learning', async () => {
  const page = pageHarness({legacy: true, installPage: false});
  page.context.__affVidsCreateUIV1 = {status: () => ({version: 1, ready: true, busy: false})};
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {value: id === 'token' ? 'a'.repeat(64) : id === 'tab' ? '37' : '', textContent: '', events: {}, addEventListener(name, fn) { this.events[name] = fn; }, replaceChildren() {}, append() {}});
    return nodes.get(id);
  };
  const localCalls = [];
  const installs = [];
  let storedBlueprint;
  let finished;
  const complete = new Promise(resolve => { finished = resolve; });
  const controller = vm.createContext({
    console, URL, AbortSignal, setTimeout, setInterval, clearInterval,
    document: {getElementById: node, createElement: () => ({})},
    chrome: {
      storage: {local: {get: async () => ({}), set: async value => { storedBlueprint = value; }}},
      runtime: {getManifest: () => ({version: '0.3.0'})},
      tabs: {query: async () => [{id: 37, title: 'Fixture Vids'}]},
      scripting: {executeScript: async options => {
        if (options.files) {
          installs.push(options.files);
          for (const file of options.files) vm.runInContext(fs.readFileSync(path.join(extension, file), 'utf8'), page.context);
          return [];
        }
        page.context.__args = options.args;
        return [{result: await vm.runInContext(`(${options.func.toString()})(...__args)`, page.context)}];
      }},
    },
    fetch: async (url, options = {}) => {
      const route = new URL(url).pathname;
      localCalls.push({route, body: options.body ? JSON.parse(options.body) : null});
      if (route === '/worker/next') return Response.json({job: {id: 'fixture-upload', kind: 'upload', image: job.image, prompt: ''}});
      if (route.endsWith('/upload-verified')) { node('stop').events.click(); finished(); }
      return Response.json({ok: true});
    },
  });
  controller.window = controller;
  vm.runInContext(fs.readFileSync(path.join(extension, 'protocol.js'), 'utf8'), controller);
  vm.runInContext(fs.readFileSync(path.join(extension, 'seed.js'), 'utf8'), controller);
  vm.runInContext(fs.readFileSync(path.join(extension, 'controller.js'), 'utf8'), controller);
  assert.equal(node('version').textContent, 'Extension 0.3.0 · Chưa kết nối tab Vids');
  assert.equal(localCalls.length, 0, 'show installed version without connecting or using Google quota');
  node('connect').events.click();
  await complete;
  assert.equal(installs.length, 1);
  assert.equal(localCalls.find(call => call.route === '/worker/status').body.protocolVersion, 4);
  assert.equal(localCalls.find(call => call.route === '/worker/status').body.uploadReady, true);
  assert.equal(localCalls.some(call => call.route.endsWith('/failure')), false);
  assert.equal(page.calls.length, 2);
  assert.equal(page.calls.some(call => call.url.includes('/genai/generate')), false);
  assert.equal(storedBlueprint.affVidsBlueprintV1.schema, 1);
  assert.doesNotMatch(JSON.stringify(storedBlueprint), /SAPISID|fixture-server-token|key=|document-id-fixture|old-image-handle/);
});

function seedBlueprint() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(extension, 'protocol.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(extension, 'seed.js'), 'utf8'), context);
  return JSON.parse(JSON.stringify(context.__affVidsSeed));
}
async function observeQuota(page, authuser = '0') {
  await page.context.fetch('https://appsgenaiserver-pa.clients6.google.com/v1/genai/quotaSummary?key=fixture-not-real', {
    method: 'POST', headers: {authorization: 'SAPISIDHASH fresh-session-fixture', 'x-server-token': 'fresh-server-token-fixture', 'x-goog-authuser': authuser, 'content-type': 'application/json+protobuf'}, body: '[]',
  });
  await new Promise(resolve => setTimeout(resolve, 20));
}
test('persisted blueprint strips document, image, prompt, user and per-request IDs', () => {
  const context = {documentId: 'document-private-fixture', authuser: '2', requestId: 'goog_93848392', assetId: '17330859-4ECA-41C1-B1B0-0A8CEB301A41'};
  const live = protocol.buildPayload(protocol.materializeBlueprint(seedBlueprint(), context), 'Private product prompt', 'private-image-handle-fixture');
  const serialized = JSON.stringify(protocol.createBlueprint(live));
  assert.doesNotMatch(serialized, /document-private|goog_93848392|17330859|Private product|private-image/);
  assert.deepEqual(protocol.createBlueprint(live), seedBlueprint());
  live[4].push('SAPISIDHASH private-auth-fixture');
  assert.throws(() => protocol.createBlueprint(live), /UNSAFE_BLUEPRINT_STRING/);
  const dirty = seedBlueprint(); dirty.body[4].push('key/private_secret');
  assert.throws(() => protocol.validateBlueprint(dirty), /UNSAFE_BLUEPRINT_STRING/);
});
test('saved configuration plus observed quota read allows generation without a learning clip', async () => {
  const page = pageHarness();
  page.bridge.restoreBlueprint(seedBlueprint());
  assert.equal(page.bridge.status().ready, false);
  await observeQuota(page, '2');
  assert.equal(page.bridge.status().ready, true);
  assert.equal(page.calls.filter(call => call.url.includes('/genai/generate')).length, 0);
  assert.equal((await page.bridge.run(job)).ok, true);
  const generates = page.calls.filter(call => call.url.includes('/genai/generate'));
  assert.equal(generates.length, 1);
  const payload = JSON.parse(generates[0].options.body);
  assert.equal(payload[2][8][3][0][0][7][2][0][0], 'fixture');
  assert.equal(payload[2][6], '2');
  assert.equal(payload[2][25][0][0][7][1][11][8][3], 'uploaded-image-handle-xxxxxxxx');
  assert.doesNotMatch(JSON.stringify(payload), /__AFF_/);
  assert.match(page.calls[1].url, /authuser=2/);
});
test('readiness does not expire after the former five-minute cutoff', async () => {
  const page = pageHarness();
  page.bridge.restoreBlueprint(seedBlueprint());
  await observeQuota(page);
  page.context.Date = class extends Date { static now() { return Date.now() + 2 * 60 * 60_000; } };
  assert.equal(page.bridge.status().ready, true);
  assert.equal(page.bridge.status().ageSec >= 7200, true);
  assert.equal(page.calls.length, 1);
});
test('tab restart restores only configuration and obtains fresh session without generating', async () => {
  const original = pageHarness();
  original.bridge.restoreBlueprint(seedBlueprint());
  await observeQuota(original);
  const fresh = pageHarness();
  fresh.bridge.restoreBlueprint(JSON.parse(JSON.stringify(original.bridge.exportBlueprint())));
  assert.equal(fresh.bridge.status().hasBlueprint, true);
  assert.equal(fresh.bridge.status().sessionReady, false);
  await observeQuota(fresh);
  assert.equal(fresh.bridge.status().ready, true);
  assert.equal(fresh.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(fresh.bridge.exportBlueprint()), /SAPISID|fresh-server|key=/);
});
test('authentication rejection keeps settings and prevents another Generate until reconnection', async () => {
  const page = pageHarness({generateStatus: 403});
  page.bridge.restoreBlueprint(seedBlueprint());
  await observeQuota(page);
  assert.equal((await page.bridge.run(job)).code, 'GENERATE_HTTP_403');
  assert.equal(page.bridge.status().hasBlueprint, true);
  assert.equal(page.bridge.status().sessionReady, false);
  assert.equal((await page.bridge.run(job)).code, 'SESSION_RECONNECT_REQUIRED');
  assert.equal(page.calls.filter(call => call.url.includes('/genai/generate')).length, 1);
  await observeQuota(page);
  assert.equal(page.bridge.status().ready, true);
  assert.equal(page.calls.filter(call => call.url.includes('/genai/generate')).length, 1);
});
test('failed quota read or error body cannot make a persisted configuration ready', async () => {
  for (const options of [{quotaStatus: 403}, {quotaBody: '{"error":{"code":403}}'}, {quotaBody: 'null'}]) {
    const page = pageHarness(options);
    page.bridge.restoreBlueprint(seedBlueprint());
    await observeQuota(page);
    assert.equal(page.bridge.status().ready, false);
    assert.equal(page.bridge.status().hasBlueprint, true);
    assert.equal((await page.bridge.run(job)).code, 'SESSION_RECONNECT_REQUIRED');
    assert.equal(page.calls.length, 1);
  }
});

test('native Create controller downloads only the returned MP4 and completes once without legacy generation', async () => {
  const page = pageHarness();
  let nativeGenerations = 0, downloads = 0, completions = 0, completedBody;
  page.context.__affVidsCreateUIV1 = {status: () => ({version: 1, ready: true, busy: false}), run: async (action, input) => {
    assert.equal(action, 'generate-create'); assert.equal(input.confirmGeneration, true); nativeGenerations++;
    return {ok: true, url: result[0][0][2][4], width: 720, height: 1280};
  }};
  const nodes = new Map();
  const node = id => {if (!nodes.has(id)) nodes.set(id, {value: id === 'token' ? 'a'.repeat(64) : id === 'tab' ? '37' : '', textContent: '', events: {}, addEventListener(name, fn) {this.events[name] = fn;}, replaceChildren() {}, append() {}}); return nodes.get(id);};
  let finish; const complete = new Promise(resolve => {finish = resolve;});
  const mp4 = Buffer.concat([Buffer.from([0,0,0,24]), Buffer.from('ftypisom'), Buffer.alloc(24)]);
  const controller = vm.createContext({console, URL, Blob, AbortSignal, setTimeout, setInterval, clearInterval,
    document: {getElementById: node, createElement: () => ({})},
    chrome: {storage: {local: {get: async () => ({}), set: async () => {}}}, runtime: {getManifest: () => ({version: '0.3.0'})}, tabs: {query: async () => [{id: 37}]}, scripting: {executeScript: async options => {
      if (options.files) {for (const file of options.files) vm.runInContext(fs.readFileSync(path.join(extension, file), 'utf8'), page.context); return [];}
      page.context.__args = options.args; return [{result: await vm.runInContext(`(${options.func.toString()})(...__args)`, page.context)}];
    }}},
    fetch: async (url, options = {}) => {
      const parsed = new URL(url);
      if (parsed.hostname === protocol.RESULT_HOST) {downloads++; const response = new Response(mp4); Object.defineProperty(response, 'url', {value: String(url)}); return response;}
      if (parsed.pathname === '/worker/next') return Response.json({job: {id: '00000000-0000-4000-8000-000000000099', kind: 'generate', engine: 'create-ui', image: job.image, prompt: job.prompt}});
      if (parsed.pathname.endsWith('/result')) {completions++; completedBody = Buffer.from(await options.body.arrayBuffer()); node('stop').events.click(); finish();}
      return Response.json({ok: true});
    },
  });
  controller.window = controller;
  for (const file of ['protocol.js', 'seed.js', 'controller.js']) vm.runInContext(fs.readFileSync(path.join(extension, file), 'utf8'), controller);
  node('connect').events.click(); await complete;
  assert.equal(nativeGenerations, 1); assert.equal(downloads, 1); assert.equal(completions, 1);
  assert.deepEqual(completedBody, mp4);
  assert.equal(page.calls.some(call => call.url.includes('/genai/generate')), false);
});
