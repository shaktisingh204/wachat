'use client';

/**
 * SabCRM PWA offline fallback (`/sabcrm/offline`).
 *
 * Precached by the service worker (`public/sabcrm-sw.js`) and shown when a
 * SabCRM navigation is attempted with no network and no cached page. Pure 20ui.
 * Kept self-contained + client-only so it renders without any data fetch (it
 * must work with zero connectivity). The "Try again" button simply reloads,
 * which re-runs the worker's network-first navigation handler.
 */

import * as React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

import { Button, Card } from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';

export default function SabcrmOfflinePage() {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const sync = () =>
      setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '60vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <Card
        style={{
          maxWidth: 420,
          width: '100%',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 9999,
            background: 'var(--ui20-muted, rgba(99,102,241,0.12))',
            color: 'var(--ui20-primary, #6366f1)',
            marginBottom: '1rem',
          }}
        >
          {renderIcon(WifiOff, { size: 28 })}
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
          You are offline
        </h1>
        <p
          style={{
            color: 'var(--ui20-muted-foreground, #71717a)',
            margin: '0 0 1.5rem',
            fontSize: '0.9rem',
            lineHeight: 1.5,
          }}
        >
          {online
            ? 'Connection restored — reload to continue.'
            : 'SabCRM needs a connection to load this page. Recently-viewed records may still be available from your offline cache.'}
        </p>
        <Button
          variant="primary"
          onClick={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
        >
          {renderIcon(RefreshCw, { size: 16, style: { marginRight: 8 } })}
          Try again
        </Button>
      </Card>
    </div>
  );
}
