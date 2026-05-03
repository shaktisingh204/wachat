'use client';

import { useEffect } from 'react';
import { SabFlowChat } from '@/components/sabflow/chat/SabFlowChat';

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
    return () => window.removeEventListener('message', onMessage);
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
      <header
        style={{
          padding: '12px 16px',
          background: primaryColor,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <strong style={{ fontSize: 14 }}>{widgetName}</strong>
        <button
          type="button"
          aria-label="Close chat"
          onClick={handleClose}
          style={{
            background: 'transparent',
            color: '#fff',
            border: 0,
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          {'×'}
        </button>
      </header>

      <p
        style={{
          padding: '12px 16px',
          margin: 0,
          fontSize: 13,
          color: '#475569',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        {greeting}
      </p>

      <section style={{ flex: 1, overflow: 'hidden' }}>
        {flowId ? (
          <SabFlowChat flowId={flowId} />
        ) : (
          <div
            style={{
              padding: 24,
              fontSize: 13,
              color: '#475569',
              textAlign: 'center',
            }}
          >
            No flow connected to this widget yet.
          </div>
        )}
      </section>
    </>
  );
}
