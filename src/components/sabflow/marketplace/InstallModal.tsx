'use client';

/**
 * SabFlow Marketplace — InstallModal
 *
 * Phase C.10 · sub-task #6 — one-click install UI.
 *
 * 3-step lifecycle:
 *   1. Preview  — Shows template metadata (node count, connection count,
 *                 description) with a Confirm Install button.
 *   2. Installing — Calls POST /api/sabflow/marketplace/templates/[id]/install.
 *   3. Success  — Shows "Open in Editor" deep-link once the flow is cloned.
 *   Error       — Inline error banner with a Retry button.
 *
 * Props intentionally omit `open` — callers mount/unmount the modal to
 * control visibility, which keeps local state clean on every re-open.
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  LuArrowUpRight,
  LuCheck,
  LuLoader,
  LuRefreshCw,
  LuSparkles,
  LuX,
  LuWorkflow,
  LuGitFork,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface InstallModalProps {
  /** MongoDB ObjectId string of the marketplace template to install. */
  templateId: string;
  /** Display name shown in the modal header. */
  templateName: string;
  /** Short description shown in the preview step. */
  description?: string;
  /** Flow node count for the preview — sourced from the template summary card. */
  nodeCount?: number;
  /** Flow edge/connection count for the preview. */
  connectionCount?: number;
  /** Called when the user clicks the X or Cancel button. */
  onClose: () => void;
  /**
   * Optional notification hook — called after a successful install with
   * the new `docId` and `editorUrl`. Navigation happens regardless.
   */
  onInstalled?: (docId: string, editorUrl: string) => void;
}

type Phase = 'preview' | 'installing' | 'success' | 'error';

interface SuccessPayload {
  docId: string;
  editorUrl: string;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function InstallModal({
  templateId,
  templateName,
  description,
  nodeCount,
  connectionCount,
  onClose,
  onInstalled,
}: InstallModalProps) {
  const [phase, setPhase] = useState<Phase>('preview');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessPayload | null>(null);

  const runInstall = useCallback(async () => {
    setPhase('installing');
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/sabflow/marketplace/templates/${encodeURIComponent(templateId)}/install`,
        { method: 'POST' },
      );

      let data: { docId?: string; editorUrl?: string; error?: string } | null = null;
      try {
        data = (await res.json()) as typeof data;
      } catch {
        /* empty body */
      }

      if (!res.ok) {
        const msg =
          (data && typeof data.error === 'string' ? data.error : null) ??
          `Install failed (HTTP ${res.status})`;
        setErrorMsg(msg);
        setPhase('error');
        return;
      }

      if (!data?.docId || !data?.editorUrl) {
        setErrorMsg('Unexpected response from server.');
        setPhase('error');
        return;
      }

      const payload: SuccessPayload = {
        docId: data.docId,
        editorUrl: data.editorUrl,
      };
      setSuccess(payload);
      setPhase('success');
      onInstalled?.(payload.docId, payload.editorUrl);
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Network error.');
      setPhase('error');
    }
  }, [templateId, onInstalled]);

  /* Node / connection display values */
  const nodeLabel = useMemo(() => {
    if (nodeCount == null) return null;
    return `${nodeCount} node${nodeCount === 1 ? '' : 's'}`;
  }, [nodeCount]);

  const connectionLabel = useMemo(() => {
    if (connectionCount == null) return null;
    return `${connectionCount} connection${connectionCount === 1 ? '' : 's'}`;
  }, [connectionCount]);

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Install ${templateName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <LuSparkles className="h-4 w-4 shrink-0 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Install template
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* ── Step 1: Preview ──────────────────────────────────────── */}
          {phase === 'preview' && (
            <div className="flex flex-col gap-4">
              {/* Template identity */}
              <div>
                <p className="text-base font-semibold text-zinc-100">
                  {templateName}
                </p>
                {description && (
                  <p className="mt-1 text-sm text-zinc-400">{description}</p>
                )}
              </div>

              {/* Flow stats */}
              {(nodeLabel ?? connectionLabel) && (
                <div className="flex flex-wrap gap-3">
                  {nodeLabel && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                      <LuWorkflow className="h-3.5 w-3.5 text-zinc-400" />
                      {nodeLabel}
                    </span>
                  )}
                  {connectionLabel && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                      <LuGitFork className="h-3.5 w-3.5 text-zinc-400" />
                      {connectionLabel}
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-zinc-500">
                This template will be cloned into your workspace as a new draft.
                You can review and modify it before activating.
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md px-3.5 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void runInstall()}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-900',
                    'transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60',
                  )}
                >
                  <LuSparkles className="h-3.5 w-3.5" />
                  Confirm install
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Installing ───────────────────────────────────── */}
          {phase === 'installing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <LuLoader className="h-6 w-6 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-400">
                Cloning template into your workspace&hellip;
              </p>
            </div>
          )}

          {/* ── Step 3: Success ──────────────────────────────────────── */}
          {phase === 'success' && success && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <LuCheck className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-100">
                  Template installed!
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Your new flow is ready in draft state.
                </p>
              </div>
              <Link
                href={success.editorUrl}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-900',
                  'transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60',
                )}
                onClick={onClose}
              >
                Open in Editor
                <LuArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* ── Error state ──────────────────────────────────────────── */}
          {phase === 'error' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {errorMsg ?? 'Install failed. Please try again.'}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md px-3.5 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void runInstall()}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-sm font-medium text-zinc-200',
                    'transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60',
                  )}
                >
                  <LuRefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InstallModal;
