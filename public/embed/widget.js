/* SabNode embeddable chat widget — pure browser JS. */
/* eslint-disable */
(function () {
  'use strict';

  // The loader is intentionally idempotent — bail if already booted.
  if (window.__SABNODE_WIDGET_BOOTED__) return;
  window.__SABNODE_WIDGET_BOOTED__ = true;

  // Locate ourselves so we can derive the base URL the customer mounted us at.
  var current =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf('/embed/widget.js') !== -1) {
          return scripts[i];
        }
      }
      return null;
    })();

  if (!current) return;

  var widgetId = current.getAttribute('data-sabnode-id');
  var locale = current.getAttribute('data-sabnode-locale') || 'en';
  if (!widgetId) {
    if (window.console && console.warn) {
      console.warn('[sabnode] data-sabnode-id is required');
    }
    return;
  }

  var src = current.src || '';
  var baseUrl = src.replace(/\/embed\/widget\.js.*$/, '');

  function makeBubble() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open chat');
    btn.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'width:56px',
      'height:56px',
      'border-radius:9999px',
      'background:#111827',
      'color:#fff',
      'border:none',
      'cursor:pointer',
      'box-shadow:0 10px 25px rgba(0,0,0,0.18)',
      'z-index:2147483646',
      'font-size:24px',
      'line-height:1',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    btn.textContent = '\u{1F4AC}';
    return btn;
  }

  function makeFrame() {
    var iframe = document.createElement('iframe');
    iframe.title = 'SabNode chat';
    iframe.allow = 'clipboard-write; microphone';
    iframe.src =
      baseUrl +
      '/embed/chat/' +
      encodeURIComponent(widgetId) +
      '?origin=' +
      encodeURIComponent(window.location.origin) +
      '&locale=' +
      encodeURIComponent(locale);
    iframe.style.cssText = [
      'position:fixed',
      'bottom:96px',
      'right:24px',
      'width:380px',
      'height:600px',
      'max-width:calc(100vw - 32px)',
      'max-height:calc(100vh - 120px)',
      'border:0',
      'border-radius:16px',
      'box-shadow:0 24px 60px rgba(0,0,0,0.25)',
      'z-index:2147483647',
      'background:#fff',
      'display:none',
    ].join(';');
    return iframe;
  }

  var bubble = makeBubble();
  var frame = makeFrame();
  var open = false;

  function setOpen(next) {
    open = !!next;
    frame.style.display = open ? 'block' : 'none';
    bubble.setAttribute('aria-expanded', open ? 'true' : 'false');
    try {
      frame.contentWindow &&
        frame.contentWindow.postMessage(
          { type: 'sabnode:visibility', open: open },
          '*',
        );
    } catch (e) {
      /* noop — cross-origin postMessage failure is fine pre-load. */
    }
    notifyHost('sabnode:toggle', { open: open });
  }

  function notifyHost(type, detail) {
    try {
      window.dispatchEvent(
        new CustomEvent(type, { detail: detail || {} }),
      );
    } catch (e) {
      /* legacy browser — ignore. */
    }
  }

  bubble.addEventListener('click', function () {
    setOpen(!open);
  });

  function mount() {
    document.body.appendChild(bubble);
    document.body.appendChild(frame);
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }

  // Listen for messages from the iframe to close, resize, or fire events.
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'sabnode:close') setOpen(false);
    if (data.type === 'sabnode:open') setOpen(true);
    if (data.type === 'sabnode:event') {
      notifyHost('sabnode:event', data.payload || {});
    }
  });

  // Public API for host pages.
  window.SabNodeEmbed = {
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!open);
    },
    widgetId: widgetId,
  };
})();
