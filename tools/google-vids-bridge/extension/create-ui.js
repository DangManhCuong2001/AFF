/* Native Create automation. Google sends its own requests; auth never leaves this tab. */
(function () {
  'use strict';
  const BUILD = 5;
  if (window.__affVidsCreateUIV1?.status().busy) return;
  if (window.__affVidsCreateUIV1?.build === BUILD) return;
  window.__affVidsCreateUIV1?.dispose();
  const protocol = window.__affVidsProtocol;
  const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const label = el => String(el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.textContent || '').trim().replace(/\s+/g, ' ');
  const controls = () => [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]')].filter(visible);
  const safe = text => typeof text === 'string' && text.length <= 180 && !/https?:|@|[A-Za-z0-9_-]{45,}/.test(text) ? text : '[omitted]';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  let busy = false, upload = null, armed = null, prepared = null;
  const submitted = new Set();
  function error(code, uncertain = false) {return Object.assign(new Error(code), {uncertain});}
  function settings() {return controls().find(el => /^Generation settings:/.test(label(el)));}
  function config() {
    const text = label(settings() || {getAttribute: () => '', textContent: ''});
    return {mode: controls().some(el => el.getAttribute('role') === 'tab' && label(el) === 'Create' && el.getAttribute('aria-selected') === 'true') ? 'create' : 'other', portrait: /\bPortrait\b/.test(text), eightSeconds: /\b8 seconds\b/.test(text), summary: safe(text)};
  }
  function inspect() {
    return {ok: true, controls: controls().slice(0, 180).map(el => ({label: safe(label(el)), role: el.getAttribute('role') || 'button', selected: el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true', disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true'})), fields: [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].filter(el => visible(el) || el.type === 'file').slice(0, 30).map(el => ({label: safe(el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''), type: el.type || el.tagName.toLowerCase(), accept: el.type === 'file' ? safe(el.accept) : ''})), state: {...config(), busy, prepared: !!prepared}};
  }
  function press(el) {
    el.scrollIntoView?.({block: 'nearest'});
    for (const type of ['mousedown', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, view: window, button: 0, buttons: type === 'mousedown' ? 1 : 0}));
  }
  function click(regex, role) {
    const found = controls().filter(el => (!role || el.getAttribute('role') === role) && regex.test(label(el)));
    if (found.length !== 1) throw error(found.length ? 'NATIVE_CONTROL_AMBIGUOUS' : 'NATIVE_CONTROL_NOT_FOUND');
    if (found[0].disabled || found[0].getAttribute('aria-disabled') === 'true') throw error('NATIVE_CONTROL_DISABLED');
    press(found[0]); return found[0];
  }
  async function until(predicate, code, ms = 10000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {const value = predicate(); if (value) return value; await pause(100);}
    throw error(code);
  }
  async function selectCreate() {
    if (!controls().some(el => el.getAttribute('role') === 'tab' && label(el) === 'Create')) {
      click(/^Generate an AI video clip$/); await until(() => controls().some(el => el.getAttribute('role') === 'tab' && label(el) === 'Create'), 'NATIVE_CREATE_TAB_MISSING');
    }
    if (config().mode !== 'create') click(/^Create$/, 'tab');
    await until(() => config().mode === 'create', 'NATIVE_CREATE_NOT_SELECTED');
    if (!settings() && controls().some(el => label(el) === 'Expand')) {
      click(/^Expand$/);
      await until(settings, 'NATIVE_SETTINGS_NOT_FOUND');
    }
  }
  async function openSettings() {
    const el = settings(); if (!el) throw error('NATIVE_SETTINGS_NOT_FOUND'); press(el); await pause(200);
  }
  async function configure() {
    await selectCreate();
    if (!config().portrait || !config().eightSeconds) {
      await openSettings();
      if (!config().portrait) {
        const portrait = controls().filter(el => /^(Portrait|Portrait \(9:16\)|Vertical|9:16)$/.test(label(el)));
        if (portrait.length !== 1) throw error('NATIVE_PORTRAIT_CONTROL_NOT_FOUND'); press(portrait[0]); await pause(150);
      }
      if (!config().eightSeconds) {
        const eight = controls().filter(el => /^(8|8s|8 seconds)$/.test(label(el)));
        if (eight.length === 1) press(eight[0]);
        else {
          const field = [...document.querySelectorAll('input')].filter(visible).find(el => /duration|seconds/i.test(el.getAttribute('aria-label') || '') && ['number', 'range'].includes(el.type));
          if (!field) throw error('NATIVE_DURATION_CONTROL_NOT_FOUND');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, '8'); field.dispatchEvent(new Event('input', {bubbles: true})); field.dispatchEvent(new Event('change', {bubbles: true}));
        }
      }
      await until(() => config().portrait && config().eightSeconds, 'NATIVE_SETTINGS_NOT_APPLIED');
    }
    if ([...document.querySelectorAll('input')].some(el => visible(el) && /duration/i.test(el.getAttribute('aria-label') || '') && el.type === 'range')) {press(settings()); await pause(100);}
  }
  function promptField() {
    return [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(visible).find(el => /Describe your video|Add your image, then describe|Specify how you want to use the ingredients|video prompt/i.test(el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''));
  }
  const normalizedPrompt = text => String(text || '').normalize('NFC').replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  function promptText(el) {return normalizedPrompt(el.tagName === 'TEXTAREA' ? el.value : el.innerText || el.textContent || '');}
  async function fillPrompt(text) {
    const field = await until(promptField, 'NATIVE_PROMPT_FIELD_MISSING'); field.focus();
    if (field.tagName === 'TEXTAREA') {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, text);
      field.dispatchEvent(new Event('input', {bubbles: true})); field.dispatchEvent(new Event('change', {bubbles: true}));
    } else {
      const selection = window.getSelection(), range = document.createRange(); range.selectNodeContents(field); selection.removeAllRanges(); selection.addRange(range);
      if (!document.execCommand('insertText', false, text)) throw error('NATIVE_PROMPT_INSERT_FAILED');
    }
    await until(() => promptText(field) === text, 'NATIVE_PROMPT_NOT_APPLIED');
  }
  function endpoint(url) {
    try {const value = new URL(url, location.href); return value.origin === 'https://appsgenaiserver-pa.clients6.google.com' && value.pathname === '/v1/genai/generate';} catch {return false;}
  }
  function isUpload(url, method) {
    try {const value = new URL(url, location.href); return method.toUpperCase() === 'PUT' && value.origin === 'https://docs.google.com' && value.pathname === '/upload/temporaryblob/videos';} catch {return false;}
  }
  function guard(body) {
    if (!armed) return null;
    const current = armed;
    try {
      if (current.requestSeen) throw error('NATIVE_DUPLICATE_GENERATE_BLOCKED', true);
      const parsed = protocol.inspectTemplate(body);
      let handle = parsed.data; for (const index of parsed.imagePath) handle = handle[index];
      if (normalizedPrompt(parsed.data[3][3][0][0][2]) !== current.prompt || handle !== current.handle) throw error('NATIVE_REFERENCE_OR_PROMPT_MISMATCH');
      current.requestSeen = true; submitted.add(current.id); return current;
    } catch (cause) {current.reject(error(cause.message === 'NATIVE_REFERENCE_OR_PROMPT_MISMATCH' || cause.message === 'NATIVE_DUPLICATE_GENERATE_BLOCKED' ? cause.message : 'NATIVE_TEMPLATE_UNSUPPORTED', cause.uncertain)); throw cause;}
  }
  function result(current, text, ok) {
    if (!current) return;
    if (!ok) {current.reject(error('NATIVE_GENERATE_HTTP_FAILED', true)); return;}
    try {current.resolve({ok: true, ...protocol.videoResult(text), engine: 'create-ui'});} catch {current.reject(error('NATIVE_RESULT_NOT_FOUND_CHECK_VIDS', true));}
  }
  function uploaded(text, ok) {if (upload && ok) {try {upload.resolve(protocol.uploadHandle(text));} catch {upload.reject(error('NATIVE_UPLOAD_RESPONSE_INVALID'));}}}
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = input instanceof Request ? input.url : String(input), method = init?.method || (input instanceof Request ? input.method : 'GET');
    let current = null;
    if (endpoint(url) && method.toUpperCase() === 'POST' && armed) {
      const body = typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : '';
      current = guard(body);
    }
    let response;
    try {response = await nativeFetch(input, init);} catch (cause) {current?.reject(error('NATIVE_GENERATE_NETWORK_ERROR', true)); throw cause;}
    if (current || isUpload(url, method)) void response.clone().text().then(text => {if (current) result(current, text, response.ok); else uploaded(text, response.ok);}).catch(() => current?.reject(error('NATIVE_RESULT_READ_FAILED', true)));
    return response;
  };
  const xhrOpen = XMLHttpRequest.prototype.open, xhrSend = XMLHttpRequest.prototype.send, xhrState = new WeakMap();
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {xhrState.set(this, {method: String(method), url: String(url)}); return xhrOpen.call(this, method, url, ...rest);};
  XMLHttpRequest.prototype.send = function (body) {
    const state = xhrState.get(this); let current = null;
    if (state && endpoint(state.url) && state.method.toUpperCase() === 'POST' && armed) current = guard(body);
    if (state && (current || isUpload(state.url, state.method))) this.addEventListener('loadend', async () => {
      try {const text = this.responseType === 'json' ? JSON.stringify(this.response) : this.responseType === 'blob' ? await this.response.text() : this.responseType === 'arraybuffer' ? new TextDecoder().decode(this.response) : this.responseText;
        if (current) result(current, text, this.status >= 200 && this.status < 300); else uploaded(text, this.status >= 200 && this.status < 300);
      } catch {current?.reject(error('NATIVE_RESULT_READ_FAILED', true));}
    }, {once: true});
    return xhrSend.call(this, body);
  };
  async function fingerprint(job) {const data = new TextEncoder().encode(`${job.image}\0${job.prompt}`); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(x => x.toString(16).padStart(2, '0')).join('');}
  async function prepare(job) {
    if (!job || typeof job.prompt !== 'string' || !job.prompt.trim() || job.prompt.length > 4000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(job.image || '') || job.image.length > 7 * 1024 * 1024) throw error('NATIVE_INVALID_INPUT');
    job = {...job, prompt: normalizedPrompt(job.prompt)};
    const key = await fingerprint(job);
    await configure();
    if (prepared?.key === key && promptText(promptField() || {}) === job.prompt.trim()) return;
    prepared = null;
    for (let n = 0; n < 8; n++) {
      const remove = controls().find(el => /^(Remove (?:image|ingredient|reference image)(?: \d+)?|Remove ingredient image)$/i.test(label(el)));
      if (!remove) break; press(remove); await pause(150);
    }
    let input = [...document.querySelectorAll('input[type="file"]')].find(el => /image\/(png|jpeg)/.test(el.accept || ''));
    if (!input) {click(/^Ingredients$/); input = await until(() => [...document.querySelectorAll('input[type="file"]')].find(el => /image\/(png|jpeg)/.test(el.accept || '')), 'NATIVE_IMAGE_INPUT_MISSING');}
    const binary = atob(job.image.slice(job.image.indexOf(',') + 1)), mime = job.image.slice(5, job.image.indexOf(';'));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (bytes.length > 5 * 1024 * 1024) throw error('NATIVE_IMAGE_TOO_LARGE');
    let file = new File([bytes], 'product-reference.' + (mime === 'image/png' ? 'png' : 'jpg'), {type: mime});
    if (mime === 'image/webp') {
      const bitmap = await createImageBitmap(file);
      try {const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d').drawImage(bitmap, 0, 0); const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!png || png.size > 5 * 1024 * 1024) throw error('NATIVE_IMAGE_TOO_LARGE'); file = new File([png], 'product-reference.png', {type: 'image/png'});} finally {bitmap.close();}
    }
    let timer;
    const uploadedHandle = new Promise((resolve, reject) => {timer = setTimeout(() => reject(error('NATIVE_UPLOAD_TIMEOUT')), 90000); upload = {resolve, reject};});
    try {
      const transfer = new DataTransfer(); transfer.items.add(file);
      input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
      const handle = await uploadedHandle;
      await fillPrompt(job.prompt.trim());
      await until(() => controls().some(el => label(el) === 'Generate' && !el.disabled && el.getAttribute('aria-disabled') !== 'true'), 'NATIVE_GENERATE_NOT_READY', 20000);
      if (config().mode !== 'create' || !config().portrait || !config().eightSeconds) throw error('NATIVE_SETTINGS_CHANGED');
      prepared = {key, handle, prompt: job.prompt.trim()};
    } finally {clearTimeout(timer); upload = null;}
  }
  async function generate(job) {
    if (job?.confirmGeneration !== true || !/^[a-f0-9-]{36}$/.test(job.id || '')) throw error('NATIVE_CONFIRM_GENERATION_REQUIRED');
    if (submitted.has(job.id)) throw error('NATIVE_ALREADY_SUBMITTED_CHECK_VIDS', true);
    await prepare(job);
    let timer, started, clicked = false;
    const pending = new Promise((resolve, reject) => {
      armed = {id: job.id, prompt: prepared.prompt, handle: prepared.handle, requestSeen: false, resolve, reject};
      timer = setTimeout(() => reject(error('NATIVE_GENERATE_TIMEOUT_CHECK_VIDS', clicked)), 12 * 60_000);
      started = setTimeout(() => {if (!armed?.requestSeen) reject(error('NATIVE_GENERATE_START_TIMEOUT', clicked));}, 15000);
    });
    try {clicked = true; click(/^Generate$/); return await pending;}
    finally {clearTimeout(timer); clearTimeout(started); armed = null; prepared = null;}
  }
  const api = Object.freeze({build: BUILD, dispose: () => {window.fetch = nativeFetch; XMLHttpRequest.prototype.open = xhrOpen; XMLHttpRequest.prototype.send = xhrSend;}, status: () => ({version: 1, ready: location.origin === 'https://docs.google.com' && location.pathname.startsWith('/videos/d/') && controls().some(el => /^Create$|^Generate an AI video clip$/.test(label(el))) && !busy, busy}), run: async (action, job) => {
    if (location.origin !== 'https://docs.google.com' || !location.pathname.startsWith('/videos/d/')) return {ok: false, code: 'VIDS_PAGE_REQUIRED', uncertain: false};
    if (action === 'inspect') return inspect();
    if (busy) return {ok: false, code: 'NATIVE_UI_BUSY', uncertain: false};
    busy = true;
    try {
      if (action === 'select-create') await selectCreate();
      else if (action === 'open-settings') await openSettings();
      else if (action === 'prepare-create') await prepare(job);
      else if (action === 'generate-create') return await generate(job);
      else return {ok: false, code: 'UI_ACTION_UNSUPPORTED', uncertain: false};
      return inspect();
    } catch (cause) {busy = false; return {...inspect(), ok: false, code: /^[A-Z_]{1,70}$/.test(cause.message) ? cause.message : 'NATIVE_UI_FAILED', uncertain: cause.uncertain === true};}
    finally {busy = false;}
  }});
  Object.defineProperty(window, '__affVidsCreateUIV1', {value: api, configurable: true});
})();
