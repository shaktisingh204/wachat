/**
 * SabChat embeddable widget v2.
 *
 * Returns a self-contained vanilla-JS bundle that talks to the public
 * widget endpoints owned by the `sabchat-widget` Rust crate:
 *
 *   GET  /v1/sabchat/widget/config?inboxId=...
 *   POST /v1/sabchat/widget/session
 *   POST /v1/sabchat/widget/messages
 *   GET  /v1/sabchat/widget/history?visitorToken=...&limit=50
 *
 * The route param is named `userId` for backwards-compat with the legacy
 * embed URL; we accept the inbox id either as `?inboxId=...` (preferred)
 * or fall back to the path param when no query is provided.
 */
import { NextRequest, NextResponse } from 'next/server';

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

    // Resolve the Rust BFF base URL the embed script will talk to. Falls
    // back to the calling host so a self-hosted SabNode reaches its own
    // BFF behind the same edge.
    const apiBase =
        process.env.NEXT_PUBLIC_RUST_API_URL ||
        process.env.RUST_API_URL ||
        (() => {
            const host = request.headers.get('host');
            const proto = request.headers.get('x-forwarded-proto') || 'https';
            return host ? `${proto}://${host}` : '';
        })();

    const script = `(function(){
    var INBOX_ID = ${JSON.stringify(inboxId)};
    var API = ${JSON.stringify(apiBase)};
    var TOKEN_KEY = 'sabchatVisitorToken';
    var POLL_MS = 5000;

    var state = { config: null, visitorToken: null, messages: [], open: false, lastLen: 0, pollTimer: null };

    function api(path, opts){
        return fetch(API + path, Object.assign({ headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }, opts || {}))
            .then(function(r){ if(!r.ok) throw new Error('SabChat ' + r.status); return r.json(); });
    }

    function loadToken(){ try { return localStorage.getItem(TOKEN_KEY); } catch(e) { return null; } }
    function saveToken(t){ try { localStorage.setItem(TOKEN_KEY, t); } catch(e) {} }

    function injectStyles(color){
        if (document.getElementById('sabchat-w2-style')) return;
        var s = document.createElement('style');
        s.id = 'sabchat-w2-style';
        s.textContent = [
            '#sabchat-w2-root{position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
            '#sabchat-w2-bubble{width:60px;height:60px;border-radius:30px;background:' + color + ';color:#fff;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;transition:transform .2s;}',
            '#sabchat-w2-bubble:hover{transform:scale(1.05);}',
            '#sabchat-w2-bubble svg{width:28px;height:28px;fill:#fff;}',
            '#sabchat-w2-panel{position:absolute;bottom:80px;right:0;width:360px;height:520px;max-height:80vh;background:#fff;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;}',
            '#sabchat-w2-panel.open{display:flex;}',
            '.sabchat-w2-head{background:' + color + ';color:#fff;padding:16px 20px;font-weight:600;font-size:15px;}',
            '.sabchat-w2-body{flex:1;overflow-y:auto;padding:16px;background:#f7f8fa;display:flex;flex-direction:column;gap:8px;}',
            '.sabchat-w2-msg{max-width:80%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.4;word-wrap:break-word;}',
            '.sabchat-w2-msg.in{background:#fff;color:#111;align-self:flex-start;box-shadow:0 1px 2px rgba(0,0,0,.06);}',
            '.sabchat-w2-msg.out{background:' + color + ';color:#fff;align-self:flex-end;}',
            '.sabchat-w2-welcome{font-size:13px;color:#555;text-align:center;padding:8px;}',
            '.sabchat-w2-foot{padding:10px;border-top:1px solid #eee;display:flex;gap:8px;background:#fff;}',
            '.sabchat-w2-foot input{flex:1;border:1px solid #e2e4ea;border-radius:20px;padding:10px 14px;font-size:14px;outline:none;}',
            '.sabchat-w2-foot input:focus{border-color:' + color + ';}',
            '.sabchat-w2-foot button{background:' + color + ';color:#fff;border:none;border-radius:20px;padding:0 16px;cursor:pointer;font-size:14px;}'
        ].join('');
        document.head.appendChild(s);
    }

    function render(){
        var root = document.getElementById('sabchat-w2-root');
        if (!root) return;
        var color = (state.config && state.config.widgetColor) || '#111827';
        var welcome = (state.config && state.config.welcomeMessage) || 'Hi! How can we help?';
        var title = (state.config && (state.config.teamName || state.config.title)) || 'Support';

        injectStyles(color);

        var msgsHtml = '<div class="sabchat-w2-welcome">' + escapeHtml(welcome) + '</div>';
        for (var i=0;i<state.messages.length;i++){
            var m = state.messages[i];
            var side = (m.direction === 'outbound' || m.senderType === 'visitor') ? 'out' : 'in';
            msgsHtml += '<div class="sabchat-w2-msg ' + side + '">' + escapeHtml(extractText(m)) + '</div>';
        }

        root.innerHTML =
            '<div id="sabchat-w2-panel" class="' + (state.open ? 'open' : '') + '">' +
                '<div class="sabchat-w2-head">' + escapeHtml(title) + '</div>' +
                '<div class="sabchat-w2-body" id="sabchat-w2-body">' + msgsHtml + '</div>' +
                '<form class="sabchat-w2-foot" id="sabchat-w2-form">' +
                    '<input id="sabchat-w2-input" autocomplete="off" placeholder="Type a message..." />' +
                    '<button type="submit">Send</button>' +
                '</form>' +
            '</div>' +
            '<button id="sabchat-w2-bubble" aria-label="Open chat">' +
                '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>' +
            '</button>';

        document.getElementById('sabchat-w2-bubble').onclick = toggle;
        var f = document.getElementById('sabchat-w2-form');
        if (f) f.onsubmit = onSubmit;
        var body = document.getElementById('sabchat-w2-body');
        if (body) body.scrollTop = body.scrollHeight;
    }

    function escapeHtml(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    function extractText(m){
        if (!m) return '';
        if (typeof m.content === 'string') return m.content;
        if (m.content && typeof m.content === 'object') {
            if (m.content.kind === 'text' || m.content.text) return m.content.text || '';
            if (m.content.kind === 'system') return m.content.text || '';
        }
        return m.text || '';
    }

    function toggle(){
        state.open = !state.open;
        var panel = document.getElementById('sabchat-w2-panel');
        if (panel) panel.classList.toggle('open', state.open);
        if (state.open) { ensureSession().then(function(){ poll(true); }); startPolling(); }
        else { stopPolling(); }
    }

    function ensureSession(){
        if (state.visitorToken) return Promise.resolve();
        var existing = loadToken();
        var body = existing ? { inboxId: INBOX_ID, visitorToken: existing } : { inboxId: INBOX_ID };
        return api('/v1/sabchat/widget/session', { method: 'POST', body: JSON.stringify(body) })
            .then(function(res){
                state.visitorToken = res.visitorToken || (res.session && res.session.visitorToken) || existing;
                if (state.visitorToken) saveToken(state.visitorToken);
            })
            .catch(function(){ /* keep ui responsive */ });
    }

    function onSubmit(e){
        e.preventDefault();
        var input = document.getElementById('sabchat-w2-input');
        var text = input && input.value ? input.value.trim() : '';
        if (!text) return;
        input.value = '';
        state.messages.push({ direction: 'outbound', senderType: 'visitor', content: { kind: 'text', text: text } });
        render();
        ensureSession().then(function(){
            return api('/v1/sabchat/widget/messages', { method: 'POST', body: JSON.stringify({ visitorToken: state.visitorToken, inboxId: INBOX_ID, content: { kind: 'text', text: text } }) });
        }).then(function(){ poll(true); }).catch(function(){});
    }

    function poll(force){
        if (!state.visitorToken) return;
        api('/v1/sabchat/widget/history?visitorToken=' + encodeURIComponent(state.visitorToken) + '&limit=50')
            .then(function(res){
                var items = (res && (res.items || res.history)) || [];
                if (force || items.length !== state.lastLen) {
                    state.messages = items;
                    state.lastLen = items.length;
                    render();
                }
            })
            .catch(function(){});
    }

    function startPolling(){ if (state.pollTimer) return; state.pollTimer = setInterval(function(){ poll(false); }, POLL_MS); }
    function stopPolling(){ if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; } }

    function boot(){
        var root = document.createElement('div');
        root.id = 'sabchat-w2-root';
        document.body.appendChild(root);
        api('/v1/sabchat/widget/config?inboxId=' + encodeURIComponent(INBOX_ID))
            .then(function(cfg){ state.config = cfg && cfg.config ? cfg.config : cfg; render(); })
            .catch(function(){ state.config = {}; render(); });
        // Restore token + warm history without opening
        if (loadToken()) { state.visitorToken = loadToken(); poll(false); }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
`;

    return new NextResponse(script, {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
        },
    });
}
