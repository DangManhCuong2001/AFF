/* Runs in Vids MAIN world. Auth stays here; only a sanitized blueprint is exported. */
(function () {
  'use strict';
  // A versioned slot lets a newly reloaded extension update an existing Vids
  // document without reloading it or spending another generation to learn.
  if (window.__affVidsBridgeV4) return;
  const protocol = window.__affVidsProtocol;
  const nativeFetch = window.fetch.bind(window);
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeHeader = XMLHttpRequest.prototype.setRequestHeader;
  const nativeSend = XMLHttpRequest.prototype.send;
  const xhrState = new WeakMap();
  let captured = null;
  let blueprint = null;
  let busy = false;
  let templateError = null;

  function capture(url, method, headers, body) {
    try {
      const parsedUrl = new URL(url, location.href);
      if (parsedUrl.origin !== 'https://appsgenaiserver-pa.clients6.google.com' || !['/v1/genai/generate', '/v1/genai/quotaSummary'].includes(parsedUrl.pathname) || method.toUpperCase() !== 'POST') return;
      const generation = parsedUrl.pathname.endsWith('/generate');
      const parsed = generation ? protocol.inspectTemplate(body) : null;
      const savedHeaders = {};
      for (const name of ['authorization', 'x-server-token', 'x-goog-authuser', 'content-type', 'x-goog-api-key']) {
        const value = new Headers(headers).get(name);
        if (value) savedHeaders[name] = value;
      }
      if (!savedHeaders.authorization || !savedHeaders['x-server-token']) return null;
      const snapshot = {url: parsedUrl.href, headers: savedHeaders, template: parsed?.data, at: Date.now(), generation, verified: false, previousResult: null};
      return snapshot;
    } catch (error) {
      // Never log raw request, response, signed URLs or browser error messages.
      templateError = ['UNSUPPORTED_TEMPLATE', 'UNSUPPORTED_PROMPT', 'SINGLE_IMAGE_TEMPLATE_REQUIRED'].includes(error.message) ? error.message : 'UNSUPPORTED_REQUEST';
    }
    return null;
  }
  function verify(snapshot, text, ok) {
    if (!snapshot) return;
    try {
      if (!ok) throw new Error('LEARNING_REQUEST_FAILED');
      if (snapshot.generation) {
        snapshot.previousResult = protocol.videoResult(text).url;
        try { blueprint = protocol.createBlueprint(snapshot.template); } catch { blueprint = null; /* Unknown settings stay in page memory only. */ }
      } else {
        // A successful quota read supplies a fresh browser session without
        // submitting another video. Generate may still reject its server token.
        const quota = protocol.parse(text);
        if (!quota || typeof quota !== 'object' || quota.error) throw new Error('INVALID_QUOTA_RESPONSE');
        const url = new URL(snapshot.url);
        url.pathname = '/v1/genai/generate';
        snapshot.url = url.href;
        if (!blueprint && captured?.headers['x-goog-authuser'] === snapshot.headers['x-goog-authuser']) snapshot.template = captured.template;
      }
      snapshot.verified = true;
      if (!captured || snapshot.at >= captured.at) { captured = snapshot; templateError = null; }
    } catch { /* A failed background request must not erase saved settings. */ }
  }
  window.fetch = function (input, init) {
    let snapshot = Promise.resolve(null);
    try {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      const headers = init?.headers || (input instanceof Request ? input.headers : {});
      if (typeof init?.body === 'string') snapshot = Promise.resolve(capture(url, method, headers, init.body));
      else if (input instanceof Request && method.toUpperCase() === 'POST') {
        snapshot = input.clone().text().then(body => capture(url, method, headers, body)).catch(() => null);
      } else snapshot = Promise.resolve(capture(url, method, headers, undefined));
    } catch { /* Preserve the application's original request. */ }
    return nativeFetch(input, init).then(response => {
      void snapshot.then(candidate => {
        if (candidate) void response.clone().text().then(text => verify(candidate, text, response.ok)).catch(() => verify(candidate, '', false));
      });
      return response;
    });
  };
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    xhrState.set(this, {method: String(method), url: String(url), headers: {}});
    return nativeOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    const state = xhrState.get(this);
    if (state) state.headers[String(name).toLowerCase()] = String(value);
    return nativeHeader.call(this, name, value);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const state = xhrState.get(this);
    if (state) {
      const snapshot = capture(state.url, state.method, state.headers, body);
      if (snapshot) this.addEventListener('loadend', async () => {
        try {
          const text = this.responseType === 'json' ? JSON.stringify(this.response)
            : this.responseType === 'arraybuffer' ? new TextDecoder().decode(this.response)
              : this.responseType === 'blob' ? await this.response.text() : this.responseText;
          verify(snapshot, text, this.status >= 200 && this.status < 300);
        }
        catch { verify(snapshot, '', false); }
      }, {once: true});
    }
    return nativeSend.call(this, body);
  };

  function checkStatus() {
    const ageSec = captured ? Math.round((Date.now() - captured.at) / 1000) : null;
    const hasBlueprint = !!blueprint || !!captured?.template;
    return {installed: true, protocolVersion: 4, version: '0.2.0', uploadReady: !busy, ready: hasBlueprint && !!captured?.verified && !busy, hasBlueprint, sessionReady: !!captured?.verified, busy, ageSec, error: templateError};
  }
  // Match the transport used by Vids' uploader. Use the original methods so
  // bridge uploads aren't mistaken for a new user-generated learning request.
  function uploadRequest(method, url, headers, file, timeout, stage) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const failed = suffix => reject(new Error(`${stage}_${suffix}`));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) { failed(`HTTP_${xhr.status}`); return; }
        resolve({text: xhr.responseText, header: name => xhr.getResponseHeader(name)});
      };
      xhr.onerror = () => failed('NETWORK_ERROR');
      xhr.ontimeout = () => failed('TIMEOUT');
      xhr.onabort = () => failed('ABORTED');
      try {
        nativeOpen.call(xhr, method, url, true);
        xhr.withCredentials = true;
        xhr.timeout = timeout;
        for (const [name, value] of Object.entries(headers)) nativeHeader.call(xhr, name, value);
        nativeSend.call(xhr, file);
      } catch { failed('REQUEST_BLOCKED'); }
    });
  }
  async function run(job) {
    const uploadOnly = job?.uploadOnly === true;
    if (busy) return {ok: false, code: 'PAGE_BUSY', uncertain: false};
    if (!uploadOnly && !checkStatus().ready) return {ok: false, code: checkStatus().hasBlueprint ? 'SESSION_RECONNECT_REQUIRED' : 'GENERATION_TEMPLATE_REQUIRED', uncertain: false};
    if (!job || typeof job.prompt !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(job.image || '') || job.image.length > 7 * 1024 * 1024) return {ok: false, code: 'INVALID_JOB', uncertain: false};
    busy = true;
    let submitted = false;
    let stage = 'image_decode';
    // Take a fixed snapshot; one request only, never regenerate automatically.
    const session = captured;
    try {
      const authuser = session?.headers['x-goog-authuser'] || new URL(location.href).searchParams.get('authuser') || '0';
      if (!/^\d+$/.test(authuser)) throw new Error('INVALID_AUTHUSER');
      let template = session?.template;
      if (!uploadOnly && blueprint) {
        const documentId = new URL(location.href).pathname.match(/^\/videos\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1];
        template = protocol.materializeBlueprint(blueprint, {documentId, authuser, requestId: `goog_${crypto.getRandomValues(new Uint32Array(1))[0]}`, assetId: crypto.randomUUID()});
      }
      const split = job.image.indexOf(',');
      const mime = job.image.slice(5, job.image.indexOf(';'));
      const binary = atob(job.image.slice(split + 1));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const file = new Blob([bytes], {type: mime});
      stage = 'upload_start';
      const started = await uploadRequest('POST', `/upload/temporaryblob/videos?authuser=${authuser}`, {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-File-Name': 'temporary_blob', 'X-Goog-Upload-Content-Length': String(file.size),
      }, '', 60_000, 'UPLOAD_START');
      const uploadUrl = started.header('X-Goog-Upload-URL');
      if (!uploadUrl) throw new Error('UPLOAD_START_URL_MISSING');
      let upload;
      try { upload = new URL(uploadUrl); } catch { throw new Error('UPLOAD_START_URL_INVALID'); }
      if (upload.origin !== location.origin || upload.pathname !== '/upload/temporaryblob/videos' || !upload.searchParams.has('upload_id')) throw new Error('INVALID_UPLOAD_URL');
      stage = 'upload_put';
      // Supply Scotty's explicit finalize command and byte offset. The earlier
      // bare PUT failed with ERR_HTTP2_PROTOCOL_ERROR in the user's browser;
      // whether these missing headers caused that reset still needs a live test.
      // Content-Length is calculated by the browser from this exact Blob, and
      // must match the byte count declared in the start request.
      const uploaded = await uploadRequest('PUT', upload.href, {
        'Content-Type': mime,
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
      }, file, 90_000, 'UPLOAD_PUT');
      const uploadStatus = uploaded.header('X-Goog-Upload-Status');
      if (uploadStatus && uploadStatus !== 'final') throw new Error('UPLOAD_PUT_NOT_FINAL');
      stage = 'upload_parse';
      let handle;
      try { handle = protocol.uploadHandle(uploaded.text); } catch { throw new Error('INVALID_UPLOAD_RESPONSE'); }
      if (uploadOnly) return {ok: true, uploadOnly: true};
      const payload = protocol.buildPayload(template, job.prompt, handle);
      stage = 'generate';
      submitted = true;
      const response = await nativeFetch(session.url, {method: 'POST', credentials: 'include', headers: session.headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(12 * 60_000)});
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          if (captured === session) captured = null;
          templateError = 'SESSION_RECONNECT_REQUIRED';
        }
        throw new Error(`GENERATE_HTTP_${response.status}`);
      }
      const result = protocol.videoResult(await response.text());
      if (result.url === session.previousResult) throw new Error('REUSED_VIDEO_RESULT');
      session.previousResult = result.url;
      return {ok: true, ...result};
    } catch (error) {
      const code = /^[A-Z][A-Z0-9_]{1,70}$/.test(error.message) ? error.message : `${stage.toUpperCase()}_FAILED`;
      return {ok: false, code, stage, uncertain: submitted};
    } finally { busy = false; }
  }
  const bridge = Object.freeze({status: checkStatus, run,
    exportBlueprint: () => blueprint ? protocol.validateBlueprint(blueprint) : null,
    restoreBlueprint: value => {
      if (!blueprint && !captured?.template) blueprint = protocol.validateBlueprint(value);
      return {ok: true};
    },
  });
  Object.defineProperty(window, '__affVidsBridgeV4', {value: bridge, configurable: false});
  if (!window.__affVidsBridge) Object.defineProperty(window, '__affVidsBridge', {value: bridge, configurable: false});
})();
