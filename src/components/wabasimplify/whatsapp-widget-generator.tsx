
'use client';

import { useState, useMemo } from 'react';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, MessageSquare, Code } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { WhatsAppIcon } from './custom-sidebar-components';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';
import { Separator } from '../ui/separator';

interface WhatsAppWidgetGeneratorProps {
  project: WithId<Project>;
}

export function WhatsAppWidgetGenerator({ project }: WhatsAppWidgetGeneratorProps) {
    const [selectedPhone, setSelectedPhone] = useState<string>(project.phoneNumbers?.[0]?.display_phone_number || '');
    const [prefilledMessage, setPrefilledMessage] = useState('Hello, I have a question.');
    
    // Widget Customization State
    const [widgetPosition, setWidgetPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
    const [widgetColor, setWidgetColor] = useState('#25D366');
    const [headerTitle, setHeaderTitle] = useState(project.name);
    const [headerSubtitle, setHeaderSubtitle] = useState('Typically replies within a few minutes');
    const [headerAvatarUrl, setHeaderAvatarUrl] = useState(project.phoneNumbers?.[0]?.profile?.profile_picture_url || '');
    const [welcomeMessage, setWelcomeMessage] = useState('Welcome! How can we help you today?');
    const [ctaText, setCtaText] = useState('Start Chat');
    const [showWidget, setShowWidget] = useState(false); // To toggle preview

    const { copy } = useCopyToClipboard();

    const generateHtmlCode = () => {
        const waId = selectedPhone.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(prefilledMessage);
        
        return `
<!-- SabNode WhatsApp Widget Start -->
<style>
  #sabnode-widget-container {
    position: fixed;
    ${widgetPosition.includes('bottom') ? 'bottom: 20px;' : ''}
    ${widgetPosition === 'bottom-right' ? 'right: 20px;' : ''}
    ${widgetPosition === 'bottom-left' ? 'left: 20px;' : ''}
    z-index: 9999;
  }
  #sabnode-widget-button {
    background-color: ${widgetColor};
    color: white;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: transform 0.2s;
  }
  #sabnode-widget-button:hover {
    transform: scale(1.1);
  }
  #sabnode-widget-chatbox {
    position: absolute;
    bottom: 80px;
    ${widgetPosition === 'bottom-right' ? 'right: 0;' : 'left: 0;'}
    width: 350px;
    max-width: calc(100vw - 40px);
    background: white;
    border-radius: 10px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    display: none;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s, transform 0.3s;
  }
  #sabnode-widget-chatbox.sabnode-show {
    display: flex;
    opacity: 1;
    transform: translateY(0);
  }
  .sabnode-chat-header {
    background: ${widgetColor};
    color: white;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .sabnode-chat-header img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  .sabnode-chat-header-text .title {
    font-weight: bold;
    font-size: 1rem;
  }
  .sabnode-chat-header-text .subtitle {
    font-size: 0.8rem;
    opacity: 0.9;
  }
  .sabnode-chat-body {
    background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARMAAAEBDAYAAACsL2sOAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABMSURBVHja7cExAQAAAMKg9U9tB2+gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8gZEIAAEu8axTAAAAAElFTkSuQmCC');
    background-color: #E5DDD5;
    padding: 1rem;
    flex-grow: 1;
    min-height: 250px;
  }
  .sabnode-welcome-msg {
    background: white;
    padding: 0.75rem;
    border-radius: 8px;
    font-size: 0.9rem;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }
  .sabnode-chat-footer {
    padding: 1rem;
    background: #f0f0f0;
  }
  .sabnode-cta-button {
    background-color: ${widgetColor};
    color: white;
    border: none;
    width: 100%;
    padding: 0.75rem;
    border-radius: 25px;
    font-size: 1rem;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
</style>
<div id="sabnode-widget-container">
  <div id="sabnode-widget-chatbox">
    <div class="sabnode-chat-header">
      <img src="${headerAvatarUrl || 'https://placehold.co/100x100.png'}" alt="Avatar">
      <div class="sabnode-chat-header-text">
        <div class="title">${headerTitle}</div>
        <div class="subtitle">${headerSubtitle}</div>
      </div>
    </div>
    <div class="sabnode-chat-body">
      <div class="sabnode-welcome-msg">${welcomeMessage}</div>
    </div>
    <div class="sabnode-chat-footer">
      <a href="https://wa.me/${waId}?text=${encodedMessage}" target="_blank" class="sabnode-cta-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>
        ${ctaText}
      </a>
    </div>
  </div>
  <button id="sabnode-widget-button">
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>
  </button>
</div>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    const widgetButton = document.getElementById('sabnode-widget-button');
    const chatbox = document.getElementById('sabnode-widget-chatbox');
    
    widgetButton.addEventListener('click', function() {
      chatbox.classList.toggle('sabnode-show');
    });
  });
</script>
<!-- SabNode WhatsApp Widget End -->
`;
    };

    return (
        <Card className="card-gradient card-gradient-blue">
            <CardHeader>
                <CardTitle>WhatsApp Widget Generator</CardTitle>
                <CardDescription>Create a customizable chat widget to embed on your website.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                    {/* Customization Panel */}
                    <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Widget Position</Label><Select value={widgetPosition} onValueChange={(v) => setWidgetPosition(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bottom-right">Bottom Right</SelectItem><SelectItem value="bottom-left">Bottom Left</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Widget Color</Label><Input type="color" value={widgetColor} onChange={e => setWidgetColor(e.target.value)} /></div>
                        </div>
                        <Separator />
                        <h3 className="font-semibold text-base">Header</h3>
                        <div className="space-y-2"><Label>Avatar URL</Label><Input placeholder="https://..." value={headerAvatarUrl} onChange={e => setHeaderAvatarUrl(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Title</Label><Input value={headerTitle} onChange={e => setHeaderTitle(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Subtitle</Label><Input value={headerSubtitle} onChange={e => setHeaderSubtitle(e.target.value)} /></div>
                        <Separator />
                        <h3 className="font-semibold text-base">Content</h3>
                         <div className="space-y-2"><Label>Phone Number</Label><Select value={selectedPhone} onValueChange={setSelectedPhone}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{project.phoneNumbers.map(phone => (<SelectItem key={phone.id} value={phone.display_phone_number}>{phone.display_phone_number}</SelectItem>))}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Welcome Message</Label><Textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Pre-filled User Message</Label><Textarea value={prefilledMessage} onChange={e => setPrefilledMessage(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Call to Action Text</Label><Input value={ctaText} onChange={e => setCtaText(e.target.value)} /></div>
                    </div>
                    {/* Preview and Code Panel */}
                    <div className="space-y-4">
                        <Label>Live Preview</Label>
                        <div className="relative h-[400px] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                            <div id="sabnode-widget-container" className="static" style={{ [widgetPosition.includes('right') ? 'right' : 'left']: 'auto', bottom: 'auto' }}>
                                <Button id="sabnode-widget-button" style={{ backgroundColor: widgetColor }} onClick={() => setShowWidget(!showWidget)} className="relative">
                                    <WhatsAppIcon className="h-8 w-8 text-white"/>
                                </Button>
                                {showWidget && (
                                     <div id="sabnode-widget-chatbox" className="sabnode-show absolute" style={{ bottom: '80px', [widgetPosition.includes('right') ? 'right' : 'left']: '0px' }}>
                                        <div className="sabnode-chat-header" style={{backgroundColor: widgetColor}}>
                                            <Avatar className="w-10 h-10"><AvatarImage src={headerAvatarUrl} /><AvatarFallback>{headerTitle.charAt(0)}</AvatarFallback></Avatar>
                                            <div className="sabnode-chat-header-text"><div className="title">{headerTitle}</div><div className="subtitle">{headerSubtitle}</div></div>
                                        </div>
                                        <div className="sabnode-chat-body"><div className="sabnode-welcome-msg">{welcomeMessage}</div></div>
                                        <div className="sabnode-chat-footer"><Button className="sabnode-cta-button" style={{backgroundColor: widgetColor}}><WhatsAppIcon className="h-4 w-4 mr-2"/>{ctaText}</Button></div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                             <Label>Embed Code</Label>
                             <CodeBlock code={generateHtmlCode()} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
