
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    const { userId } = params;

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
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

        const script = `
            (function() {
                const config = ${JSON.stringify(settings)};
                const userId = "${userId}";
                let sessionId = localStorage.getItem('sabchat_session_id');
                let visitorId = localStorage.getItem('sabchat_visitor_id');
                let chatHistory = [];
                let isWidgetOpen = false;

                function createDOM() {
                    const style = document.createElement('style');
                    style.innerHTML = 
                        '#sabnode-chat-container { position: fixed; right: 20px; bottom: 20px; z-index: 9999; }' +
                        '#sabnode-chat-button { background-color: ' + (config.widgetColor || '#1f2937') + '; color: white; width: 60px; height: 60px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; }' +
                        '#sabnode-chat-button:hover { transform: scale(1.1); }' +
                        '#sabnode-chat-box { position: absolute; bottom: 80px; right: 0; width: 350px; max-width: calc(100vw - 40px); background: white; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); display: none; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(20px); transition: opacity 0.3s, transform 0.3s; height: 500px; }' +
                        '#sabnode-chat-box.sabnode-show { display: flex; opacity: 1; transform: translateY(0); }' +
                        '.sabnode-chat-header { background: ' + (config.widgetColor || '#1f2937') + '; color: white; padding: 16px; display: flex; align-items: center; gap: 12px; }' +
                        '.sabnode-chat-header img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }' +
                        '.sabnode-chat-header .title { font-weight: bold; }' +
                        '.sabnode-chat-body { flex-grow: 1; padding: 16px; background: #f0f2f5; overflow-y: auto; }' +
                        '.sabnode-chat-footer { padding: 12px; background: white; border-top: 1px solid #eee; }' +
                        '.sabnode-chat-input { width: 100%; border: 1px solid #ccc; border-radius: 20px; padding: 8px 12px; }' +
                        '.sabnode-chat-msg { max-width: 80%; padding: 8px 12px; border-radius: 18px; line-height: 1.4; word-wrap: break-word; }' +
                        '.sabnode-msg-visitor { background: #dcf8c6; border-bottom-right-radius: 4px; align-self: flex-end; }' +
                        '.sabnode-msg-agent { background: #fff; border-bottom-left-radius: 4px; align-self: flex-start; }' +
                        '.sabnode-msg-container { display: flex; flex-direction: column; gap: 8px; }';
                    document.head.appendChild(style);

                    const container = document.createElement('div');
                    container.id = 'sabnode-chat-container';
                    document.body.appendChild(container);
                    
                    render();
                }

                function handleToggle() {
                    isWidgetOpen = !isWidgetOpen;
                    const chatBox = document.getElementById('sabnode-chat-box');
                    if (chatBox) chatBox.classList.toggle('sabnode-show');
                }
                
                function renderEmailForm() {
                    const container = document.getElementById('sabnode-chat-container');
                    if (!container) return;
                    container.innerHTML = \`
                         <div id="sabnode-chat-box" class="\${isWidgetOpen ? 'sabnode-show' : ''}" style="height: auto;">
                            <div class="sabnode-chat-header">
                                <img src="\${config.avatarUrl || 'https://placehold.co/100x100.png'}" alt="Avatar">
                                <div><div class="title">\${config.teamName || 'Support Team'}</div></div>
                            </div>
                            <div class="sabnode-chat-body" style="background: #fff; text-align: center;">
                                <p class="sabnode-welcome-msg" style="text-align: left; margin-bottom: 1rem; background: #f0f2f5; padding: 8px 12px; border-radius: 18px;">\${config.welcomeMessage || 'Hello! How can we help?'}</p>
                                <form id="sabnode-email-form" style="padding: 1rem 0;">
                                    <input id="sabnode-email-input" type="email" placeholder="Enter your email to start" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; margin-bottom: 8px;"/>
                                    <button type="submit" style="width: 100%; padding: 10px; border: none; border-radius: 4px; background-color: \${config.widgetColor}; color: #fff; cursor: pointer;">Start Chat</button>
                                </form>
                            </div>
                        </div>
                        <button id="sabnode-chat-button">
                             <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                        </button>
                    \`;
                    
                    document.getElementById('sabnode-email-form').addEventListener('submit', handleEmailSubmit);
                    document.getElementById('sabnode-chat-button').addEventListener('click', handleToggle);
                }

                function renderChatInterface() {
                     const container = document.getElementById('sabnode-chat-container');
                     if (!container) return;
                    container.innerHTML = \`
                        <div id="sabnode-chat-box" class="\${isWidgetOpen ? 'sabnode-show' : ''}">
                            <div class="sabnode-chat-header">
                                <img src="\${config.avatarUrl || 'https://placehold.co/100x100.png'}" alt="Avatar">
                                <div><div class="title">\${config.teamName || 'Support Team'}</div></div>
                            </div>
                            <div class="sabnode-chat-body" id="sabnode-chat-body">
                                <div class="sabnode-msg-container" id="sabnode-msg-container">
                                    <div class="sabnode-welcome-msg">\${config.welcomeMessage || 'Hello! How can we help?'}</div>
                                </div>
                            </div>
                            <div class="sabnode-chat-footer">
                                <form id="sabnode-msg-form" style="display: flex; gap: 8px;">
                                    <input id="sabnode-msg-input" class="sabnode-chat-input" placeholder="Type your message..." autocomplete="off" />
                                    <button type="submit" style="background: none; border: none; cursor: pointer;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="\${config.widgetColor}"><path d="m2 21 21-9L2 3v7l15 2-15 2z"/></svg>
                                    </button>
                                </form>
                            </div>
                        </div>
                        <button id="sabnode-chat-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                        </button>
                    \`;

                    updateChatHistory();
                    document.getElementById('sabnode-msg-form').addEventListener('submit', handleMessageSend);
                    document.getElementById('sabnode-chat-button').addEventListener('click', handleToggle);
                }
                
                function updateChatHistory() {
                    const msgContainer = document.getElementById('sabnode-msg-container');
                    if(!msgContainer) return;
                    
                    msgContainer.innerHTML = \`<div class="sabnode-welcome-msg" style="background: #f0f2f5; padding: 8px 12px; border-radius: 18px; margin-bottom: 1rem;">\${config.welcomeMessage || 'Hello! How can we help?'}</div>\`;

                    chatHistory.forEach(msg => {
                        const msgDiv = document.createElement('div');
                        msgDiv.classList.add('sabnode-chat-msg', msg.sender === 'visitor' ? 'sabnode-msg-visitor' : 'sabnode-msg-agent');
                        msgDiv.textContent = msg.content;
                        msgContainer.appendChild(msgDiv);
                    });
                    
                    const chatBody = document.getElementById('sabnode-chat-body');
                    if(chatBody) chatBody.scrollTop = chatBody.scrollHeight;
                }

                async function handleEmailSubmit(e) {
                    e.preventDefault();
                    const email = document.getElementById('sabnode-email-input').value;
                    if (!email) return;

                    localStorage.setItem('sabchat_email', email);
                    await getOrCreateSession(email);
                    render();
                }

                async function getOrCreateSession(email) {
                    try {
                        const res = await fetch('${appUrl}/api/sabchat/session', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, email, visitorId })
                        });
                        if (!res.ok) throw new Error('Server responded with an error');
                        const data = await res.json();
                        if (data.sessionId) {
                            sessionId = data.sessionId;
                            visitorId = data.session.visitorId;
                            localStorage.setItem('sabchat_session_id', sessionId);
                            localStorage.setItem('sabchat_visitor_id', visitorId);
                            chatHistory = data.session.history || [];
                        }
                    } catch (err) {
                        console.error("SabChat: Failed to create session", err);
                    }
                }
                
                async function handleMessageSend(e) {
                    e.preventDefault();
                    const input = document.getElementById('sabnode-msg-input');
                    const content = input.value;
                    if(!content.trim()) return;

                    input.value = '';
                    chatHistory.push({ sender: 'visitor', content });
                    updateChatHistory();

                    const currentSessionId = localStorage.getItem('sabchat_session_id');
                    if (!currentSessionId) {
                        console.error("SabChat: No session ID found to send message.");
                        return;
                    }

                    await fetch('${appUrl}/api/sabchat/message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: currentSessionId, content, sender: 'visitor' })
                    });
                }
                
                async function getHistory() {
                     if (sessionId) {
                         try {
                            const res = await fetch(\`\${appUrl}/api/sabchat/history?sessionId=\${sessionId}\`);
                            if (!res.ok) throw new Error('Failed to fetch history');
                            const data = await res.json();
                            chatHistory = data.history || [];
                            updateChatHistory();
                         } catch (err) { console.error("Could not fetch history", err); }
                     }
                }

                function render() {
                    const email = localStorage.getItem('sabchat_email');
                    if (sessionId && email) {
                        renderChatInterface();
                        getHistory();
                        setInterval(getHistory, 5000); // Poll for new messages
                    } else if (email) {
                        getOrCreateSession(email).then(renderChatInterface);
                    } else {
                        renderEmailForm();
                    }
                }
                
                function initialize() {
                    createDOM();
                    const email = localStorage.getItem('sabchat_email');
                    if (email) {
                        // Immediately create or update session on page load to mark user as "live"
                        getOrCreateSession(email);
                    }
                }

                if (document.readyState === "complete") {
                    initialize();
                } else {
                    window.addEventListener("load", initialize);
                }
            })();
        `;
        
        return new NextResponse(script, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            }
        });

    } catch(e) {
        console.error("Failed to generate sabChat widget script:", e);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
