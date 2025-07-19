

import { NextRequest, NextResponse } from 'next/server';
import { getPublicProjectById } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const { projectId } = params;

    if (!projectId || !ObjectId.isValid(projectId)) {
        return new NextResponse('Invalid Project ID', { status: 400 });
    }
    
    // Increment load count
    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $inc: { 'widgetSettings.stats.loads': 1 } },
            { upsert: true }
        );
    } catch (e) {
        console.error("Failed to update widget load stats:", e);
    }

    const project = await getPublicProjectById(projectId);

    if (!project) {
        return new NextResponse('Project not found', { status: 404 });
    }

    const settings = project.widgetSettings;
    const waId = settings?.phoneNumber?.replace(/\D/g, '') || '';
    const prefilledMessage = encodeURIComponent(settings?.prefilledMessage || '');
    const waLink = `https://wa.me/${waId}?text=${prefilledMessage}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    
    // This JS code will be injected into the user's website
    const script = `
        (function() {
            const config = ${JSON.stringify(settings || {})};
            const projectId = "${projectId}";
            
            const trackEvent = (eventType) => {
                fetch('${appUrl}/api/widget/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, eventType }),
                    keepalive: true,
                }).catch(console.error);
            };

            // Create and inject CSS
            const style = document.createElement('style');
            style.innerHTML = \`
                #sabnode-widget-container {
                    position: fixed;
                    \${config.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
                    bottom: 20px;
                    z-index: 9999;
                }
                #sabnode-widget-button {
                    background-color: \${config.buttonColor || '#25D366'};
                    color: \${config.buttonTextColor || 'white'};
                    width: 60px; height: 60px;
                    border-radius: 50%;
                    border: none;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    transition: transform 0.2s;
                }
                #sabnode-widget-button:hover { transform: scale(1.1); }
                #sabnode-widget-chatbox {
                    position: absolute;
                    bottom: 80px;
                    \${config.position === 'bottom-left' ? 'left: 0;' : 'right: 0;'}
                    width: 350px;
                    max-width: calc(100vw - 40px);
                    background: white;
                    border-radius: \${config.borderRadius || 10}px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.2);
                    display: none; flex-direction: column; overflow: hidden;
                    opacity: 0; transform: translateY(20px); transition: opacity 0.3s, transform 0.3s;
                }
                #sabnode-widget-chatbox.sabnode-show { display: flex; opacity: 1; transform: translateY(0); }
                .sabnode-chat-header {
                    background: \${config.buttonColor || '#25D366'};
                    color: \${config.buttonTextColor || 'white'};
                    padding: \${config.padding || 16}px;
                    display: flex; align-items: center; gap: 12px;
                }
                .sabnode-chat-header img { width: 40px; height: 40px; border-radius: 50%; }
                .sabnode-chat-header .title { font-weight: bold; font-size: 1rem; }
                .sabnode-chat-header .subtitle { font-size: 0.8rem; opacity: 0.9; }
                .sabnode-chat-body { padding: \${config.padding || 16}px; }
                .sabnode-welcome-msg { background: #f0f0f0; color: \${config.textColor || '#111827'}; padding: 12px; border-radius: 8px; font-size: 0.9rem; }
                .sabnode-chat-footer { padding: \${config.padding || 16}px; background: #f9f9f9; border-top: 1px solid #eee; }
                .sabnode-cta-button { 
                    background-color: \${config.buttonColor || '#25D366'};
                    color: \${config.buttonTextColor || 'white'};
                    border: none; width: 100%; padding: 12px; border-radius: 25px;
                    font-size: 1rem; cursor: pointer; text-align: center; text-decoration: none;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                }
            \`;
            document.head.appendChild(style);

            // Create HTML
            const container = document.createElement('div');
            container.id = 'sabnode-widget-container';
            container.innerHTML = \`
                <div id="sabnode-widget-chatbox">
                    <div class="sabnode-chat-header">
                        <img src="\${config.headerAvatarUrl || 'https://placehold.co/100x100.png'}" alt="Avatar">
                        <div>
                            <div class="title">\${config.headerTitle || 'Chat with us'}</div>
                            <div class="subtitle">\${config.headerSubtitle || 'We're here to help'}</div>
                        </div>
                    </div>
                    <div class="sabnode-chat-body">
                        <div class="sabnode-welcome-msg">\${config.welcomeMessage || 'Hello! How can we assist you?'}</div>
                    </div>
                    <div class="sabnode-chat-footer">
                        <a href="${waLink}" target="_blank" class="sabnode-cta-button" id="sabnode-cta-link">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326z"/></svg>
                            \${config.ctaText || 'Start Chat'}
                        </a>
                    </div>
                </div>
                <button id="sabnode-widget-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326z"/></svg>
                </button>
            \`;
            document.body.appendChild(container);

            // Add Event Listeners
            const widgetButton = document.getElementById('sabnode-widget-button');
            const chatbox = document.getElementById('sabnode-widget-chatbox');
            const ctaLink = document.getElementById('sabnode-cta-link');

            widgetButton.addEventListener('click', () => {
                const isOpening = !chatbox.classList.contains('sabnode-show');
                if (isOpening) {
                    trackEvent('open');
                }
                chatbox.classList.toggle('sabnode-show');
            });
            
            ctaLink.addEventListener('click', () => {
                trackEvent('click');
            });
        })();
    `;

    return new NextResponse(script, {
        headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
    });
}
