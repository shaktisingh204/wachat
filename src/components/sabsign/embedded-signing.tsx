'use client';

import * as React from 'react';

/**
 * In-app React wrapper for SabSign embedded signing. Renders the signing
 * portal in an iframe and surfaces completion/decline via callbacks (the
 * portal posts `sabsign:completed` / `sabsign:declined` messages). Mint the
 * `url` server-side with `getEmbedSignUrl(envelopeId, signerId)`.
 */
export interface SabSignEmbedMessage {
  type: string;
  envelopeId?: string;
  signerId?: string;
  status?: string;
}

export interface EmbeddedSigningProps {
  url: string;
  height?: number | string;
  className?: string;
  onComplete?: (msg: SabSignEmbedMessage) => void;
  onDecline?: (msg: SabSignEmbedMessage) => void;
  onMessage?: (msg: SabSignEmbedMessage) => void;
}

export function EmbeddedSigning({
  url,
  height = 800,
  className,
  onComplete,
  onDecline,
  onMessage,
}: EmbeddedSigningProps) {
  const cbRef = React.useRef({ onComplete, onDecline, onMessage });
  cbRef.current = { onComplete, onDecline, onMessage };

  React.useEffect(() => {
    function handler(event: MessageEvent) {
      const data = event.data as SabSignEmbedMessage | undefined;
      if (!data || typeof data.type !== 'string' || !data.type.startsWith('sabsign:')) return;
      cbRef.current.onMessage?.(data);
      if (data.type === 'sabsign:completed') cbRef.current.onComplete?.(data);
      if (data.type === 'sabsign:declined') cbRef.current.onDecline?.(data);
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <iframe
      src={url}
      title="SabSign signing"
      className={className}
      style={{ width: '100%', height, border: 0 }}
      allow="fullscreen"
    />
  );
}
