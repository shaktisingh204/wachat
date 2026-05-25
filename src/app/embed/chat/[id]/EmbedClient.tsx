'use client';

import { useEffect, useState } from 'react';
import { SabFlowChat } from '@/components/sabflow/chat/SabFlowChat';
import { ChatHeader } from './components/ChatHeader';
import { ChatGreeting } from './components/ChatGreeting';
import { EmptyFlowFallback } from './components/EmptyFlowFallback';

interface Props {
  flowId?: string;
  widgetName: string;
  greeting: string;
  primaryColor: string;
}

/**
 * Client island for the embed chat shell — renders the chat surface and
 * wires postMessage signalling to the parent (host page) window.
 */
export default function EmbedClient({
  flowId,
  widgetName,
  greeting,
  primaryColor,
}: Props) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    try {
      window.parent?.postMessage({ type: 'sabnode:ready' }, '*');
    } catch {
      /* parent unreachable */
    }
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; open?: boolean } | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'sabnode:visibility') {
        document.documentElement.dataset.sabnodeOpen = data.open ? '1' : '0';
      }
    }
    window.addEventListener('message', onMessage);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function handleClose() {
    try {
      window.parent?.postMessage({ type: 'sabnode:close' }, '*');
    } catch {
      /* noop */
    }
  }

  return (
    <>
      <ChatHeader
        widgetName={widgetName}
        primaryColor={primaryColor}
        onClose={handleClose}
        isOnline={isOnline}
      />
      
      {!isOnline && (
        <div style={{ padding: '8px 16px', background: '#fee2e2', color: '#991b1b', fontSize: 12, textAlign: 'center' }}>
          You are currently offline. Reconnecting...
        </div>
      )}

      <ChatGreeting greeting={greeting} />

      <section style={{ flex: 1, overflow: 'hidden' }}>
        {flowId ? (
          <SabFlowChat flowId={flowId} />
        ) : (
          <EmptyFlowFallback />
        )}
      </section>
    </>
  );
}
