/**
 * SabSign embedded signing — framework-agnostic loader.
 *
 *   <div id="sign"></div>
 *   <script src="https://YOUR_APP/sabsign-embed.js"></script>
 *   <script>
 *     SabSign.embed({
 *       container: '#sign',
 *       url: 'https://YOUR_APP/sign/<envelopeId>?signerId=<id>&t=<token>&embed=1',
 *       onComplete: function (e) { console.log('signed', e.status); },
 *       onDecline:  function (e) { console.log('declined'); },
 *     });
 *   </script>
 *
 * Works with React/Vue/Angular too (just call SabSign.embed in an effect /
 * mounted hook). Completion is delivered via window.postMessage from the
 * signing iframe.
 */
(function (global) {
  'use strict';

  function resolve(container) {
    if (!container) return null;
    return typeof container === 'string' ? document.querySelector(container) : container;
  }

  function embed(opts) {
    opts = opts || {};
    var el = resolve(opts.container);
    if (!el) throw new Error('SabSign.embed: container not found');
    if (!opts.url) throw new Error('SabSign.embed: url is required');

    var iframe = document.createElement('iframe');
    iframe.src = opts.url;
    iframe.style.width = '100%';
    iframe.style.height = (opts.height || 800) + (typeof opts.height === 'string' ? '' : 'px');
    iframe.style.border = '0';
    iframe.setAttribute('title', 'SabSign signing');
    iframe.setAttribute('allow', 'fullscreen');
    el.appendChild(iframe);

    function handler(event) {
      var data = event.data || {};
      if (typeof data.type !== 'string' || data.type.indexOf('sabsign:') !== 0) return;
      if (typeof opts.onMessage === 'function') opts.onMessage(data);
      if (data.type === 'sabsign:completed' && typeof opts.onComplete === 'function') opts.onComplete(data);
      if (data.type === 'sabsign:declined' && typeof opts.onDecline === 'function') opts.onDecline(data);
    }
    window.addEventListener('message', handler);

    return {
      iframe: iframe,
      destroy: function () {
        window.removeEventListener('message', handler);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      },
    };
  }

  global.SabSign = global.SabSign || {};
  global.SabSign.embed = embed;
})(typeof window !== 'undefined' ? window : this);
