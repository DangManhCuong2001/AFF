import http from 'node:http';
import {randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {readFile, mkdir, writeFile, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_MAX = 5 * 1024 * 1024;
const VIDEO_MAX = 80 * 1024 * 1024;
function fail(status, code) { return Object.assign(new Error(code), {status}); }
async function body(req, max) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw fail(413, 'BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(req, max = 8192) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'JSON_REQUIRED');
  try { return JSON.parse((await body(req, max)).toString('utf8')); }
  catch (error) { if (error.status) throw error; throw fail(400, 'INVALID_JSON'); }
}
function imageInput(value) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value || '');
  if (!match) throw fail(400, 'INVALID_IMAGE');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 16 || bytes.length > IMAGE_MAX || bytes.toString('base64') !== match[2]) throw fail(400, 'INVALID_IMAGE');
  const mime = match[1];
  const valid = mime === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : mime === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw fail(400, 'IMAGE_TYPE_MISMATCH');
  return value;
}
function safeJob(job) {
  return {id: job.id, kind: job.kind, engine: job.engine || 'legacy', status: job.status, createdAt: job.createdAt, code: job.code || null, uncertain: !!job.uncertain, ...(job.status === 'complete' && job.kind === 'generate' ? {clip: `/clips/${job.id}.mp4`} : {})};
}
function browserOriginAllowed(origin, host) {
  if (!origin || origin === `http://${host}`) return true;
  if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  const configured = String(process.env.AFF_PRODUCTION_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  return configured.includes(origin);
}
function uiResult(value) {
  const text = value => typeof value === 'string' && value.length <= 140 && !/https?:|@|[A-Za-z0-9_-]{45,}/.test(value) ? value : '[omitted]';
  return {
    ok: value?.ok === true,
    code: typeof value?.code === 'string' && /^[A-Z_]{1,70}$/.test(value.code) ? value.code : null,
    controls: (Array.isArray(value?.controls) ? value.controls : []).slice(0, 160).map(item => ({label: text(item?.label), role: text(item?.role), selected: item?.selected === true, disabled: item?.disabled === true})),
    state: value?.state ? {mode: value.state.mode === 'create' ? 'create' : 'other', portrait: value.state.portrait === true, eightSeconds: value.state.eightSeconds === true, summary: text(value.state.summary), busy: value.state.busy === true, prepared: value.state.prepared === true} : null,
    fields: (Array.isArray(value?.fields) ? value.fields : []).slice(0, 30).map(item => ({label: text(item?.label), type: text(item?.type), accept: text(item?.accept)})),
  };
}

export function createBridge({outputDir = path.resolve('output/google-vids-bridge'), maxJobs = 3, jobTimeoutMs = 15 * 60_000, sessionToken, completedJobs = []} = {}) {
  // Trusted local restart tooling can keep an existing pairing in memory.
  // This option is never accepted over HTTP or written to disk.
  if (sessionToken !== undefined && !/^[a-f0-9]{64}$/.test(sessionToken)) throw new Error('INVALID_SESSION_TOKEN');
  const token = sessionToken || randomBytes(32).toString('hex');
  const jobs = new Map();
  for (const job of completedJobs) {
    if (!job || !/^[a-f0-9-]{36}$/.test(job.id) || job.status !== 'complete' || !['generate', 'upload'].includes(job.kind) || !Number.isFinite(job.createdAt)) throw new Error('INVALID_COMPLETED_JOB');
    jobs.set(job.id, {id: job.id, kind: job.kind, status: 'complete', createdAt: job.createdAt, engine: job.engine === 'create-ui' ? 'create-ui' : 'legacy'});
  }
  let worker = {installed: false, ready: false, at: 0};
  const uiChecks = new Map();
  let usedJobs = 0;
  function authenticated(req) {
    const given = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const cookie = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('aff_vids_pair='))?.slice(14) || '';
    return [given, cookie].some(value => /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value), Buffer.from(token)));
  }
  const server = http.createServer(async (req, res) => {
    const port = server.address()?.port;
    const host = `127.0.0.1:${port}`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (status, value) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); };
    try {
      if (req.headers.host !== host) throw fail(403, 'INVALID_HOST');
      const origin = req.headers.origin;
      const extension = typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
      if (!browserOriginAllowed(origin, host)) throw fail(403, 'INVALID_ORIGIN');
      if (origin && origin !== `http://${host}`) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.writeHead(204, {'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type'}); res.end(); return;
      }
      const url = new URL(req.url, `http://${host}`);
      if (req.method === 'GET' && url.pathname === '/health') { send(200, {service: 'aff-vids-local', version: 1}); return; }
      if (req.method === 'GET' && ['/', '/dashboard.js', '/controller.css'].includes(url.pathname)) {
        if (origin && extension) throw fail(403, 'DASHBOARD_BROWSER_ONLY');
        if (req.headers['sec-fetch-site'] && !['none', 'same-origin'].includes(req.headers['sec-fetch-site'])) throw fail(403, 'CROSS_SITE_NAVIGATION');
        const name = url.pathname === '/' ? 'dashboard.html' : url.pathname === '/controller.css' ? 'extension/controller.css' : 'dashboard.js';
        const content = await readFile(path.join(HERE, name));
        if (url.pathname === '/') res.setHeader('Set-Cookie', `aff_vids_pair=${token}; HttpOnly; SameSite=Strict; Path=/`);
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
        res.writeHead(200, {'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8'});
        res.end(content); return;
      }
      if (!authenticated(req)) throw fail(401, 'NOT_PAIRED');
      if (req.method === 'GET' && url.pathname === '/pairing') { send(200, {token, maxJobs, remainingJobs: Math.max(0, maxJobs - usedJobs)}); return; }
      if (req.method === 'GET' && url.pathname === '/status') {
        for (const job of jobs.values()) {
          if (job.status === 'running' && Date.now() - job.startedAt > jobTimeoutMs) { job.status = 'failed'; job.code = 'WORKER_TIMEOUT'; job.uncertain = true; delete job.image; delete job.prompt; }
          if (job.status === 'pending' && Date.now() - job.createdAt > jobTimeoutMs) { job.status = 'failed'; job.code = 'QUEUE_EXPIRED'; delete job.image; delete job.prompt; }
        }
        send(200, {worker: {...worker, connected: Date.now() - worker.at < 15_000}, jobs: [...jobs.values()].map(safeJob), remainingJobs: Math.max(0, maxJobs - usedJobs)}); return;
      }
      if (req.method === 'POST' && url.pathname === '/worker/status') {
        const value = await jsonBody(req);
        const compatible = value.protocolVersion === 4;
        worker = {installed: value.installed === true, compatible, version: typeof value.version === 'string' && /^\d+\.\d+\.\d+$/.test(value.version) ? value.version : null, nativeProtocol: compatible && value.nativeProtocol === 1 ? 1 : 0, nativeReady: compatible && value.nativeProtocol === 1 && value.nativeReady === true, legacyReady: value.legacyReady === undefined ? value.ready === true : value.legacyReady === true, uiTools: compatible && value.uiTools === true, uploadReady: compatible && value.uploadReady === true, ready: compatible && value.ready === true, hasBlueprint: value.hasBlueprint === true, sessionReady: value.sessionReady === true, busy: value.busy === true, ageSec: Number.isFinite(value.ageSec) ? value.ageSec : null, error: typeof value.error === 'string' && /^[A-Z_]{1,70}$/.test(value.error) ? value.error : null, at: Date.now()};
        send(200, {ok: true}); return;
      }
      // These checks use the extension's existing scripting permission. They
      // cannot click Generate, submit a prompt, read cookies or execute JS input.
      if (req.method === 'POST' && url.pathname === '/ui') {
        const value = await jsonBody(req, 7 * 1024 * 1024);
        if (!['inspect', 'select-animate', 'select-create', 'open-settings', 'prepare-create'].includes(value.action)) throw fail(400, 'UI_ACTION_UNSUPPORTED');
        if (!worker.uiTools || Date.now() - worker.at >= 15_000) throw fail(409, 'UI_EXTENSION_UPDATE_REQUIRED');
        if ([...jobs.values()].some(job => ['pending', 'running'].includes(job.status))) throw fail(409, 'JOB_ALREADY_ACTIVE');
        if ([...uiChecks.values()].some(check => ['pending', 'running'].includes(check.status) && Date.now() - check.createdAt < (check.action === 'prepare-create' ? 120_000 : 30_000))) throw fail(409, 'UI_CHECK_ACTIVE');
        // Bound diagnostic memory; no queued check is ever retried.
        for (const [id, check] of uiChecks) if (Date.now() - check.createdAt > 5 * 60_000) uiChecks.delete(id);
        const input = value.action === 'prepare-create' ? {image: imageInput(value.image), prompt: typeof value.prompt === 'string' && value.prompt.trim() && value.prompt.length <= 4000 ? value.prompt.trim() : null} : null;
        if (input && !input.prompt) throw fail(400, 'INVALID_PROMPT');
        const check = {id: randomUUID(), action: value.action, input, status: 'pending', createdAt: Date.now()};
        uiChecks.set(check.id, check);
        send(202, {id: check.id}); return;
      }
      if (req.method === 'GET' && url.pathname === '/worker/ui') {
        if (!worker.uiTools || url.searchParams.get('version') !== '1') throw fail(409, 'UI_EXTENSION_UPDATE_REQUIRED');
        if ([...jobs.values()].some(job => job.status === 'running')) {send(200, {check: null}); return;}
        const check = [...uiChecks.values()].find(check => check.status === 'pending' && Date.now() - check.createdAt < (check.action === 'prepare-create' ? 120_000 : 30_000));
        if (check) check.status = 'running';
        send(200, {check: check ? {id: check.id, action: check.action, ...(check.input ? {input: check.input} : {})} : null}); return;
      }
      const uiCheck = /^\/ui\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (uiCheck) {
        const check = uiChecks.get(uiCheck[1]);
        if (!check) throw fail(404, 'UI_CHECK_NOT_FOUND');
        if (req.method === 'POST') {
          if (check.status !== 'running') throw fail(409, 'UI_CHECK_NOT_RUNNING');
          check.result = uiResult(await jsonBody(req, 48 * 1024));
          check.status = 'complete'; delete check.input;
          send(200, {ok: true}); return;
        }
        if (req.method === 'GET') {
          send(200, {id: check.id, action: check.action, status: check.status === 'complete' ? 'complete' : Date.now() - check.createdAt > (check.action === 'prepare-create' ? 120_000 : 30_000) ? 'expired' : check.status, result: check.result || null}); return;
        }
      }
      if (req.method === 'POST' && url.pathname === '/jobs') {
        const value = await jsonBody(req, 7 * 1024 * 1024);
        const kind = value.kind === 'upload' ? 'upload' : 'generate';
        const engine = kind === 'generate' && value.engine === 'create-ui' ? 'create-ui' : 'legacy';
        if (value.engine && !['create-ui', 'legacy'].includes(value.engine)) throw fail(400, 'INVALID_ENGINE');
        if (engine === 'create-ui' && worker.nativeProtocol !== 1) throw fail(409, 'NATIVE_EXTENSION_UPDATE_REQUIRED');
        if (worker.installed && !worker.compatible) throw fail(409, 'WORKER_VERSION_MISMATCH');
        if (Date.now() - worker.at >= 15_000 || !(kind === 'upload' ? worker.uploadReady : engine === 'create-ui' ? worker.nativeReady : worker.legacyReady ?? worker.ready)) throw fail(409, 'WORKER_NOT_READY');
        if ([...jobs.values()].some(job => ['pending', 'running'].includes(job.status))) throw fail(409, 'JOB_ALREADY_ACTIVE');
        if (usedJobs >= maxJobs) throw fail(429, 'LOCAL_JOB_LIMIT');
        if ([...uiChecks.values()].some(check => ['pending', 'running'].includes(check.status) && Date.now() - check.createdAt < (check.action === 'prepare-create' ? 120_000 : 30_000))) throw fail(409, 'UI_CHECK_ACTIVE');
        if (kind === 'generate' && value.confirmGeneration !== true) throw fail(400, 'CONFIRM_GENERATION_REQUIRED');
        if (kind === 'generate' && (typeof value.prompt !== 'string' || !value.prompt.trim() || value.prompt.length > 4000)) throw fail(400, 'INVALID_PROMPT');
        const image = imageInput(value.image);
        const job = {id: randomUUID(), kind, engine, status: 'pending', prompt: kind === 'generate' ? value.prompt.trim() : '', image, createdAt: Date.now()};
        jobs.set(job.id, job); usedJobs++;
        send(202, safeJob(job)); return;
      }
      if (req.method === 'GET' && url.pathname === '/worker/next') {
        if (url.searchParams.get('protocolVersion') !== '4' || !worker.compatible) throw fail(409, 'WORKER_VERSION_MISMATCH');
        if ([...jobs.values()].some(job => job.status === 'running')) { send(200, {job: null}); return; }
        const job = [...jobs.values()].find(job => job.status === 'pending' && (job.engine !== 'create-ui' || url.searchParams.get('nativeProtocol') === '1') && (url.searchParams.get('allowGenerate') !== '0' || job.kind === 'upload'));
        if (job) { job.status = 'running'; job.startedAt = Date.now(); send(200, {job: {id: job.id, kind: job.kind, engine: job.engine || 'legacy', prompt: job.prompt, image: job.image}}); }
        else send(200, {job: null});
        return;
      }
      const action = /^\/jobs\/([a-f0-9-]{36})\/(result|failure|upload-verified)$/.exec(url.pathname);
      if (req.method === 'POST' && action) {
        const job = jobs.get(action[1]);
        if (!job) throw fail(404, 'UNKNOWN_JOB');
        // Timeout may have happened after Google accepted the request. A late result
        // can still recover the job, but it never triggers another generation.
        if (job.status !== 'running' && !(job.status === 'failed' && job.code === 'WORKER_TIMEOUT')) throw fail(409, 'JOB_NOT_RUNNING');
        if (action[2] === 'failure') {
          const value = await jsonBody(req);
          job.status = 'failed'; job.code = typeof value.code === 'string' && /^[A-Z][A-Z0-9_]{1,70}$/.test(value.code) ? value.code : 'WORKER_FAILED'; job.uncertain = value.uncertain === true;
        } else if (action[2] === 'upload-verified') {
          if (job.kind !== 'upload') throw fail(409, 'NOT_AN_UPLOAD_TEST');
          job.status = 'complete'; job.uncertain = false; delete job.code;
        } else {
          if (job.kind !== 'generate') throw fail(409, 'NOT_A_VIDEO_JOB');
          if (req.headers['content-type'] !== 'video/mp4') throw fail(415, 'MP4_REQUIRED');
          const data = await body(req, VIDEO_MAX);
          if (data.length < 24 || data.toString('ascii', 4, 8) !== 'ftyp') throw fail(400, 'INVALID_MP4');
          await mkdir(outputDir, {recursive: true});
          const destination = path.join(outputDir, `${job.id}.mp4`);
          const temporary = `${destination}.part`;
          try { await writeFile(temporary, data, {mode: 0o600}); await rename(temporary, destination); }
          catch (error) { await unlink(temporary).catch(() => {}); throw error; }
          job.status = 'complete'; job.uncertain = false; delete job.code;
        }
        delete job.image; delete job.prompt;
        send(200, safeJob(job)); return;
      }
      const clip = /^\/clips\/([a-f0-9-]{36})\.mp4$/.exec(url.pathname);
      if (req.method === 'GET' && clip && jobs.get(clip[1])?.status === 'complete' && jobs.get(clip[1])?.kind === 'generate') {
        const data = await readFile(path.join(outputDir, `${clip[1]}.mp4`));
        res.writeHead(200, {'Content-Type': 'video/mp4', 'Content-Length': data.length, 'Content-Disposition': `inline; filename="${clip[1]}.mp4"`}); res.end(data); return;
      }
      throw fail(404, 'NOT_FOUND');
    } catch (error) { if (!res.headersSent && !res.destroyed) send(error.status || 500, {error: error.status ? error.message : 'LOCAL_ERROR'}); else res.destroy(); }
  });
  server.requestTimeout = 15 * 60_000;
  return {server};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {server} = createBridge();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Cổng 4317 đang được dùng. Dừng bản bridge cũ trước khi khởi động.' : 'Không khởi động được local bridge.'); process.exitCode = 1; });
  server.listen(4317, '127.0.0.1', () => console.log('Google Vids local experiment: http://127.0.0.1:4317 — giới hạn 3 tác vụ/lần chạy.'));
}
