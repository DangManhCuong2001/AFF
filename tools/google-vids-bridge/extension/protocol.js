/* Shared by the in-page probe and offline Node tests. No credentials here. */
(function (root) {
  'use strict';
  const RESULT_HOST = 'contribution-rt.usercontent.google.com';
  function parse(text) {
    // Google sometimes prefixes JSON with an anti-XSSI marker.
    return JSON.parse(String(text).replace(/^\)\]\}'[^\n]*\n/, ''));
  }
  function walk(value, visit, path = []) {
    if (!Array.isArray(value)) return;
    visit(value, path);
    value.forEach((child, index) => walk(child, visit, [...path, index]));
  }
  function inspectTemplate(body) {
    const data = typeof body === 'string' ? parse(body) : body;
    if (!Array.isArray(data) || data[0] !== 376 || !Array.isArray(data[2])) throw new Error('UNSUPPORTED_TEMPLATE');
    const prompt = data[3]?.[3]?.[0]?.[0];
    if (!Array.isArray(prompt) || typeof prompt[2] !== 'string') throw new Error('UNSUPPORTED_PROMPT');
    const slots = [];
    walk(data[2][25], (array, path) => {
      if (array[13] === 'Image1' && typeof array[8]?.[3] === 'string') slots.push([2, 25, ...path, 8, 3]);
    });
    if (slots.length !== 1) throw new Error('SINGLE_IMAGE_TEMPLATE_REQUIRED');
    return {data, imagePath: slots[0], promptPath: [3, 3, 0, 0, 2]};
  }
  function setAt(data, path, value) {
    let parent = data;
    for (const key of path.slice(0, -1)) parent = parent[key];
    parent[path.at(-1)] = value;
  }
  function buildPayload(template, prompt, handle) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw new Error('INVALID_PROMPT');
    if (typeof handle !== 'string' || handle.length < 20 || handle.length > 4096 || /\s/.test(handle)) throw new Error('INVALID_IMAGE_HANDLE');
    const {data, imagePath, promptPath} = inspectTemplate(JSON.parse(JSON.stringify(template)));
    setAt(data, imagePath, handle);
    setAt(data, promptPath, prompt.trim());
    return data;
  }
  const PLACEHOLDERS = Object.freeze({document: '__AFF_DOCUMENT__', image: '__AFF_IMAGE_HANDLE__', prompt: '__AFF_PROMPT__', asset: '__AFF_ASSET_UUID__', request: '__AFF_REQUEST_ID__', user: '__AFF_AUTHUSER__'});
  function mapTree(value, fn, depth = 0) {
    if (depth > 70) throw new Error('INVALID_BLUEPRINT');
    if (Array.isArray(value)) return value.map(item => mapTree(item, fn, depth + 1));
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') return fn(value);
    throw new Error('INVALID_BLUEPRINT');
  }
  function allowedSetting(text) {
    return Object.values(PLACEHOLDERS).includes(text) || ['Image1', 'application/vnd.google-apps.flix'].includes(text)
      || /^\d{1,20}$/.test(text) || /^[a-z]{2}(?:-[A-Z]{2})?$/.test(text)
      || ['Asia/Saigon', 'Asia/Ho_Chi_Minh', 'Etc/UTC'].includes(text);
  }
  function validateBlueprint(record) {
    if (!record || record.schema !== 1 || Object.keys(record).some(key => !['schema', 'body'].includes(key)) || JSON.stringify(record).length > 32768) throw new Error('INVALID_BLUEPRINT');
    const body = mapTree(record.body, text => { if (!allowedSetting(text)) throw new Error('UNSAFE_BLUEPRINT_STRING'); return text; });
    const inspected = inspectTemplate(body);
    let current = body;
    for (const key of inspected.imagePath) current = current[key];
    if (current !== PLACEHOLDERS.image || body[3][3][0][0][2] !== PLACEHOLDERS.prompt) throw new Error('UNSANITIZED_BLUEPRINT');
    return {schema: 1, body};
  }
  function createBlueprint(template) {
    const {data, imagePath, promptPath} = inspectTemplate(JSON.parse(JSON.stringify(template)));
    const documents = new Set();
    walk(data, array => { if (array[1] === 'application/vnd.google-apps.flix' && typeof array[0] === 'string') documents.add(array[0]); });
    setAt(data, imagePath, PLACEHOLDERS.image);
    setAt(data, promptPath, PLACEHOLDERS.prompt);
    if (typeof data[2][6] === 'string') data[2][6] = PLACEHOLDERS.user;
    const body = mapTree(data, text => {
      if (documents.has(text)) return PLACEHOLDERS.document;
      if (/^goog_\d+$/.test(text)) return PLACEHOLDERS.request;
      if (/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(text)) return PLACEHOLDERS.asset;
      if (!allowedSetting(text)) throw new Error('UNSAFE_BLUEPRINT_STRING');
      return text;
    });
    return validateBlueprint({schema: 1, body});
  }
  function materializeBlueprint(record, context) {
    const safe = validateBlueprint(record);
    if (!/^[a-zA-Z0-9_-]{6,200}$/.test(context.documentId || '') || !/^\d+$/.test(context.authuser || '0') || !/^goog_\d+$/.test(context.requestId || '') || !/^[a-f0-9-]{36}$/i.test(context.assetId || '')) throw new Error('INVALID_BLUEPRINT_CONTEXT');
    const values = {[PLACEHOLDERS.document]: context.documentId, [PLACEHOLDERS.user]: context.authuser || '0', [PLACEHOLDERS.request]: context.requestId, [PLACEHOLDERS.asset]: context.assetId};
    return mapTree(safe.body, text => values[text] ?? text);
  }
  function uploadHandle(text) {
    const value = parse(text);
    if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== 'string' || value[0].length < 20 || value[0].length > 4096) throw new Error('INVALID_UPLOAD_RESPONSE');
    return value[0];
  }
  function videoResult(text) {
    const data = parse(text);
    const results = [];
    walk(data, (array) => {
      for (let i = 0; i < array.length; i++) {
        if (typeof array[i] !== 'string' || !array[i].startsWith('https://')) continue;
        let url;
        try { url = new URL(array[i]); } catch { continue; }
        if (url.hostname !== RESULT_HOST || url.pathname !== '/download' || url.searchParams.get('filename') !== 'video.mp4' || url.username || url.password || url.port) continue;
        const width = array[i + 1];
        const height = array[i + 2];
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64) continue;
        results.push({url: url.href, width, height});
      }
    });
    if (!results.length) throw new Error('NO_VIDEO_RESULT');
    return results[0];
  }
  const api = Object.freeze({parse, inspectTemplate, buildPayload, uploadHandle, videoResult, createBlueprint, validateBlueprint, materializeBlueprint, PLACEHOLDERS, RESULT_HOST});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.defineProperty(root, '__affVidsProtocol', {value: api, configurable: true});
})(globalThis);
