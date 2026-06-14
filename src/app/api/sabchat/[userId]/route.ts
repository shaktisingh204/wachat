/**
 * SabChat embeddable widget (v3).
 *
 * Self-contained vanilla-JS bundle (no framework) that talks to the public
 * widget endpoints owned by the `sabchat-widget` Rust crate:
 *
 *   GET  /v1/sabchat/widget/config?inboxId=...     (returns `settings` blob)
 *   POST /v1/sabchat/widget/session                 (mint/resume visitorToken)
 *   POST /v1/sabchat/widget/identify                (attach email/name)
 *   POST /v1/sabchat/widget/messages                (send a message)
 *   GET  /v1/sabchat/widget/history?visitorToken=…  (load thread)
 *   GET  /v1/sabchat/widget/stream?visitorToken=…   (SSE live agent replies)
 *
 * The route param is the **inbox id** (the Widget Studio generates
 * `/api/sabchat/<inboxId>`). Branding/config comes entirely from the inbox's
 * `channelConfig.settings` via `/config` — the legacy per-user `sabChatSettings`
 * read is gone. Session persistence is a first-party cookie (`sabchat_vid`,
 * scoped to the embedding site) + a localStorage mirror.
 */
import { NextRequest, NextResponse } from 'next/server';

import { DEFAULT_WIDGET_CONFIG } from '@/lib/sabchat/widget-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const url = new URL(request.url);
  const inboxId = url.searchParams.get('inboxId') || userId;

  if (!inboxId) {
    return new NextResponse('// SabChat widget: missing inboxId', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  const apiBase =
    process.env.NEXT_PUBLIC_RUST_API_URL ||
    process.env.RUST_API_URL ||
    (() => {
      const host = request.headers.get('host');
      const proto = request.headers.get('x-forwarded-proto') || 'https';
      return host ? `${proto}://${host}` : '';
    })();

  // Origin serving THIS script (the SabNode/Next app) — the widget calls the
  // AI-deflect proxy here, which lives on the app, not the Rust engine.
  const appOrigin = (() => {
    const host = request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return host ? `${proto}://${host}` : '';
  })();

  const script = WIDGET_JS.replace('__INBOX_ID__', JSON.stringify(inboxId))
    .replace('__API_BASE__', JSON.stringify(apiBase))
    .replace('__APP_ORIGIN__', JSON.stringify(appOrigin))
    .replace('__DEFAULTS__', JSON.stringify(DEFAULT_WIDGET_CONFIG));

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

/*
 * The widget bundle. Deliberately uses string concatenation (no template
 * literals, no `${}`) so it survives being embedded in this TS template
 * literal without escaping. The three `__…__` tokens are replaced above.
 */
const WIDGET_JS = `(function(){
  var INBOX_ID = __INBOX_ID__;
  var API = __API_BASE__;
  var APP = __APP_ORIGIN__;
  var CFG = __DEFAULTS__;
  var TOKEN_KEY = 'sabchat_vid';
  var POLL_MS = 4000;

  var S = { token:null, conv:null, contact:null, email:null, open:false, tab:'home',
            msgs:[], es:null, poll:null, ready:false, booted:false, firedProactive:{} };

  /* ---- persistence (first-party to the embedding site) ---- */
  function readToken(){
    try { var m = document.cookie.match(/(?:^|; )sabchat_vid=([^;]+)/); if (m) return decodeURIComponent(m[1]); } catch(e){}
    try { return localStorage.getItem(TOKEN_KEY); } catch(e){ return null; }
  }
  function saveToken(t){
    S.token = t;
    try { document.cookie = 'sabchat_vid=' + encodeURIComponent(t) + '; path=/; max-age=31536000; SameSite=Lax'; } catch(e){}
    try { localStorage.setItem(TOKEN_KEY, t); } catch(e){}
  }

  /* ---- api ---- */
  function get(path){ return fetch(API + path, { credentials:'omit' }).then(function(r){ return r.json(); }); }
  function post(path, body){
    return fetch(API + path, { method:'POST', credentials:'omit',
      headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) }).then(function(r){ return r.json(); });
  }

  function bootConfig(){
    return get('/v1/sabchat/widget/config?inboxId=' + encodeURIComponent(INBOX_ID)).then(function(c){
      if (!c) return { enabled:true };
      var s = c.settings || {};
      for (var k in s) { if (s.hasOwnProperty(k) && s[k] !== null && s[k] !== '') CFG[k] = s[k]; }
      if (c.widgetColor) CFG.widgetColor = c.widgetColor;
      if (c.teamName) CFG.teamName = c.teamName;
      if (c.welcomeMessage) CFG.welcomeMessage = c.welcomeMessage;
      return c;
    }).catch(function(){ return { enabled:true }; });
  }

  function ensureSession(){
    if (S.ready) return Promise.resolve();
    return post('/v1/sabchat/widget/session', { inboxId: INBOX_ID, visitorToken: S.token || undefined }).then(function(r){
      if (r && r.visitorToken){ saveToken(r.visitorToken); S.conv = r.conversationId; S.contact = r.contactId; S.ready = true; }
    });
  }

  function loadHistory(){
    if (!S.token) return Promise.resolve();
    return get('/v1/sabchat/widget/history?visitorToken=' + encodeURIComponent(S.token) + '&limit=50').then(function(r){
      var items = (r && r.messages) || [];
      items.reverse();
      S.msgs = items;
      renderThread();
    }).catch(function(){});
  }

  function startRealtime(){
    if (!S.token) return;
    stopRealtime();
    if (typeof EventSource !== 'undefined'){
      try {
        var es = new EventSource(API + '/v1/sabchat/widget/stream?visitorToken=' + encodeURIComponent(S.token));
        es.onmessage = function(e){ try { var ev = JSON.parse(e.data); if (ev.type === 'message.created') incoming(ev.payload); } catch(_){} };
        es.onerror = function(){ try{ es.close(); }catch(_){} S.es = null; startPolling(); };
        S.es = es;
        return;
      } catch(_){}
    }
    startPolling();
  }
  function stopRealtime(){ if (S.es){ try{ S.es.close(); }catch(_){} S.es = null; } stopPolling(); }
  function startPolling(){ if (S.poll) return; S.poll = setInterval(loadHistory, POLL_MS); }
  function stopPolling(){ if (S.poll){ clearInterval(S.poll); S.poll = null; } }

  function incoming(msg){
    if (!msg || !msg._id) return;
    for (var i=0;i<S.msgs.length;i++){ if (S.msgs[i]._id === msg._id) return; }
    S.msgs.push(msg);
    renderThread();
  }

  function sendText(text){
    text = (text||'').trim(); if (!text) return;
    ensureSession().then(function(){
      // optimistic render
      S.msgs.push({ _id:'tmp-'+Date.now(), senderType:'visitor', content:{ kind:'text', text:text }, createdAt:new Date().toISOString() });
      renderThread();
      post('/v1/sabchat/widget/messages', { visitorToken: S.token, content:{ kind:'text', text:text } }).then(function(){ loadHistory(); });
      deflect(text);
    });
  }

  /* AI deflection: try an instant KB answer while the visitor waits for a
     human. Rendered client-side as a bot bubble; if confidence is low or the
     bot escalates, we stay silent and let an agent reply. */
  function deflect(question){
    if (!S.conv || !APP) return;
    fetch(APP + '/api/sabchat/widget/ai', { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ inboxId: INBOX_ID, conversationId: S.conv, question: question }) })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.answer && !d.escalate && (d.confidence == null || d.confidence >= 0.55)) {
          S.msgs.push({ _id:'bot-'+Date.now(), senderType:'bot', content:{ kind:'text', text:d.answer }, createdAt:new Date().toISOString() });
          renderThread();
        }
      }).catch(function(){});
  }

  function identify(email){
    email = (email||'').trim(); if (!email || !S.token) return;
    post('/v1/sabchat/widget/identify', { visitorToken: S.token, email: email }).then(function(){ S.email = email; renderThread(); });
  }

  /* ---- DOM ---- */
  var root, bubble, panel;
  function esc(t){ var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }

  function mount(){
    root = document.createElement('div'); root.id = 'sabchat-root';
    var side = CFG.position === 'lower-left' ? 'left:' + CFG.sideMargin + 'px;' : 'right:' + CFG.sideMargin + 'px;';
    root.setAttribute('style','position:fixed;bottom:' + CFG.bottomMargin + 'px;' + side + 'z-index:2147483000;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;');

    bubble = document.createElement('button');
    bubble.setAttribute('aria-label','Open chat');
    bubble.setAttribute('style','width:56px;height:56px;border:none;cursor:pointer;border-radius:' + (CFG.buttonRadius+12) + 'px;background:' + CFG.buttonColor + ';color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;');
    bubble.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
    bubble.onclick = toggle;

    panel = document.createElement('div');
    panel.setAttribute('style','display:none;position:absolute;bottom:70px;' + (CFG.position==='lower-left'?'left:0;':'right:0;') + 'width:360px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:' + (CFG.widgetRadius+6) + 'px;box-shadow:0 16px 48px rgba(0,0,0,.22);overflow:hidden;flex-direction:column;');

    root.appendChild(panel); root.appendChild(bubble);
    document.body.appendChild(root);
  }

  function toggle(){
    S.open = !S.open;
    panel.style.display = S.open ? 'flex' : 'none';
    if (S.open && !S.ready){ ensureSession().then(function(){ loadHistory(); startRealtime(); }); }
    render();
  }

  function header(){
    var grad = 'linear-gradient(135deg,' + CFG.widgetColor + ',' + CFG.widgetColor + ')';
    var logo = CFG.logoUrl ? '<img src="' + esc(CFG.logoUrl) + '" alt="" style="width:36px;height:36px;border-radius:50%;background:#fff;object-fit:contain;padding:3px;margin-bottom:10px;"/>'
      : '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:10px;">' + esc((CFG.teamName||'S').charAt(0).toUpperCase()) + '</div>';
    return '<div style="background:' + grad + ';color:' + CFG.titleColor + ';padding:22px 20px 30px;">' + logo +
      '<div style="font-size:22px;font-weight:700;line-height:1.2;">' + esc(CFG.greeting) + '</div>' +
      '<div style="font-size:22px;font-weight:700;line-height:1.2;opacity:.95;">' + esc(CFG.title) + '</div></div>';
  }

  function tabbar(){
    function tab(id,label,active){
      return '<button data-tab="' + id + '" style="flex:1;background:none;border:none;cursor:pointer;padding:10px 0;display:flex;flex-direction:column;align-items:center;gap:3px;color:' + (active?CFG.buttonColor:'#9aa0ab') + ';font-size:12px;font-weight:' + (active?'600':'400') + ';">' +
        (active?'<span style="height:3px;width:22px;border-radius:9px;background:' + CFG.buttonColor + ';"></span>':'<span style="height:3px;width:22px;"></span>') + label + '</button>';
    }
    return '<div style="display:flex;border-top:1px solid #eef0f3;">' + tab('home','Home',S.tab==='home') + tab('messages','Messages',S.tab==='messages') + '</div>';
  }

  function homeBody(){
    return '<div style="flex:1;overflow:auto;padding:0 12px 12px;margin-top:-16px;">' +
      '<div style="background:#fff;border-radius:' + CFG.widgetRadius + 'px;box-shadow:0 4px 16px rgba(0,0,0,.10);padding:14px;margin-bottom:12px;">' +
        '<div style="font-size:12px;font-weight:600;color:#3a3f4b;margin-bottom:8px;">Recent message</div>' +
        '<div style="display:flex;align-items:center;gap:8px;color:#6b7280;font-size:13px;">' + esc(CFG.welcomeMessage) + '</div></div>' +
      '<button data-go="messages" style="width:100%;text-align:left;background:#fff;border:none;cursor:pointer;border-radius:' + CFG.widgetRadius + 'px;box-shadow:0 4px 16px rgba(0,0,0,.10);padding:14px;display:flex;align-items:center;justify-content:between;gap:8px;">' +
        '<div style="flex:1;"><div style="font-weight:600;color:#23272f;">Send us a message</div><div style="font-size:12px;color:#9aa0ab;">' + esc(CFG.replyTime) + '</div></div>' +
        '<span style="width:34px;height:34px;border-radius:' + CFG.buttonRadius + 'px;background:' + CFG.buttonColor + ';color:#fff;display:flex;align-items:center;justify-content:center;flex:none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span></button></div>';
  }

  function bubbleHtml(m){
    var mine = m.senderType === 'visitor';
    var text = (m.content && (m.content.text || (m.content.kind==='image'?'📷 Photo':(m.content.kind==='file'?'📎 File':'')))) || '';
    var bg = mine ? CFG.buttonColor : '#f1f2f4';
    var col = mine ? '#fff' : '#23272f';
    return '<div style="display:flex;justify-content:' + (mine?'flex-end':'flex-start') + ';margin:4px 0;">' +
      '<div style="max-width:78%;padding:9px 12px;border-radius:14px;background:' + bg + ';color:' + col + ';font-size:14px;white-space:pre-wrap;word-break:break-word;">' + esc(text) + '</div></div>';
  }

  function messagesBody(){
    var rows = '';
    for (var i=0;i<S.msgs.length;i++){ rows += bubbleHtml(S.msgs[i]); }
    if (!rows) rows = '<div style="text-align:center;color:#9aa0ab;font-size:13px;padding:24px;">' + esc(CFG.welcomeMessage) + '</div>';
    var emailRow = S.email ? '' :
      '<div style="display:flex;gap:6px;padding:8px 10px;border-top:1px solid #eef0f3;background:#fafbfc;">' +
        '<input id="sabchat-email" type="email" placeholder="Your email for replies" style="flex:1;border:1px solid #e2e5ea;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;"/>' +
        '<button id="sabchat-email-go" style="border:none;background:' + CFG.buttonColor + ';color:#fff;border-radius:8px;padding:0 12px;cursor:pointer;font-size:13px;">Save</button></div>';
    return '<div id="sabchat-thread" style="flex:1;overflow:auto;padding:12px;background:#fff;">' + rows + '</div>' + emailRow +
      '<div style="display:flex;gap:6px;padding:10px;border-top:1px solid #eef0f3;">' +
        '<input id="sabchat-input" placeholder="Type a message…" style="flex:1;border:1px solid #e2e5ea;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;"/>' +
        '<button id="sabchat-send" style="border:none;background:' + CFG.buttonColor + ';color:#fff;border-radius:' + CFG.buttonRadius + 'px;padding:0 14px;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>';
  }

  function render(){
    if (!panel) return;
    var body = S.tab === 'home' ? (header() + homeBody()) : ('<div style="background:' + CFG.widgetColor + ';color:' + CFG.titleColor + ';padding:14px 18px;font-weight:600;">' + esc(CFG.teamName) + '</div>' + messagesBody());
    panel.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;">' + body + tabbar() + '</div>';
    wire();
  }
  function renderThread(){ if (S.open && S.tab === 'messages') { render(); var th = document.getElementById('sabchat-thread'); if (th) th.scrollTop = th.scrollHeight; } }

  function wire(){
    var tabs = panel.querySelectorAll('[data-tab]');
    for (var i=0;i<tabs.length;i++){ tabs[i].onclick = function(){ S.tab = this.getAttribute('data-tab'); if (S.tab==='messages' && !S.ready){ ensureSession().then(function(){ loadHistory(); startRealtime(); }); } render(); var th=document.getElementById('sabchat-thread'); if(th) th.scrollTop=th.scrollHeight; }; }
    var go = panel.querySelector('[data-go]'); if (go) go.onclick = function(){ S.tab='messages'; if(!S.ready){ ensureSession().then(function(){ loadHistory(); startRealtime(); }); } render(); };
    var input = document.getElementById('sabchat-input');
    var sendBtn = document.getElementById('sabchat-send');
    if (sendBtn && input){ sendBtn.onclick = function(){ sendText(input.value); input.value=''; }; input.onkeydown = function(e){ if (e.key==='Enter'){ e.preventDefault(); sendText(input.value); input.value=''; } }; }
    var eIn = document.getElementById('sabchat-email'); var eGo = document.getElementById('sabchat-email-go');
    if (eGo && eIn){ eGo.onclick = function(){ identify(eIn.value); }; }
  }

  /* Proactive triggers — fire a one-time message based on visitor behaviour. */
  function openWidget(){ if (!S.open){ S.open = true; if (panel) panel.style.display = 'flex'; } }
  function fireProactive(rule){
    if (!rule || S.firedProactive[rule.id]) return;
    S.firedProactive[rule.id] = true;
    ensureSession().then(function(){
      S.msgs.push({ _id:'pro-'+Date.now(), senderType:'bot', content:{ kind:'text', text:rule.message }, createdAt:new Date().toISOString() });
      openWidget();
      S.tab = 'messages';
      render();
      startRealtime();
      var th = document.getElementById('sabchat-thread'); if (th) th.scrollTop = th.scrollHeight;
    });
  }
  function setupProactive(){
    var rules = CFG.proactiveRules || [];
    for (var i=0;i<rules.length;i++){ (function(rule){
      if (rule.trigger === 'time'){
        var secs = parseInt(rule.value, 10) || 10;
        setTimeout(function(){ fireProactive(rule); }, secs * 1000);
      } else if (rule.trigger === 'url'){
        if (rule.value && (location.href.indexOf(rule.value) >= 0 || location.pathname.indexOf(rule.value) >= 0)) {
          setTimeout(function(){ fireProactive(rule); }, 3000);
        }
      } else if (rule.trigger === 'scroll'){
        var pct = parseInt(rule.value, 10) || 50;
        window.addEventListener('scroll', function(){
          var sh = document.documentElement.scrollHeight - window.innerHeight;
          var depth = sh > 0 ? (window.scrollY / sh) * 100 : 0;
          if (depth >= pct) fireProactive(rule);
        });
      } else if (rule.trigger === 'exitIntent'){
        document.addEventListener('mouseout', function(e){ if (!e.relatedTarget && e.clientY <= 0) fireProactive(rule); });
      }
    })(rules[i]); }
  }

  function boot(){
    if (S.booted) return; S.booted = true;
    S.token = readToken();
    bootConfig().then(function(c){
      if (c && c.enabled === false) return; // inbox disabled — render nothing
      mount();
      render();
      setupProactive();
      if (S.token){ startRealtime(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();`;
