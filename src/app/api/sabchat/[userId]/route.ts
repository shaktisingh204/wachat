
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    if (!userId) {
        return new NextResponse('User ID is required', { status: 400 });
    }

    // The definitive fix: Check if the ID is a valid 24-char hex string BEFORE trying to use it.
    if (!ObjectId.isValid(userId)) {
        // If the ID format is wrong, the user can never be found.
        return new NextResponse('User not found', { status: 404 });
    }

    try {
        const { db } = await connectToDatabase();

        // Now we can safely create the ObjectId
        const userObjectId = new ObjectId(userId);
        const user = await db.collection('users').findOne({ _id: userObjectId });

        if (!user) {
            return new NextResponse('User not found', { status: 404 });
        }

        const settings = user.sabChatSettings || {};

        if (settings.enabled === false) {
            return new NextResponse('// Chat widget is disabled by the administrator.', {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }

        let appUrl = process.env.NEXT_PUBLIC_APP_URL;

        if (!appUrl) {
            const host = request.headers.get('host');
            const protocol = request.headers.get('x-forwarded-proto') || 'http';
            appUrl = `${protocol}://${host}`;
        }


        const script = `
            (function() {
                const config = ${JSON.stringify(settings)};
                const userId = "${userId}";
                let sessionId = localStorage.getItem('sabchat_session_id');
                let visitorId = localStorage.getItem('sabchat_visitor_id');
                let chatHistory = [];
                let isWidgetOpen = false;
                let heartbeatInterval;

                const CONSTANTS = {
                    HEARTBEAT_INTERVAL: 120000, // 2 minutes
                    POLL_INTERVAL: 5000, // 5 seconds
                    API_BASE: "${appUrl}/api/sabchat"
                };

                function createStyles() {
                    const style = document.createElement('style');
                    style.innerHTML = \`
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
                        
                        #sabnode-widget-root {
                            font-family: 'Inter', sans-serif;
                            position: fixed;
                            bottom: 20px;
                            right: 20px;
                            z-index: 2147483647; /* Max z-index */
                            display: flex;
                            flex-direction: column;
                            align-items: flex-end;
                            gap: 16px;
                            pointer-events: none; /* Let clicks pass through wrapper */
                        }

                        #sabnode-widget-root * {
                            box-sizing: border-box;
                            pointer-events: auto; /* Re-enable clicks for children */
                        }

                        /* --- Launcher Button --- */
                        #sabnode-launcher {
                            width: 60px;
                            height: 60px;
                            border-radius: 30px;
                            background-color: \${config.widgetColor || '#000000'};
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
                            border: none;
                            outline: none;
                        }

                        #sabnode-launcher:hover {
                            transform: scale(1.05);
                            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
                        }

                        #sabnode-launcher:active {
                            transform: scale(0.95);
                        }

                        #sabnode-launcher svg {
                            width: 32px;
                            height: 32px;
                            fill: white;
                            transition: opacity 0.3s ease, transform 0.3s ease;
                            position: absolute;
                        }

                        /* Icon Transitions */
                        .sabnode-icon-close { opacity: 0; transform: rotate(-90deg); }
                        .sabnode-open .sabnode-icon-open { opacity: 0; transform: rotate(90deg); }
                        .sabnode-open .sabnode-icon-close { opacity: 1; transform: rotate(0); }

                        /* --- Chat Window --- */
                        #sabnode-window {
                            width: 380px;
                            height: 600px;
                            max-height: calc(100vh - 100px);
                            max-width: calc(100vw - 40px);
                            background: white;
                            border-radius: 16px;
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                            display: flex;
                            flex-direction: column;
                            overflow: hidden;
                            opacity: 0;
                            transform: translateY(20px) scale(0.95);
                            transform-origin: bottom right;
                            transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                            pointer-events: none; /* Hidden state */
                            visibility: hidden;
                        }

                        #sabnode-window.sabnode-active {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                            pointer-events: auto;
                            visibility: visible;
                        }

                        /* Header */
                        .sabnode-header {
                            background: \${config.widgetColor || '#000000'};
                            padding: 24px 24px 32px; /* Extra bottom padding for overlap */
                            color: white;
                            flex-shrink: 0;
                        }

                        .sabnode-header-content {
                            display: flex;
                            align-items: center;
                            gap: 16px;
                        }

                        .sabnode-avatar {
                            width: 48px;
                            height: 48px;
                            border-radius: 50%;
                            background: rgba(255,255,255,0.2);
                            object-fit: cover;
                            border: 2px solid rgba(255,255,255,0.3);
                        }

                        .sabnode-title {
                            font-size: 18px;
                            font-weight: 600;
                            line-height: 1.2;
                        }

                        .sabnode-subtitle {
                            font-size: 13px;
                            opacity: 0.8;
                            margin-top: 4px;
                        }

                        /* Chat Body */
                        .sabnode-body {
                            flex: 1;
                            background: #F9FAFB;
                            padding: 20px;
                            overflow-y: auto;
                            display: flex;
                            flex-direction: column;
                            gap: 12px;
                            margin-top: -16px; /* Pull up to overlap header */
                            border-top-left-radius: 16px;
                            border-top-right-radius: 16px;
                        }
                        
                        /* Email Form */
                         .sabnode-email-form {
                            background: white;
                            padding: 24px;
                            border-radius: 12px;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                            margin-top: auto;
                            margin-bottom: auto;
                        }
                        
                        .sabnode-input-group { margin-bottom: 16px; }
                        
                        .sabnode-input {
                            width: 100%;
                            padding: 12px 16px;
                            border: 1px solid #E5E7EB;
                            border-radius: 8px;
                            font-size: 14px;
                            font-family: inherit;
                            transition: border-color 0.2s;
                            outline: none;
                        }
                        
                        .sabnode-input:focus { border-color: \${config.widgetColor || '#000000'}; }

                        .sabnode-btn {
                            width: 100%;
                            padding: 12px;
                            border: none;
                            border-radius: 8px;
                            background: \${config.widgetColor || '#000000'};
                            color: white;
                            font-weight: 600;
                            cursor: pointer;
                            transition: opacity 0.2s;
                        }
                        
                        .sabnode-btn:hover { opacity: 0.9; }

                        /* Messages */
                        .sabnode-msg {
                            max-width: 85%;
                            padding: 12px 16px;
                            border-radius: 16px;
                            font-size: 14px;
                            line-height: 1.5;
                            animation: sabnode-fade-in 0.3s ease;
                        }

                        @keyframes sabnode-fade-in {
                            from { opacity: 0; transform: translateY(10px); }
                            to { opacity: 1; transform: translateY(0); }
                        }

                        .sabnode-msg-agent {
                            background: white;
                            color: #1F2937;
                            border-bottom-left-radius: 4px;
                            align-self: flex-start;
                            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                        }

                        .sabnode-msg-visitor {
                            background: \${config.widgetColor || '#000000'};
                            color: white;
                            border-bottom-right-radius: 4px;
                            align-self: flex-end;
                        }

                        .sabnode-welcome {
                            background: #EEF2FF;
                            color: #3730A3;
                            padding: 16px;
                            border-radius: 12px;
                            font-size: 14px;
                            margin-bottom: 24px;
                        }

                         /* Footer */
                        .sabnode-footer {
                            padding: 16px 20px;
                            background: white;
                            border-top: 1px solid #F3F4F6;
                        }

                        .sabnode-footer-form {
                            display: flex;
                            gap: 8px;
                            background: #F9FAFB;
                            padding: 4px; /* padding around input */
                            border-radius: 24px;
                            border: 1px solid #E5E7EB;
                            align-items: center;
                        }
                        
                        .sabnode-footer-form:focus-within {
                             border-color: \${config.widgetColor || '#000000'};
                             background: white;
                        }

                        .sabnode-chat-input {
                            flex: 1;
                            border: none;
                            background: transparent;
                            padding: 10px 16px;
                            outline: none;
                            font-size: 14px;
                            font-family: inherit;
                        }
                        
                        .sabnode-send-btn {
                             background: transparent;
                             border: none;
                             cursor: pointer;
                             padding: 8px;
                             color: \${config.widgetColor || '#000000'};
                             display: flex;
                             align-items: center;
                             justify-content: center;
                             transition: transform 0.2s;
                        }
                        
                        .sabnode-send-btn:hover { transform: translateX(2px); }
                        .sabnode-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                    \`;
                    document.head.appendChild(style);
                }

                function createDOM() {
                    createStyles();

                    const root = document.createElement('div');
                    root.id = 'sabnode-widget-root';
                    
                    root.innerHTML = \`
                        <div id="sabnode-window">
                            <!-- Injected by render() -->
                        </div>
                        <button id="sabnode-launcher" aria-label="Open Chat">
                            <svg class="sabnode-icon-open" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                            <svg class="sabnode-icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                    \`;
                    
                    document.body.appendChild(root);

                    document.getElementById('sabnode-launcher').onclick = toggleWidget;
                    render();
                }

                function toggleWidget() {
                    isWidgetOpen = !isWidgetOpen;
                    const win = document.getElementById('sabnode-window');
                    const btn = document.getElementById('sabnode-launcher');
                    
                    if (isWidgetOpen) {
                        win.classList.add('sabnode-active');
                        btn.classList.add('sabnode-open');
                        
                        // Force a heartbeat when opened to ensure "Online" status immediately
                        heartbeat(); 
                    } else {
                        win.classList.remove('sabnode-active');
                        btn.classList.remove('sabnode-open');
                    }
                }

                // Heartbeat to keep the session alive
                function startHeartbeat() {
                    const email = localStorage.getItem('sabchat_email');
                    const name = localStorage.getItem('sabchat_name');
                    if (heartbeatInterval) clearInterval(heartbeatInterval);
                    
                    if (email) {
                        // Initial beat
                        getOrCreateSession(name, email);
                        // Beat every 2 minutes
                        heartbeatInterval = setInterval(() => {
                            getOrCreateSession(name, email);
                        }, CONSTANTS.HEARTBEAT_INTERVAL);
                    }
                }
                
                function heartbeat() {
                     const email = localStorage.getItem('sabchat_email');
                     const name = localStorage.getItem('sabchat_name');
                     if(email) getOrCreateSession(name, email);
                }

                function render() {
                    const win = document.getElementById('sabnode-window');
                    const email = localStorage.getItem('sabchat_email');

                    if (sessionId && email) {
                        // We have an active session
                        if (!win.querySelector('.sabnode-chat-input')) {
                            win.innerHTML = getChatTemplate();
                            setupChatListeners();
                        }
                        startHeartbeat(); // Ensure heartbeat is running
                    } else {
                        // Show email form
                        win.innerHTML = getEmailTemplate();
                        setupEmailListeners();
                        if (heartbeatInterval) clearInterval(heartbeatInterval);
                    }
                }

                function getHeader() {
                    return \`
                        <div class="sabnode-header">
                            <div class="sabnode-header-content">
                                <img src="\${config.avatarUrl || 'https://ui-avatars.com/api/?name=Support&background=random'}" class="sabnode-avatar" alt="Team">
                                <div>
                                    <div class="sabnode-title">\${config.teamName || 'Support Team'}</div>
                                    <div class="sabnode-subtitle">We typically reply in a few minutes</div>
                                </div>
                            </div>
                        </div>
                    \`;
                }

                function getEmailTemplate() {
                    return \`
                        \${getHeader()}
                        <div class="sabnode-body">
                            <div class="sabnode-welcome">
                                \${config.welcomeMessage || 'Hello! How can we help you today?'}
                            </div>
                            <form id="sabnode-email-form" class="sabnode-email-form">
                                <div class="sabnode-input-group">
                                    <label style="display:block; margin-bottom:8px; font-size:14px; font-weight:500;">Your Name</label>
                                    <input type="text" id="sabnode-name" class="sabnode-input" placeholder="John Doe" required>
                                </div>
                                <div class="sabnode-input-group">
                                    <label style="display:block; margin-bottom:8px; font-size:14px; font-weight:500;">Email Address</label>
                                    <input type="email" id="sabnode-email" class="sabnode-input" placeholder="name@example.com" required>
                                </div>
                                <button type="submit" class="sabnode-btn">Start Chat</button>
                            </form>
                        </div>
                    \`;
                }

                function getChatTemplate() {
                    return \`
                        \${getHeader()}
                        <div class="sabnode-body" id="sabnode-msgs">
                             <div class="sabnode-msg sabnode-msg-agent">
                                \${config.welcomeMessage || 'Hello! How can we help you today?'}
                            </div>
                        </div>
                        <div class="sabnode-footer">
                            <form id="sabnode-chat-form" class="sabnode-footer-form">
                                <input id="sabnode-chat-input" class="sabnode-chat-input" placeholder="Type a message..." autocomplete="off">
                                <button type="submit" class="sabnode-send-btn">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                                </button>
                            </form>
                        </div>
                    \`;
                }

                function setupEmailListeners() {
                    const form = document.getElementById('sabnode-email-form');
                    form.onsubmit = async (e) => {
                        e.preventDefault();
                        const name = document.getElementById('sabnode-name').value;
                        const email = document.getElementById('sabnode-email').value;
                        if (!email || !name) return;
                        
                        const btn = form.querySelector('button');
                        btn.disabled = true;
                        btn.textContent = 'Starting...';

                        localStorage.setItem('sabchat_name', name);
                        localStorage.setItem('sabchat_email', email);
                        await getOrCreateSession(name, email);
                        render();
                    };
                }

                function setupChatListeners() {
                    const form = document.getElementById('sabnode-chat-form');
                    form.onsubmit = (e) => {
                        e.preventDefault();
                        sendMessage();
                    };
                    
                    // Poll for history
                    updateHistory();
                    setInterval(updateHistory, CONSTANTS.POLL_INTERVAL);
                }

                async function sendMessage() {
                    const input = document.getElementById('sabnode-chat-input');
                    const content = input.value.trim();
                    if (!content) return;

                    input.value = '';
                    
                    // Optimistic update
                    chatHistory.push({ sender: 'visitor', content, timestamp: new Date().toISOString() });
                    renderMessages();

                    const currentSessionId = localStorage.getItem('sabchat_session_id');
                    await fetch(\`\${CONSTANTS.API_BASE}/message\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: currentSessionId, content, sender: 'visitor' })
                    });
                }
                
                async function updateHistory() {
                    if (!sessionId) return;
                    try {
                        const res = await fetch(\`\${CONSTANTS.API_BASE}/history?sessionId=\${sessionId}\`);
                        if (res.ok) {
                            const data = await res.json();
                            // Simple diff check (length) - could be more robust
                            if (data.history && data.history.length !== chatHistory.length) {
                                chatHistory = data.history || [];
                                renderMessages();
                            }
                        }
                    } catch (e) { console.error('History poll failed', e); }
                }

                function renderMessages() {
                    const container = document.getElementById('sabnode-msgs');
                    if (!container) return;
                                        
                    let html = \`
                        <div class="sabnode-msg sabnode-msg-agent">
                            \${config.welcomeMessage || 'Hello! How can we help you today?'}
                        </div>
                    \`;
                    
                    chatHistory.forEach(msg => {
                        html += \`
                            <div class="sabnode-msg \${msg.sender === 'visitor' ? 'sabnode-msg-visitor' : 'sabnode-msg-agent'}">
                                \${msg.content}
                            </div>
                        \`;
                    });
                    
                    container.innerHTML = html;
                    container.scrollTop = container.scrollHeight;
                }

                async function getOrCreateSession(name, email) {
                    try {
                        const res = await fetch(\`\${CONSTANTS.API_BASE}/session\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, name, email, visitorId })
                        });
                        
                        if (res.ok) {
                            const data = await res.json();
                            if (data.sessionId) {
                                sessionId = data.sessionId;
                                visitorId = data.session.visitorId;
                                localStorage.setItem('sabchat_session_id', sessionId);
                                localStorage.setItem('sabchat_visitor_id', visitorId);
                                chatHistory = data.session.history || [];
                            }
                        }
                    } catch (e) {
                         console.error('Session init failed', e);
                    }
                }

                if (document.readyState === 'complete') {
                    createDOM();
                } else {
                    window.addEventListener('load', createDOM);
                }
            })();
        `;

        return new NextResponse(script, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            }
        });

    } catch (e) {
        console.error("Failed to generate sabChat widget script:", e);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
