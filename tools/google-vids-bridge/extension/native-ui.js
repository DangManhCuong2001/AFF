/* Small, allowlisted UI checks. No browser setting changes or generation clicks. */
(function () {
  'use strict';
  if (window.__affVidsNativeUIV1) return;
  const visible = element => !!(element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  const label = element => String(element.getAttribute('aria-label') || element.getAttribute('data-tooltip') || element.textContent || '').trim().replace(/\s+/g, ' ');
  const safeLabel = value => {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    return text.length <= 140 && !/https?:|@|[A-Za-z0-9_-]{45,}/.test(text) ? text : '[omitted]';
  };
  function inspect() {
    const controls = [...document.querySelectorAll('button,[role="button"],[role="tab"],[role="menuitem"],[role="option"]')].filter(visible);
    return {
      controls: controls.slice(0, 160).map(element => ({label: safeLabel(label(element)), role: element.getAttribute('role') || 'button', selected: element.getAttribute('aria-selected') === 'true' || element.getAttribute('aria-pressed') === 'true', disabled: element.disabled === true || element.getAttribute('aria-disabled') === 'true'})),
      fields: [...document.querySelectorAll('textarea,input,[contenteditable="true"]')].filter(element => visible(element) || element.type === 'file').slice(0, 30).map(element => ({label: safeLabel(element.getAttribute('aria-label') || element.getAttribute('placeholder') || ''), type: element.type || element.tagName.toLowerCase(), accept: element.type === 'file' ? safeLabel(element.accept) : ''})),
    };
  }
  function selectAnimate() {
    const matches = [...document.querySelectorAll('[role="tab"],button,[role="button"],[role="menuitem"],[role="option"]')].filter(element => visible(element) && /^(Animate|Animate image|Tạo ảnh động)$/i.test(label(element)));
    if (matches.length !== 1) return {ok: false, code: matches.length ? 'ANIMATE_CONTROL_AMBIGUOUS' : 'ANIMATE_CONTROL_NOT_FOUND', ...inspect()};
    const element = matches[0];
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') return {ok: false, code: 'ANIMATE_CONTROL_DISABLED', ...inspect()};
    if (element.getAttribute('aria-selected') !== 'true' && element.getAttribute('aria-pressed') !== 'true') element.click();
    return {ok: true, ...inspect()};
  }
  Object.defineProperty(window, '__affVidsNativeUIV1', {value: Object.freeze({version: 1, run: action => {
    if (location.origin !== 'https://docs.google.com' || !location.pathname.startsWith('/videos/')) return {ok: false, code: 'VIDS_PAGE_REQUIRED'};
    if (action === 'inspect') return {ok: true, ...inspect()};
    if (action === 'select-animate') return selectAnimate();
    return {ok: false, code: 'UI_ACTION_UNSUPPORTED'};
  }})});
})();
