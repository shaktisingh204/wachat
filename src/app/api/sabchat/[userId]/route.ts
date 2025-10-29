
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    const { userId } = params;

    if (!userId || !ObjectId.isValid(userId)) {
        return new NextResponse('Invalid User ID', { status: 400 });
    }
    
    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return new NextResponse('User not found', { status: 404 });
        }
        
        const settings = user.sabChatSettings || {};
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

        const script = `
            (function() {
                const config = ${JSON.stringify(settings)};
                const userId = "${userId}";
                
                // --- Don't run on builder preview ---
                if (window.location.pathname.includes('/website-builder/')) return;
                
                const style = document.createElement('style');
                style.innerHTML = 
                    '#sabnode-chat-container { position: fixed; right: 20px; bottom: 20px; z-index: 9999; }' +
                    '#sabnode-chat-button { background-color: ' + (config.widgetColor || '#1f2937') + '; color: white; width: 60px; height: 60px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; }' +
                    '#sabnode-chat-button:hover { transform: scale(1.1); }' +
                    '#sabnode-chat-box { position: absolute; bottom: 80px; right: 0; width: 350px; max-width: calc(100vw - 40px); background: white; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); display: none; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(20px); transition: opacity 0.3s, transform 0.3s; }' +
                    '#sabnode-chat-box.sabnode-show { display: flex; opacity: 1; transform: translateY(0); }' +
                    '.sabnode-chat-header { background: ' + (config.widgetColor || '#1f2937') + '; color: white; padding: 16px; display: flex; align-items: center; gap: 12px; }' +
                    '.sabnode-chat-header img { width: 40px; height: 40px; border-radius: 50%; }' +
                    '.sabnode-chat-header .title { font-weight: bold; }' +
                    '.sabnode-chat-header .subtitle { font-size: 0.8rem; opacity: 0.9; }' +
                    '.sabnode-chat-body { flex-grow: 1; padding: 16px; background: #f9fafb; overflow-y: auto; }' +
                    '.sabnode-welcome-msg { background: #f0f2f5; padding: 12px; border-radius: 8px; font-size: 0.9rem; }' +
                    '.sabnode-chat-footer { padding: 12px; background: white; border-top: 1px solid #eee; }' +
                    '.sabnode-chat-input { width: 100%; border: 1px solid #ccc; border-radius: 20px; padding: 8px 12px; }';
                document.head.appendChild(style);

                const container = document.createElement('div');
                container.id = 'sabnode-chat-container';
                container.innerHTML = \`
                    <div id="sabnode-chat-box">
                        <div class="sabnode-chat-header">
                            <img src="\${config.avatarUrl || 'https://placehold.co/100x100.png'}" alt="Avatar">
                            <div>
                                <div class="title">\${config.teamName || 'Support Team'}</div>
                            </div>
                        </div>
                        <div class="sabnode-chat-body">
                            <div class="sabnode-welcome-msg">\${config.welcomeMessage || 'Hello! How can we help?'}</div>
                        </div>
                        <div class="sabnode-chat-footer">
                            <input class="sabnode-chat-input" placeholder="Type your message..." />
                        </div>
                    </div>
                    <button id="sabnode-chat-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                    </button>
                \`;
                document.body.appendChild(container);

                const chatButton = document.getElementById('sabnode-chat-button');
                const chatBox = document.getElementById('sabnode-chat-box');
                chatButton.addEventListener('click', () => {
                    chatBox.classList.toggle('sabnode-show');
                });
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
