import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createBridge} from '../../tools/google-vids-bridge/server.mjs';

test('local restart rejects invalid pairings and never restores an active generation', () => {
  assert.throws(() => createBridge({sessionToken: 'bad'}), /INVALID_SESSION_TOKEN/);
  assert.throws(() => createBridge({completedJobs: [{id: 'f'.repeat(36), kind: 'generate', status: 'running', createdAt: Date.now()}]}), /INVALID_COMPLETED_JOB/);
  const {server} = createBridge({sessionToken: 'a'.repeat(64), completedJobs: [{id: '00000000-0000-4000-8000-000000000001', kind: 'generate', status: 'complete', createdAt: Date.now()}]});
  server.close();
});
import {request} from 'node:http';

const png = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(24).fill(0)]).toString('base64')}`;
async function setup(t, options = {}) {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'aff-vids-test-'));
  const {server} = createBridge({outputDir, ...options});
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(outputDir, {recursive: true, force: true}); });
  const landing = await fetch(base);
  const cookie = landing.headers.get('set-cookie').split(';')[0];
  const {token} = await (await fetch(`${base}/pairing`, {headers: {Cookie: cookie}})).json();
  const call = (route, method = 'GET', data, extra = {}) => fetch(`${base}${route}`, {method, headers: {Authorization: `Bearer ${token}`, ...(data ? {'Content-Type': 'application/json'} : {}), ...extra}, ...(data ? {body: JSON.stringify(data)} : {})});
  const ready = () => call('/worker/status', 'POST', {installed: true, protocolVersion: 4, version: '0.2.0', uploadReady: true, ready: true});
  const submit = (extra = {}) => call('/jobs', 'POST', {prompt: 'Product fixture', image: png, confirmGeneration: true, ...extra});
  return {base, token, call, ready, submit, outputDir};
}
test('pairing and all task endpoints require local auth; hostile origins and hosts rejected', async t => {
  const {base, token, call} = await setup(t);
  assert.equal((await fetch(`${base}/status`)).status, 401);
  assert.equal((await fetch(`${base}/pairing`)).status, 401);
  assert.equal((await call('/status', 'GET', null, {Origin: 'https://evil.example'})).status, 403);
  const hostileHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${base}/status`, {headers: {Host: 'evil.example', Authorization: `Bearer ${token}`}}, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(hostileHostStatus, 403);
  const cors = await call('/status', 'GET', null, {Origin: `chrome-extension://${'a'.repeat(32)}`});
  assert.equal(cors.status, 200);
  assert.doesNotMatch(await cors.text(), new RegExp(token));
  const production = await call('/status', 'GET', null, {Origin: 'https://aff-production.vercel.app'});
  assert.equal(production.status, 200);
  assert.equal(production.headers.get('access-control-allow-origin'), 'https://aff-production.vercel.app');
  const preflight = await fetch(`${base}/status`, {method: 'OPTIONS', headers: {Origin: 'https://aff-production.vercel.app', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization', 'Access-Control-Request-Private-Network': 'true'}});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
  assert.equal((await fetch(`${base}/status`, {headers: {Authorization: `Bearer ${'é'.repeat(64)}`}})).status, 401);
});
test('job requires ready worker, explicit quota confirmation, and real image bytes', async t => {
  const {ready, submit} = await setup(t);
  assert.equal((await submit()).status, 409);
  await ready();
  assert.equal((await submit({confirmGeneration: false})).status, 400);
  assert.equal((await submit({image: 'data:image/png;base64,' + Buffer.from('not-a-png-file-of-sufficient-length').toString('base64')})).status, 400);
  assert.equal((await submit({prompt: ' '})).status, 400);
  assert.equal((await submit()).status, 202);
  assert.equal((await submit()).status, 409);
});
test('lease once, save MP4, strip source payload from status, block duplicate completions', async t => {
  const {base, token, ready, submit, call, outputDir} = await setup(t);
  await ready();
  const job = await (await submit()).json();
  const first = await (await call('/worker/next?protocolVersion=4')).json();
  assert.equal(first.job.id, job.id);
  assert.equal(first.job.image, png);
  assert.deepEqual(await (await call('/worker/next?protocolVersion=4')).json(), {job: null});
  assert.equal((await fetch(`${base}/jobs/${job.id}/result`, {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4'}, body: Buffer.from('invalid file')})).status, 400);
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(24)]);
  const complete = await fetch(`${base}/jobs/${job.id}/result`, {method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4'}, body: mp4});
  assert.equal(complete.status, 200);
  assert.equal((await complete.json()).status, 'complete');
  const status = await (await call('/status')).json();
  assert.equal(status.jobs[0].status, 'complete');
  assert.doesNotMatch(JSON.stringify(status), /Product fixture|base64|Authorization|SAPISID/);
  assert.equal((await call(`/jobs/${job.id}/failure`, 'POST', {code: 'BAD', uncertain: true})).status, 409);
  assert.deepEqual(await readdir(outputDir), [`${job.id}.mp4`]);
  assert.deepEqual(await readFile(path.join(outputDir, `${job.id}.mp4`)), mp4);
  const download = await call(`/clips/${job.id}.mp4`);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), mp4);
});
test('uncertain generation failures never requeue and count toward session limit', async t => {
  const {ready, submit, call} = await setup(t, {maxJobs: 1});
  await ready();
  const {id} = await (await submit()).json();
  await call('/worker/next?protocolVersion=4');
  await call(`/jobs/${id}/failure`, 'POST', {code: 'GENERATE_FAILED', uncertain: true});
  assert.deepEqual(await (await call('/worker/next?protocolVersion=4')).json(), {job: null});
  const status = await (await call('/status')).json();
  assert.equal(status.jobs[0].uncertain, true);
  assert.equal(status.remainingJobs, 0);
  assert.equal((await submit()).status, 429);
});
test('upload-only queue does not require a learned template or generation consent', async t => {
  const {call, submit} = await setup(t);
  await call('/worker/status', 'POST', {installed: true, protocolVersion: 4, uploadReady: true, ready: false});
  assert.equal((await submit()).status, 409);
  const response = await submit({kind: 'upload', prompt: '', confirmGeneration: false});
  assert.equal(response.status, 202);
  const {id} = await response.json();
  const lease = await (await call('/worker/next?allowGenerate=0&protocolVersion=4')).json();
  assert.equal(lease.job.kind, 'upload');
  assert.equal(lease.job.prompt, '');
  const saved = await call(`/jobs/${id}/upload-verified`, 'POST', {});
  assert.equal(saved.status, 200);
  const output = await saved.json();
  assert.equal(output.status, 'complete');
  assert.equal(output.clip, undefined);
});
test('old extension cannot enable upload or lease jobs through installed=true', async t => {
  const {call, submit} = await setup(t);
  await call('/worker/status', 'POST', {installed: true, ready: true});
  assert.equal((await submit({kind: 'upload', confirmGeneration: false})).status, 409);
  const status = await (await call('/status')).json();
  assert.equal(status.worker.compatible, false);
  assert.equal(status.worker.uploadReady, false);
  assert.equal(status.worker.ready, false);
  assert.equal(status.remainingJobs, 3);
  assert.equal((await call('/worker/next')).status, 409);
});

test('UI checks are paired, allowlisted, leased once and never spend generation quota', async t => {
  const {call, submit} = await setup(t, {maxJobs: 0});
  assert.equal((await call('/ui', 'POST', {action: 'inspect'})).status, 409);
  await call('/worker/status', 'POST', {installed: true, protocolVersion: 4, uiTools: true, uploadReady: true, ready: false});
  for (const action of ['generate', 'eval', 'click', 'read-cookies']) assert.equal((await call('/ui', 'POST', {action})).status, 400);
  const check = await (await call('/ui', 'POST', {action: 'inspect'})).json();
  const leased = await (await call('/worker/ui?version=1')).json();
  assert.equal(leased.check.id, check.id);
  assert.deepEqual(await (await call('/worker/ui?version=1')).json(), {check: null});
  assert.equal((await call(`/ui/${check.id}`, 'POST', {ok: true, controls: [{label: 'Animate', role: 'tab', selected: true}, {label: 'private@example.com'}], fields: [{label: 'Prompt', value: 'must not leak'}], cookie: 'must not leak', url: 'https://private.example/'})).status, 200);
  const result = await (await call(`/ui/${check.id}`)).json();
  assert.equal(result.status, 'complete');
  assert.equal(result.result.controls[0].selected, true);
  assert.equal(result.result.controls[1].label, '[omitted]');
  assert.doesNotMatch(JSON.stringify(result), /must not leak|private.example|value|cookie/);
  assert.equal((await call(`/ui/${check.id}`, 'POST', {})).status, 409);
  const state = await (await call('/status')).json();
  assert.equal(state.remainingJobs, 0);
  assert.deepEqual(state.jobs, []);
  assert.equal((await submit()).status, 409);
});

test('Create jobs require native capability and cannot be consumed by an old controller', async t => {
  const {call, ready, submit} = await setup(t);
  await ready();
  assert.equal((await submit({engine: 'create-ui'})).status, 409);
  await call('/worker/status', 'POST', {installed: true, protocolVersion: 4, nativeProtocol: 1, nativeReady: true, ready: true, uploadReady: true});
  const job = await (await submit({engine: 'create-ui'})).json();
  assert.equal(job.engine, 'create-ui');
  assert.deepEqual(await (await call('/worker/next?protocolVersion=4')).json(), {job: null});
  const leased = await (await call('/worker/next?protocolVersion=4&nativeProtocol=1')).json();
  assert.equal(leased.job.engine, 'create-ui');
  assert.equal(leased.job.id, job.id);
  assert.deepEqual(await (await call('/worker/next?protocolVersion=4&nativeProtocol=1')).json(), {job: null});
});

test('native preparation never creates a video job, leaks source data or consumes generation quota', async t => {
  const {call} = await setup(t, {maxJobs: 0});
  await call('/worker/status', 'POST', {installed: true, protocolVersion: 4, uiTools: true, nativeProtocol: 1, nativeReady: true, ready: true});
  const prepared = await call('/ui', 'POST', {action: 'prepare-create', image: png, prompt: 'Synthetic native prompt'});
  assert.equal(prepared.status, 202);
  const {id} = await prepared.json();
  const lease = await (await call('/worker/ui?version=1')).json();
  assert.equal(lease.check.input.image, png);
  await call(`/ui/${id}`, 'POST', {ok: true, state: {mode: 'create', portrait: true, eightSeconds: true, summary: 'Generation settings: Omni, 720p, Portrait, 8 seconds', prompt: 'must not leak', handle: 'must not leak'}});
  const result = await (await call(`/ui/${id}`)).json();
  assert.equal(result.result.state.eightSeconds, true);
  assert.doesNotMatch(JSON.stringify(result), /Synthetic native prompt|base64|must not leak/);
  const status = await (await call('/status')).json();
  assert.deepEqual(status.jobs, []);
  assert.equal(status.remainingJobs, 0);
});
