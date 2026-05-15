'use client';

/**
 * PairingFlow — visualises a SabWa session moving through
 * Waiting → Pairing → Syncing → Ready by subscribing to
 * `useSabwaStream(sessionId)`.
 *
 * Two modes:
 *   - `mode='qr'`   — renders a 264×264 QR code refreshing every 30s.
 *   - `mode='code'` — renders an 8-character pair code in monospace.
 *
 * The parent owns the session lifecycle (calls `pairSession` to create
 * it, then renders this component). On the first transition to
 * 'connected' we fire `onPaired` exactly once so the page can navigate
 * away (typically to /sabwa/inbox).
 */

import * as React from 'react';
import QRCode from 'react-qr-code';
import { Loader2, RefreshCw, Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSabwaStream } from '@/lib/sabwa/use-sabwa-stream';

import { StatusBadge } from './status-badge';

export interface PairingFlowProps {
  sessionId: string;
  mode: 'qr' | 'code';
  /** Initial QR payload returned by `pairSession({ method: 'qr' })`. */
  initialQr?: string;
  /** Initial 8-character pair code (e.g. `JKLM-NPQR`). */
  initialPairCode?: string;
  /** Fired exactly once when the session first reaches 'connected'. */
  onPaired?: () => void;
  /** Force a refresh from the engine (resets the 30s QR timer). */
  onRefresh?: () => void;
  /** Toggle between QR and pair-code methods. */
  onModeChange?: (mode: 'qr' | 'code') => void;
  className?: string;
}

const QR_LIFETIME_MS = 30_000;

export function PairingFlow({
  sessionId,
  mode,
  initialQr,
  initialPairCode,
  onPaired,
  onRefresh,
  onModeChange,
  className,
}: PairingFlowProps) {
  const stream = useSabwaStream(sessionId, { onConnected: onPaired });

  const qr = stream.qr ?? initialQr;
  const pairCode = stream.pairCode ?? initialPairCode;

  // Derive the badge's status. The stream's `status` is the *connection*
  // state (connecting / open / closed / idle); the session lifecycle
  // comes through `lastEvent.kind === 'status'` payloads.
  const sessionStatus =
    stream.lastEvent?.kind === 'status' && typeof stream.lastEvent.status === 'string'
      ? stream.lastEvent.status
      : stream.isConnected
        ? 'connected'
        : 'pending';

  const badgeStatus: React.ComponentProps<typeof StatusBadge>['status'] =
    sessionStatus === 'pairing' ||
    sessionStatus === 'syncing' ||
    sessionStatus === 'connected' ||
    sessionStatus === 'logged_out' ||
    sessionStatus === 'banned' ||
    sessionStatus === 'error' ||
    sessionStatus === 'pending'
      ? sessionStatus
      : 'pending';

  const [secondsLeft, setSecondsLeft] = React.useState<number>(
    Math.round(QR_LIFETIME_MS / 1000),
  );

  // 30s countdown for QR refresh affordance.
  React.useEffect(() => {
    if (mode !== 'qr') return;
    setSecondsLeft(Math.round(QR_LIFETIME_MS / 1000));
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [mode, qr]);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="flex items-center gap-2">
        <StatusBadge status={badgeStatus} />
        {stream.error ? (
          <span className="text-xs text-destructive">{stream.error}</span>
        ) : null}
      </div>

      {mode === 'qr' ? (
        <div className="flex flex-col items-center gap-3">
          <div
            aria-label="WhatsApp pairing QR code"
            className="relative rounded-2xl border bg-white p-4 shadow-sm"
            style={{ width: 296, height: 296 }}
          >
            {qr ? (
              <QRCode
                value={qr}
                size={264}
                level="M"
                style={{ height: 264, width: 264 }}
              />
            ) : (
              <div className="flex h-[264px] w-[264px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-1 shadow"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white">
                <Smartphone className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>QR refreshes in {secondsLeft}s</span>
            {onRefresh && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-7 gap-1.5 px-2"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh now</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl border bg-card px-6 py-5 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Your pairing code
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em]">
              {pairCode ? (
                pairCode.replace(/(.{4})/, '$1-').replace(/-$/, '')
              ) : (
                <Loader2 className="inline h-7 w-7 animate-spin text-muted-foreground" />
              )}
            </p>
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">
              Enter this 8-character code on your phone under{' '}
              <strong>Linked devices → Link with phone number</strong>.
            </p>
          </div>
        </div>
      )}

      {onModeChange ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-7"
          onClick={() => onModeChange(mode === 'qr' ? 'code' : 'qr')}
        >
          {mode === 'qr'
            ? 'Use pair code instead'
            : 'Use QR code instead'}
        </Button>
      ) : null}
    </div>
  );
}

export default PairingFlow;
