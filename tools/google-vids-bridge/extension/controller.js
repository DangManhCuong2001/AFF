/* global chrome */
'use strict';
const LOCAL = 'http://127.0.0.1:4317';
const byId = id => document.getElementById(id);
let running = false;
let activeJob = false;
let token = '';
let selectedTab = null;
let savedSignature = '';
const BLUEPRINT_KEY = 'affVidsBlueprintV1';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const show = message => { byId('status').textContent = message; };
// Show the installed manifest version before connecting, even if Vids or the
// local bridge is unavailable. Page-script and extension versions may differ.
byId('version').textContent = `Extension ${chrome.runtime.getManifest().version} · Chưa kết nối tab Vids`;

async function api(path, options = {}) {
  const response = await fetch(`${LOCAL}${path}`, {...options, headers: {...options.headers, Authorization: `Bearer ${token}`}, signal: options.signal || AbortSignal.timeout(15_000)});
  if (!response.ok) throw new Error(`LOCAL_HTTP_${response.status}`);
  return response;
}
async function inPage(action, job) {
  const results = await chrome.scripting.executeScript({
    target: {tabId: selectedTab}, world: 'MAIN',
    func: async (name, input) => {
      const bridge = window.__affVidsBridgeV4 || window.__affVidsBridgeV3 || window.__affVidsBridgeV2 || window.__affVidsBridge;
      if (!bridge) return {installed: false, ready: false};
      if (name === 'status') return bridge.status();
      if (name === 'run') {
        if (bridge.status().protocolVersion !== 4) return {ok: false, code: 'PAGE_VERSION_MISMATCH', uncertain: false};
        return bridge.run(input);
      }
      if (name === 'exportBlueprint') return bridge.exportBlueprint();
      if (name === 'restoreBlueprint') return bridge.restoreBlueprint(input);
      return {ok: false, code: 'UNKNOWN_ACTION'};
    }, args: [action, job || null],
  });
  return results[0]?.result;
}
async function syncBlueprint(status) {
  const protocol = window.__affVidsProtocol;
  if (!status.hasBlueprint) {
    const stored = await chrome.storage.local.get(BLUEPRINT_KEY);
    let value;
    try { value = protocol.validateBlueprint(stored[BLUEPRINT_KEY]); }
    catch { value = protocol.validateBlueprint(window.__affVidsSeed); }
    await inPage('restoreBlueprint', value);
  }
  const exported = await inPage('exportBlueprint');
  if (exported) {
    const value = protocol.validateBlueprint(exported);
    const signature = JSON.stringify(value);
    if (signature !== savedSignature) {
      await chrome.storage.local.set({[BLUEPRINT_KEY]: value});
      savedSignature = signature;
    }
  }
  return inPage('status');
}
async function performUiCheck(check) {
  const native = check.action !== 'select-animate';
  await chrome.scripting.executeScript({target: {tabId: selectedTab}, world: 'MAIN', files: [native ? 'create-ui.js' : 'native-ui.js']});
  const responses = await chrome.scripting.executeScript({target: {tabId: selectedTab}, world: 'MAIN', func: (action, input, useNative) => useNative ? window.__affVidsCreateUIV1.run(action, input) : window.__affVidsNativeUIV1.run(action), args: [check.action, check.input || null, native]});
  await api(`/ui/${check.id}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(responses[0]?.result || {ok: false, code: 'UI_CHECK_FAILED'})});
}
async function nativePage(action, input) {
  const result = await chrome.scripting.executeScript({target: {tabId: selectedTab}, world: 'MAIN', func: (action, input) => action === 'status' ? window.__affVidsCreateUIV1?.status() : window.__affVidsCreateUIV1.run(action, input), args: [action, input || null]});
  return result[0]?.result;
}
async function findTabs() {
  const tabs = await chrome.tabs.query({url: 'https://docs.google.com/videos/*'});
  byId('tab').replaceChildren();
  for (const tab of tabs) {
    const option = document.createElement('option');
    option.value = String(tab.id);
    option.textContent = tab.title || `Google Vids (${tab.id})`;
    byId('tab').append(option);
  }
}
async function reportFailure(id, code, uncertain) {
  await api(`/jobs/${id}/failure`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code, uncertain})});
}
async function perform(job) {
  activeJob = true;
  let submitted = false;
  let heartbeat;
  try {
    show(job.kind === 'upload' ? 'Đang kiểm tra upload ảnh. Không gọi Generate.' : 'Đang tải ảnh và tạo một clip trong Google Vids…');
    submitted = true;
    if (job.engine === 'create-ui') heartbeat = setInterval(() => {void api('/worker/status', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({installed: true, protocolVersion: 4, version: chrome.runtime.getManifest().version, nativeProtocol: 1, nativeReady: false, ready: false, uploadReady: false, busy: true, uiTools: true})}).catch(() => {});}, 3000);
    const result = job.engine === 'create-ui' ? await nativePage('generate-create', {id: job.id, prompt: job.prompt, image: job.image, confirmGeneration: true}) : await inPage('run', {prompt: job.prompt, image: job.image, uploadOnly: job.kind === 'upload'});
    if (!result?.ok) {
      await reportFailure(job.id, result?.code || 'PAGE_DISCONNECTED', result?.uncertain ?? true);
      show(`Đã dừng: ${result?.code || 'PAGE_DISCONNECTED'}. Không tự gửi lại Generate.`);
      running = false;
      return;
    }
    if (result.uploadOnly) {
      await api(`/jobs/${job.id}/upload-verified`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
      show('Upload ảnh thành công. Chưa gọi Generate và chưa tạo clip.');
      return;
    }
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || url.hostname !== window.__affVidsProtocol.RESULT_HOST || url.pathname !== '/download' || url.username || url.password || url.port) throw new Error('INVALID_RESULT_URL');
    show('Đã nhận kết quả Google. Đang tải MP4 về máy…');
    const response = await fetch(url.href, {credentials: 'include', signal: AbortSignal.timeout(120_000)});
    if (!response.ok) throw new Error(`DOWNLOAD_HTTP_${response.status}`);
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== 'https:' || !(finalUrl.hostname === window.__affVidsProtocol.RESULT_HOST || finalUrl.hostname.endsWith('.googleusercontent.com'))) throw new Error('INVALID_DOWNLOAD_HOST');
    const advertisedSize = Number(response.headers.get('content-length'));
    if (advertisedSize > 80 * 1024 * 1024) throw new Error('VIDEO_TOO_LARGE');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 80 * 1024 * 1024) { await reader.cancel(); throw new Error('VIDEO_TOO_LARGE'); }
      chunks.push(value);
    }
    await api(`/jobs/${job.id}/result`, {method: 'POST', headers: {'Content-Type': 'video/mp4'}, body: new Blob(chunks, {type: 'video/mp4'}), signal: AbortSignal.timeout(120_000)});
    show(`Đã lưu clip. Kích thước do Google trả về: ${result.width} × ${result.height}. Xem tại ${LOCAL}.`);
  } catch (error) {
    // Report static codes only, never a captured URL or Chrome exception text.
    const code = /^[A-Z][A-Z0-9_]{1,70}$/.test(error.message) ? error.message : 'BRIDGE_DISCONNECTED';
    await reportFailure(job.id, code, submitted).catch(() => {});
    show(`Đã dừng: ${code}. Nếu Generate đã gửi, kiểm tra lịch sử Vids trước khi thử lại.`);
    running = false;
  } finally { clearInterval(heartbeat); activeJob = false; }
}
async function loop() {
  while (running) {
    try {
      let status = await inPage('status');
      if (status?.protocolVersion !== 4) {
        show('Đang cập nhật script trong tab Vids. Không tạo clip học mẫu…');
        await chrome.scripting.executeScript({target: {tabId: selectedTab}, world: 'MAIN', files: ['protocol.js', 'page.js']});
        status = await inPage('status');
      }
      const compatible = status?.protocolVersion === 4;
      if (compatible) status = await syncBlueprint(status);
      if (!(await nativePage('status'))) await chrome.scripting.executeScript({target: {tabId: selectedTab}, world: 'MAIN', files: ['create-ui.js']});
      const native = await nativePage('status');
      byId('version').textContent = `Extension ${chrome.runtime.getManifest().version} · Tab Vids ${status?.version || 'chưa xác định'}`;
      const ready = !!native?.ready;
      await api('/worker/status', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({installed: !!status?.installed, protocolVersion: status?.protocolVersion, version: chrome.runtime.getManifest().version, nativeProtocol: native?.version, nativeReady: ready, legacyReady: !!status?.ready, uiTools: true, uploadReady: compatible && !!status?.uploadReady, ready: compatible && ready, hasBlueprint: !!status?.hasBlueprint, sessionReady: !!status?.sessionReady, busy: !!status?.busy || !!native?.busy, ageSec: status?.ageSec ?? null, error: status?.error || null})});
      if (!compatible) { show('PAGE_VERSION_MISMATCH: đóng cửa sổ kết nối cũ, tải lại extension và mở cửa sổ mới.'); running = false; continue; }
      const {check} = await (await api('/worker/ui?version=1')).json();
      if (check) await performUiCheck(check);
      const {job} = status?.uploadReady ? await (await api(`/worker/next?allowGenerate=${ready || status?.ready ? '1' : '0'}&protocolVersion=4&nativeProtocol=1`)).json() : {job: null};
      if (job) await perform(job);
      else if (!ready) {
        if (!byId('status').textContent.startsWith('Upload ảnh thành công')) show('Mở bảng AI video trong tab Vids đã đăng nhập để nhận tác vụ Create. Không cần tạo clip mẫu.');
      } else if (!byId('status').textContent.startsWith('Đã lưu') && !byId('status').textContent.startsWith('Upload ảnh thành công')) show('Sẵn sàng. Chọn ảnh và gửi một tác vụ từ trang local.');
    } catch {
      show('Mất kết nối local hoặc tab Vids. Kiểm tra server và tab, rồi nhấn Kết nối lại.');
      running = false;
    }
    if (running) await pause(2000);
  }
  byId('connect').disabled = false;
  byId('stop').disabled = true;
  byId('tab').disabled = false;
  byId('token').disabled = false;
}
byId('refresh').addEventListener('click', () => { if (!running) void findTabs(); });
byId('connect').addEventListener('click', () => {
  if (running || activeJob) return;
  token = byId('token').value.trim();
  selectedTab = Number(byId('tab').value);
  if (!/^[a-f0-9]{64}$/.test(token) || !selectedTab) { show('Chọn tab Vids và nhập mã kết nối local 64 ký tự.'); return; }
  running = true;
  byId('connect').disabled = true;
  byId('stop').disabled = false;
  byId('tab').disabled = true;
  byId('token').disabled = true;
  void loop();
});
byId('reconnect').addEventListener('click', () => {
  if (!selectedTab || activeJob) return;
  void chrome.tabs.reload(selectedTab);
  show('Đang tải lại Vids để nhận phiên mới. Mở bảng tạo video; không cần tạo clip mẫu.');
});
byId('stop').addEventListener('click', () => {
  running = false;
  show(activeJob ? 'Đã ngừng nhận tác vụ mới. Tác vụ đã gửi vẫn có thể hoàn tất và dùng hạn mức.' : 'Đã ngừng nhận tác vụ.');
});
void findTabs();
