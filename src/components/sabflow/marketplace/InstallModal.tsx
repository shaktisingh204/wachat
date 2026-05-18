'use client';

import { ZoruButton, ZoruDialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogDescription } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuArrowUpRight,
  LuCheck,
  LuKey,
  LuLoader,
  LuRefreshCw,
  LuX,
  LuSparkles,
  } from 'react-icons/lu';

import {
  CREDENTIAL_TYPE_LABEL,
  type CredentialType,
  } from '@/lib/sabflow/credentials/types';

/**
 * SabFlow Marketplace — install modal.
 *
 * Phase C.10 · sub-task #6 — UI for credential prompts.
 *
 * Lifecycle:
 *   1. The card click opens the modal in `idle` state and immediately POSTs
 *      `{ templateSlug }` to `/api/sabflow/marketplace/install`.
 *   2. If the server replies `status: 'ok'`, we navigate to `editorUrl`
 *      (modal stays mounted while the route transition runs).
 *   3. If the server replies `status: 'needs_credentials'`, we render the
 *      checklist of missing credential types. Each row links the user to
 *      `/dashboard/sabflow/connections?new=<type>` in a new tab so they
 *      can add the credential without losing this modal's state.
 *   4. The "Retry install" button re-runs step 1 once the user has added
 *      the missing credentials — when the new check passes, install
 *      proceeds and we navigate.
 *
 * Reuses the existing `CREDENTIAL_TYPE_LABEL` map so credential prompts
 * render with the same display names users already see in the Connections
 * page.
 */

import * as React from 'react';

import { cn } from '@/lib/utils';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface InstallModalProps {
  /** Slug of the marketplace template to install. */
  templateSlug: string;
  /** Display name for the header. */
  templateName: string;
  /** Whether the modal is currently visible. */
  open: boolean;
  /** Close-handler invoked on overlay click / Escape / close button. */
  onClose: () => void;
  /**
   * Called after a successful install with the new flow id. The default
   * behaviour (navigate to `editorUrl`) runs regardless — this is a
   * notification hook so parent pages can refresh their flow list.
   */
  onInstalled?: (flowId: string, editorUrl: string) => void;
}

/* ── Response shapes ──────────────────────────────────────────────────── */

type ApiResponse =
  | {
      status: 'ok';
      flowId: string;
      editorUrl: string;
      installCount: number | null;
    }
  | {
      status: 'needs_credentials';
      templateSlug: string;
      required: CredentialType[];
      missing: CredentialType[];
    }
  | { error: string };

type Phase = 'idle' | 'installing' | 'needs_credentials' | 'ok' | 'error';

/* ── Component ────────────────────────────────────────────────────────── */

export function InstallModal({
  templateSlug,
  templateName,
  open,
  onClose,
  onInstalled,
}: InstallModalProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [missing, setMissing] = useState<CredentialType[]>([]);
  const [required, setRequired] = useState<CredentialType[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** POST to the install endpoint and route on the discriminated response. */
  const runInstall = useCallback(async () => {
    setPhase('installing');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/sabflow/marketplace/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateSlug }),
      });

      let data: ApiResponse | null = null;
      try {
        data = (await res.json()) as ApiResponse;
      } catch {
        /* fall through */
      }

      if (!res.ok) {
        if (data && 'status' in data && data.status === 'needs_credentials') {
          // 200 with `needs_credentials` is handled in the success branch
          // below — landing here means the server returned a real error.
        }
        const msg = (data && 'error' in data ? data.error : null) ?? `Install failed (HTTP ${res.status})`;
        setErrorMsg(msg);
        setPhase('error');
        return;
      }

      if (!data) {
        setErrorMsg('Empty response from server');
        setPhase('error');
        return;
      }

      if ('status' in data && data.status === 'needs_credentials') {
        setMissing(data.missing ?? []);
        setRequired(data.required ?? []);
        setPhase('needs_credentials');
        return;
      }

      if ('status' in data && data.status === 'ok') {
        setPhase('ok');
        onInstalled?.(data.flowId, data.editorUrl);
        // Modal stays mounted while the route transition runs so the user
        // sees the "Opening editor…" affordance instead of a flash of empty
        // background.
        router.push(data.editorUrl);
        return;
      }

      setErrorMsg('Unexpected response from server');
      setPhase('error');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setPhase('error');
    }
  }, [templateSlug, router, onInstalled]);

  /* Kick off the install the moment the modal opens. */
  useEffect(() => {
    if (open && phase === 'idle') {
      void runInstall();
    }
    if (!open) {
      // Reset to idle so the next open() re-fires runInstall.
      setPhase('idle');
      setMissing([]);
      setRequired([]);
      setErrorMsg(null);
    }
  }, [open, phase, runInstall]);

  const credentialsReady = useMemo(
    () => required.length > 0 && missing.length === 0,
    [required.length, missing.length],
  );

  /* Build a deep link to the new-credential page for a given type. */
  const credentialDeepLink = (type: CredentialType): string =>
    `/dashboard/sabflow/connections?new=${encodeURIComponent(type)}`;

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <ZoruDialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <ZoruDialogContent className="max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="flex items-center gap-2">
            <LuSparkles className="h-4 w-4 text-amber-400" />
            Install template
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            <span className="font-medium text-zoru-ink">{templateName}</span>{' '}
            will be cloned into your workspace as a new draft.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        {phase === 'installing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <LuLoader className="h-6 w-6 animate-spin text-zoru-ink-muted" />
            <p className="text-sm text-zoru-ink-muted">
              Checking credentials and cloning the template…
            </p>
          </div>
        )}

        {phase === 'ok' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <LuCheck className="h-5 w-5" />
            </div>
            <p className="text-sm text-zoru-ink-muted">Opening the editor…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {errorMsg ?? 'Install failed'}
            </div>
            <div className="flex justify-end gap-2">
              <ZoruButton variant="outline" onClick={onClose}>
                Close
              </ZoruButton>
              <ZoruButton onClick={() => void runInstall()}>
                <LuRefreshCw className="h-4 w-4" />
                Retry
              </ZoruButton>
            </div>
          </div>
        )}

        {phase === 'needs_credentials' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              This template needs {missing.length} credential
              {missing.length === 1 ? '' : 's'} you haven&apos;t set up yet.
              Add each one below, then click <strong>Retry install</strong>.
            </div>

            <ul className="flex flex-col gap-2" role="list">
              {required.map((type) => {
                const isMissing = missing.includes(type);
                return (
                  <li
                    key={type}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
                      isMissing
                        ? 'border-zoru-line bg-zoru-bg'
                        : 'border-emerald-500/30 bg-emerald-500/5',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-md',
                          isMissing
                            ? 'bg-zoru-surface-2 text-zoru-ink-muted'
                            : 'bg-emerald-500/15 text-emerald-400',
                        )}
                      >
                        {isMissing ? (
                          <LuKey className="h-3.5 w-3.5" />
                        ) : (
                          <LuCheck className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zoru-ink truncate">
                          {CREDENTIAL_TYPE_LABEL[type] ?? type}
                        </p>
                        <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
                          {isMissing ? 'Not connected' : 'Ready'}
                        </p>
                      </div>
                    </div>
                    {isMissing && (
                      <a
                        href={credentialDeepLink(type)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zoru-line bg-zoru-bg px-2.5 py-1 text-xs font-medium text-zoru-ink hover:bg-zoru-surface-2 hover:border-zoru-line-strong transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary/40',
                        )}
                      >
                        Add credential
                        <LuArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-xs text-zoru-ink-muted hover:text-zoru-ink transition-colors"
              >
                <LuX className="h-3 w-3" />
                Cancel
              </button>
              <ZoruButton
                onClick={() => void runInstall()}
                disabled={!credentialsReady && missing.length > 0}
              >
                <LuRefreshCw className="h-4 w-4" />
                Retry install
              </ZoruButton>
            </div>
          </div>
        )}
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

export default InstallModal;
