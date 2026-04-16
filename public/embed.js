/*!
 * SabFlow Embed SDK
 * -----------------
 * Self-contained, dependency-free embed script for SabFlow chat flows.
 * Include on any third-party site with:
 *
 *   <script src="https://sabflow.com/embed.js"
 *           data-flow-id="FLOW_ID"
 *           data-mode="bubble"></script>
 *
 * Exposes a `window.SabFlow` API for programmatic control.
 *
 * Modes:
 *   - standard : renders an inline <iframe> in a container element
 *   - popup    : renders a button that opens a centred modal iframe
 *   - bubble   : renders a floating chat bubble that expands to a chat window
 *
 * Events (via SabFlow.on(event, handler)):
 *   - 'open'       : chat opened (popup/bubble)
 *   - 'close'      : chat closed (popup/bubble)
 *   - 'ready'      : iframe loaded and listener ready
 *   - 'message'    : a message was sent or received in the flow
 *   - 'completed'  : the flow finished
 *
 * No external dependencies. IE11+ compatible APIs where practical; modern
 * syntax (const/let/arrow fns/template literals) is used freely because modern
 * browsers dominate the embed space.
 */
(function () {
  'use strict';

  /* ── Guard: run only in a browser, only once ─────────────────────────── */
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.SabFlow && window.SabFlow.__initialised) return;

  /* ── Locate the <script> tag that loaded this SDK ────────────────────── */
  // `document.currentScript` works in all modern browsers; fall back to the
  // last script tag on the page for IE11.
  const currentScript =
    document.currentScript ||
    (function () {
      const scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  /* ── Read config from the script tag's data-* attributes ─────────────── */
  const scriptSrc = currentScript ? currentScript.src : '';
  const scriptOrigin = scriptSrc
    ? (function () {
        try {
          return new URL(scriptSrc, window.location.href).origin;
        } catch (_e) {
          return window.location.origin;
        }
      })()
    : window.location.origin;

  const config = {
    flowId:        dataset('flow-id', ''),
    mode:          dataset('mode', 'bubble'),
    apiHost:       dataset('api-host', scriptOrigin),
    buttonText:    dataset('button-text', 'Chat with us'),
    buttonLabel:   dataset('button-label', 'Open chat'),
    buttonColor:   dataset('button-color', '#f76808'),
    buttonPosition:dataset('button-position', 'bottom-right'),
    position:      dataset('position', ''), // alias of button-position
    container:     dataset('container', ''),
    height:        dataset('height', '600px'),
    borderRadius:  dataset('border-radius', ''),
    variables:     dataset('variables', ''), // JSON string
  };

  // Resolve position alias
  if (config.position) config.buttonPosition = config.position;

  // Validate required
  if (!config.flowId) {
    // eslint-disable-next-line no-console
    console.error('[SabFlow] Missing required data-flow-id attribute on <script> tag');
    return;
  }

  // Normalise mode
  const VALID_MODES = ['standard', 'popup', 'bubble'];
  if (VALID_MODES.indexOf(config.mode) === -1) config.mode = 'bubble';

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function dataset(key, fallback) {
    if (!currentScript) return fallback;
    const value = currentScript.getAttribute('data-' + key);
    return (value === null || value === undefined) ? fallback : value;
  }

  /** Build iframe URL with query params. */
  function buildIframeUrl(mode, prefillVars) {
    const base = config.apiHost.replace(/\/$/, '') + '/flow/' + encodeURIComponent(config.flowId);
    const params = ['embed=' + encodeURIComponent(mode)];
    if (prefillVars && typeof prefillVars === 'object') {
      try {
        params.push('variables=' + encodeURIComponent(JSON.stringify(prefillVars)));
      } catch (_e) { /* ignore */ }
    } else if (config.variables) {
      params.push('variables=' + encodeURIComponent(config.variables));
    }
    return base + (base.indexOf('?') === -1 ? '?' : '&') + params.join('&');
  }

  /** Create an element with attributes + optional text. */
  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          if (k === 'style' && typeof attrs[k] === 'object') {
            for (const s in attrs[k]) {
              if (Object.prototype.hasOwnProperty.call(attrs[k], s)) {
                node.style[s] = attrs[k][s];
              }
            }
          } else {
            node.setAttribute(k, attrs[k]);
          }
        }
      }
    }
    if (text !== undefined && text !== null) node.appendChild(document.createTextNode(text));
    return node;
  }

  /* ── Parse any pre-set variables (from data-variables JSON) ──────────── */
  let initialVariables = {};
  if (config.variables) {
    try { initialVariables = JSON.parse(config.variables) || {}; }
    catch (_e) { initialVariables = {}; }
  }

  /* ── Inject stylesheet (once) ────────────────────────────────────────── */
  const STYLE_ID = 'sabflow-embed-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.appendChild(document.createTextNode(buildCss()));
    document.head.appendChild(style);
  }

  /* ── Event emitter (simple) ──────────────────────────────────────────── */
  const listeners = Object.create(null);
  function emit(event, payload) {
    const handlers = listeners[event];
    if (!handlers) return;
    for (let i = 0; i < handlers.length; i++) {
      try { handlers[i](payload); } catch (e) { /* swallow */ }
    }
  }
  function on(event, handler) {
    if (typeof handler !== 'function') return;
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
  }
  function off(event, handler) {
    const handlers = listeners[event];
    if (!handlers) return;
    if (!handler) { delete listeners[event]; return; }
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i] === handler) handlers.splice(i, 1);
    }
  }

  /* ── postMessage plumbing ────────────────────────────────────────────── */
  // Messages we accept from the iframe look like:
  //   { type: 'sabflow:ready' | 'sabflow:message' | 'sabflow:completed' | 'sabflow:close' | 'sabflow:resize', data?: any }
  // We send messages to the iframe like:
  //   { type: 'sabflow:set-variable', data: { name, value } }
  //   { type: 'sabflow:open' | 'sabflow:close' }
  let activeIframe = null;
  const pendingVariables = {}; // queued setVariable calls before iframe ready
  let iframeReady = false;

  function isFromActiveIframe(event) {
    if (!activeIframe || !activeIframe.contentWindow) return false;
    return event.source === activeIframe.contentWindow;
  }

  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (typeof data.type !== 'string') return;
    if (data.type.indexOf('sabflow:') !== 0) return;
    if (!isFromActiveIframe(event)) return;

    const kind = data.type.substring('sabflow:'.length);

    if (kind === 'ready') {
      iframeReady = true;
      emit('ready', data.data || null);
      // Flush any queued variables
      for (const name in pendingVariables) {
        if (Object.prototype.hasOwnProperty.call(pendingVariables, name)) {
          sendToIframe('set-variable', { name: name, value: pendingVariables[name] });
        }
      }
      // Forward initial variables too
      if (initialVariables && Object.keys(initialVariables).length) {
        sendToIframe('set-variables', { variables: initialVariables });
      }
      return;
    }

    if (kind === 'message')   { emit('message', data.data || null); return; }
    if (kind === 'completed') { emit('completed', data.data || null); return; }
    if (kind === 'close')     { api.close(); return; }
    if (kind === 'resize') {
      // data.data = { height: number }
      if (activeIframe && data.data && typeof data.data.height === 'number') {
        activeIframe.style.height = data.data.height + 'px';
      }
      return;
    }
  }, false);

  function sendToIframe(kind, payload) {
    if (!activeIframe || !activeIframe.contentWindow) return;
    try {
      activeIframe.contentWindow.postMessage(
        { type: 'sabflow:' + kind, data: payload == null ? null : payload },
        '*'
      );
    } catch (_e) { /* ignore */ }
  }

  /* ── Iframe factory ──────────────────────────────────────────────────── */
  function createIframe(mode, extraClass) {
    const frame = document.createElement('iframe');
    frame.src = buildIframeUrl(mode);
    frame.setAttribute('title', 'SabFlow chat');
    frame.setAttribute('allow', 'microphone; clipboard-write');
    frame.setAttribute('loading', 'lazy');
    frame.className = 'sabflow-iframe' + (extraClass ? ' ' + extraClass : '');
    frame.style.border = '0';
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.display = 'block';
    return frame;
  }

  /* ── Mode renderers ──────────────────────────────────────────────────── */

  /** Standard: replaces the host container with an inline iframe. */
  function renderStandard() {
    const selector = config.container;
    let host = null;
    if (selector) {
      try { host = document.querySelector(selector); }
      catch (_e) { host = null; }
    }
    if (!host) {
      // If no container, drop an iframe at the script position.
      host = document.createElement('div');
      host.className = 'sabflow-standard-host';
      if (currentScript && currentScript.parentNode) {
        currentScript.parentNode.insertBefore(host, currentScript.nextSibling);
      } else {
        document.body.appendChild(host);
      }
    }
    // Clear host
    while (host.firstChild) host.removeChild(host.firstChild);

    const wrap = el('div', { class: 'sabflow-standard-wrap' });
    wrap.style.height = /px|%|em|rem|vh$/.test(config.height) ? config.height : (config.height + 'px');
    if (config.borderRadius) wrap.style.borderRadius = config.borderRadius + 'px';

    activeIframe = createIframe('standard');
    wrap.appendChild(activeIframe);
    host.appendChild(wrap);
  }

  /** Shared: build a modal shell (for popup mode). */
  let popupRoot = null;
  let popupVisible = false;

  function renderPopupShell() {
    if (popupRoot) return;
    popupRoot = el('div', {
      class: 'sabflow-popup-root',
      'aria-hidden': 'true',
      role: 'dialog',
    });
    const backdrop = el('div', { class: 'sabflow-popup-backdrop' });
    backdrop.addEventListener('click', function () { api.close(); });

    const modal = el('div', { class: 'sabflow-popup-modal' });

    const closeBtn = el('button', {
      class: 'sabflow-close-btn',
      type: 'button',
      'aria-label': 'Close chat',
    });
    closeBtn.innerHTML = closeIconSvg();
    closeBtn.addEventListener('click', function () { api.close(); });

    modal.appendChild(closeBtn);

    popupRoot.appendChild(backdrop);
    popupRoot.appendChild(modal);
    document.body.appendChild(popupRoot);
  }

  function renderPopupTrigger() {
    const btn = el('button', {
      class: 'sabflow-popup-trigger',
      type: 'button',
    }, config.buttonLabel || 'Open chat');
    btn.style.backgroundColor = config.buttonColor;
    btn.addEventListener('click', function () { api.open(); });

    if (currentScript && currentScript.parentNode) {
      currentScript.parentNode.insertBefore(btn, currentScript.nextSibling);
    } else {
      document.body.appendChild(btn);
    }
  }

  function openPopup() {
    renderPopupShell();
    if (popupVisible) return;
    popupVisible = true;

    // Create fresh iframe each open so we start a new session
    const modal = popupRoot.querySelector('.sabflow-popup-modal');
    // Clear previous iframe but keep close button
    const prev = modal.querySelector('.sabflow-iframe');
    if (prev) modal.removeChild(prev);

    iframeReady = false;
    activeIframe = createIframe('popup', 'sabflow-iframe-popup');
    modal.appendChild(activeIframe);

    popupRoot.classList.add('is-open');
    popupRoot.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sabflow-no-scroll');
    emit('open', { mode: 'popup' });
  }

  function closePopup() {
    if (!popupRoot || !popupVisible) return;
    popupVisible = false;
    popupRoot.classList.remove('is-open');
    popupRoot.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sabflow-no-scroll');
    // Remove iframe after transition so audio/chat is destroyed
    window.setTimeout(function () {
      if (!popupRoot) return;
      const modal = popupRoot.querySelector('.sabflow-popup-modal');
      const frame = modal ? modal.querySelector('.sabflow-iframe') : null;
      if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
      if (activeIframe === frame) activeIframe = null;
    }, 250);
    emit('close', { mode: 'popup' });
  }

  /* ── Bubble mode ─────────────────────────────────────────────────────── */
  let bubbleButton = null;
  let bubblePanel = null;
  let bubbleVisible = false;

  function positionClass() {
    return config.buttonPosition === 'bottom-left'
      ? 'sabflow-pos-bl'
      : 'sabflow-pos-br';
  }

  function renderBubble() {
    if (bubbleButton) return;

    bubbleButton = el('button', {
      class: 'sabflow-bubble-btn ' + positionClass(),
      type: 'button',
      'aria-label': config.buttonText || 'Open chat',
    });
    bubbleButton.style.backgroundColor = config.buttonColor;
    bubbleButton.innerHTML =
      '<span class="sabflow-bubble-icon sabflow-icon-chat">' + chatIconSvg() + '</span>' +
      '<span class="sabflow-bubble-icon sabflow-icon-close">' + closeIconSvg() + '</span>';
    bubbleButton.addEventListener('click', function () {
      if (bubbleVisible) api.close(); else api.open();
    });

    bubblePanel = el('div', {
      class: 'sabflow-bubble-panel ' + positionClass(),
      'aria-hidden': 'true',
      role: 'dialog',
    });

    const header = el('div', { class: 'sabflow-bubble-header' });
    const title = el('span', { class: 'sabflow-bubble-title' }, config.buttonText || 'Chat with us');
    const closeBtn = el('button', {
      class: 'sabflow-bubble-close',
      type: 'button',
      'aria-label': 'Close chat',
    });
    closeBtn.innerHTML = closeIconSvg();
    closeBtn.addEventListener('click', function () { api.close(); });
    header.appendChild(title);
    header.appendChild(closeBtn);

    bubblePanel.appendChild(header);
    // iframe created lazily on open

    document.body.appendChild(bubblePanel);
    document.body.appendChild(bubbleButton);
  }

  function openBubble() {
    renderBubble();
    if (bubbleVisible) return;
    bubbleVisible = true;

    // Attach (or reuse) iframe
    let frame = bubblePanel.querySelector('.sabflow-iframe');
    if (!frame) {
      iframeReady = false;
      frame = createIframe('bubble', 'sabflow-iframe-bubble');
      bubblePanel.appendChild(frame);
      activeIframe = frame;
    } else {
      activeIframe = frame;
    }

    bubblePanel.classList.add('is-open');
    bubblePanel.setAttribute('aria-hidden', 'false');
    bubbleButton.classList.add('is-open');
    emit('open', { mode: 'bubble' });
  }

  function closeBubble() {
    if (!bubblePanel || !bubbleVisible) return;
    bubbleVisible = false;
    bubblePanel.classList.remove('is-open');
    bubblePanel.setAttribute('aria-hidden', 'true');
    if (bubbleButton) bubbleButton.classList.remove('is-open');
    emit('close', { mode: 'bubble' });
  }

  /* ── Escape key closes modal/bubble ──────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.keyCode !== 27) return;
    if (popupVisible || bubbleVisible) api.close();
  });

  /* ── Public API ──────────────────────────────────────────────────────── */
  const api = {
    __initialised: true,
    config: config,

    /** Open the popup/bubble. No-op in standard mode. */
    open: function () {
      if (config.mode === 'popup')  openPopup();
      if (config.mode === 'bubble') openBubble();
    },

    /** Close the popup/bubble. No-op in standard mode. */
    close: function () {
      if (config.mode === 'popup')  closePopup();
      if (config.mode === 'bubble') closeBubble();
    },

    /** Toggle open/close (popup/bubble). */
    toggle: function () {
      if (config.mode === 'popup')  { popupVisible ? closePopup() : openPopup(); return; }
      if (config.mode === 'bubble') { bubbleVisible ? closeBubble() : openBubble(); return; }
    },

    /** Set a variable that the flow will consume (posts to iframe). */
    setVariable: function (name, value) {
      if (typeof name !== 'string' || !name) return;
      if (iframeReady && activeIframe) {
        sendToIframe('set-variable', { name: name, value: value });
      } else {
        pendingVariables[name] = value;
      }
    },

    /** Set multiple variables at once. */
    setVariables: function (vars) {
      if (!vars || typeof vars !== 'object') return;
      for (const k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) {
          api.setVariable(k, vars[k]);
        }
      }
    },

    /** Register an event listener. */
    on: on,

    /** Remove a listener (or all for an event). */
    off: off,

    /** Completely unmount — removes DOM nodes and listeners. */
    destroy: function () {
      if (popupRoot && popupRoot.parentNode) popupRoot.parentNode.removeChild(popupRoot);
      if (bubbleButton && bubbleButton.parentNode) bubbleButton.parentNode.removeChild(bubbleButton);
      if (bubblePanel && bubblePanel.parentNode) bubblePanel.parentNode.removeChild(bubblePanel);
      popupRoot = null;
      bubbleButton = null;
      bubblePanel = null;
      activeIframe = null;
      popupVisible = false;
      bubbleVisible = false;
      for (const k in listeners) delete listeners[k];
    },
  };

  /* ── Expose & boot ───────────────────────────────────────────────────── */
  // Preserve any queued calls made before the SDK loaded (window.SabFlow = [...])
  const queued = window.SabFlow && Array.isArray(window.SabFlow.q) ? window.SabFlow.q : [];
  window.SabFlow = api;

  function boot() {
    if (config.mode === 'standard') renderStandard();
    else if (config.mode === 'popup') renderPopupTrigger();
    else renderBubble();

    // Replay queued calls: each is [methodName, ...args]
    for (let i = 0; i < queued.length; i++) {
      const call = queued[i];
      if (!call || !call.length) continue;
      const method = api[call[0]];
      if (typeof method === 'function') {
        try { method.apply(api, call.slice(1)); } catch (_e) { /* ignore */ }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, false);
  } else {
    boot();
  }

  /* ── Inline SVGs (no external assets) ────────────────────────────────── */
  function chatIconSvg() {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      '</svg>'
    );
  }
  function closeIconSvg() {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>' +
      '</svg>'
    );
  }

  /* ── Stylesheet (injected once) ──────────────────────────────────────── */
  // Keep selectors scoped to `.sabflow-*` to avoid collisions with host pages.
  function buildCss() {
  const CSS_RAW = [
    /* Reset for injected elements */
    '.sabflow-iframe{border:0;width:100%;height:100%;display:block;background:#fff;color-scheme:light}',

    /* Standard mode */
    '.sabflow-standard-host{width:100%}',
    '.sabflow-standard-wrap{width:100%;overflow:hidden;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);background:#fff;height:600px}',

    /* Popup trigger button */
    '.sabflow-popup-trigger{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;color:#fff;font:500 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.12);transition:transform .15s ease,box-shadow .15s ease}',
    '.sabflow-popup-trigger:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.16)}',
    '.sabflow-popup-trigger:active{transform:translateY(0)}',

    /* Popup modal */
    '.sabflow-popup-root{position:fixed;inset:0;z-index:2147483000;opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s ease}',
    '.sabflow-popup-root.is-open{opacity:1;visibility:visible}',
    '.sabflow-popup-backdrop{position:absolute;inset:0;background:rgba(15,15,15,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}',
    '.sabflow-popup-modal{position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% + 16px));width:min(92vw,720px);height:min(86vh,820px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25);transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .2s ease;display:flex;flex-direction:column}',
    '.sabflow-popup-root.is-open .sabflow-popup-modal{transform:translate(-50%,-50%)}',
    '.sabflow-close-btn{position:absolute;top:10px;right:10px;z-index:2;all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.85);color:#333;box-shadow:0 2px 6px rgba(0,0,0,.15);transition:background .15s ease}',
    '.sabflow-close-btn:hover{background:#fff}',

    /* Bubble floating button */
    '.sabflow-bubble-btn{all:unset;box-sizing:border-box;cursor:pointer;position:fixed;z-index:2147483000;width:60px;height:60px;border-radius:50%;color:#fff;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.2);transition:transform .2s ease,box-shadow .2s ease}',
    '.sabflow-bubble-btn:hover{transform:scale(1.05);box-shadow:0 8px 24px rgba(0,0,0,.25)}',
    '.sabflow-bubble-btn:active{transform:scale(.96)}',
    '.sabflow-bubble-btn.sabflow-pos-br{bottom:24px;right:24px}',
    '.sabflow-bubble-btn.sabflow-pos-bl{bottom:24px;left:24px}',
    '.sabflow-bubble-icon{display:inline-flex;position:absolute;transition:opacity .2s ease,transform .2s ease}',
    '.sabflow-bubble-btn .sabflow-icon-close{opacity:0;transform:rotate(-45deg) scale(.8)}',
    '.sabflow-bubble-btn.is-open .sabflow-icon-chat{opacity:0;transform:rotate(45deg) scale(.8)}',
    '.sabflow-bubble-btn.is-open .sabflow-icon-close{opacity:1;transform:rotate(0) scale(1)}',

    /* Bubble chat panel */
    '.sabflow-bubble-panel{position:fixed;z-index:2147482999;width:400px;height:620px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.2);display:flex;flex-direction:column;opacity:0;visibility:hidden;transform:translateY(20px) scale(.96);transform-origin:bottom right;transition:opacity .22s ease,transform .22s cubic-bezier(.2,.8,.2,1),visibility .22s ease}',
    '.sabflow-bubble-panel.sabflow-pos-br{bottom:100px;right:24px}',
    '.sabflow-bubble-panel.sabflow-pos-bl{bottom:100px;left:24px;transform-origin:bottom left}',
    '.sabflow-bubble-panel.is-open{opacity:1;visibility:visible;transform:translateY(0) scale(1)}',

    /* Bubble header */
    '.sabflow-bubble-header{display:none;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.06);background:#fafafa;font:600 13.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#222}',
    '.sabflow-bubble-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.sabflow-bubble-close{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;color:#666;transition:background .15s ease,color .15s ease}',
    '.sabflow-bubble-close:hover{background:rgba(0,0,0,.06);color:#111}',

    /* Helpers */
    '.sabflow-no-scroll{overflow:hidden!important}',

    /* Mobile: bubble + popup take full screen */
    '@media (max-width:640px){' +
      '.sabflow-bubble-panel,.sabflow-bubble-panel.sabflow-pos-br,.sabflow-bubble-panel.sabflow-pos-bl{inset:0;width:100vw;height:100vh;max-height:100vh;border-radius:0;bottom:0;right:0;left:0;transform:translateY(100%);transform-origin:center bottom}' +
      '.sabflow-bubble-panel.is-open{transform:translateY(0)}' +
      '.sabflow-bubble-header{display:flex}' +
      '.sabflow-popup-modal{width:100vw;height:100vh;max-height:100vh;border-radius:0;transform:translate(-50%,-50%) translateY(100%)}' +
      '.sabflow-popup-root.is-open .sabflow-popup-modal{transform:translate(-50%,-50%)}' +
    '}',

    /* Reduced motion */
    '@media (prefers-reduced-motion:reduce){' +
      '.sabflow-popup-root,.sabflow-popup-modal,.sabflow-bubble-btn,.sabflow-bubble-panel,.sabflow-bubble-icon{transition:none!important}' +
    '}',
  ];
  return CSS_RAW.join('\n');
  }
})();
