'use client';

/**
 * SabFlow Marketplace - InstallModal
 *
 * Phase C.10, sub-task #6 - one-click install UI.
 *
 * 3-step lifecycle:
 *   1. Preview  - Shows template metadata (node count, connection count,
 *                 description) with a Confirm Install button.
 *   2. Installing - Calls POST /api/sabflow/marketplace/templates/[id]/install.
 *   3. Success  - Shows "Open in Editor" deep-link once the flow is cloned.
 *   Error       - Inline error banner with a Retry button.
 *
 * Props intentionally omit `open` - callers mount/unmount the modal to
 * control visibility, which keeps local state clean on every re-open.
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Check,
  RefreshCw,
  Sparkles,
  Workflow,
  GitFork,
} from 'lucide-react';

import {
  Modal,
  Button,
  Badge,
  Alert,
  EmptyState,
  Spinner,
} from '@/components/sabcrm/20ui';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface InstallModalProps {
  /** MongoDB ObjectId string of the marketplace template to install. */
  templateId: string;
  /** Display name shown in the modal header. */
  templateName: string;
  /** Short description shown in the preview step. */
  description?: string;
  /** Flow node count for the preview - sourced from the template summary card. */
  nodeCount?: number;
  /** Flow edge/connection count for the preview. */
  connectionCount?: number;
  /** Called when the user clicks the X or Cancel button. */
  onClose: () => void;
  /**
   * Optional notification hook - called after a successful install with
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
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('preview');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessPayload | null>(null);

  const openInEditor = useCallback(() => {
    if (!success) return;
    onClose();
    router.push(success.editorUrl);
  }, [success, onClose, router]);

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
        data = (await res.json()) as any;
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

  /* Footer actions are phase-specific; the body changes with the phase too. */
  const footer = useMemo(() => {
    if (phase === 'preview') {
      return (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" iconLeft={Sparkles} onClick={() => void runInstall()}>
            Confirm install
          </Button>
        </div>
      );
    }
    if (phase === 'error') {
      return (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" iconLeft={RefreshCw} onClick={() => void runInstall()}>
            Retry
          </Button>
        </div>
      );
    }
    return undefined;
  }, [phase, onClose, runInstall]);

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <Modal
      open
      onClose={onClose}
      title="Install template"
      size="sm"
      footer={footer}
    >
      {/* ── Step 1: Preview ──────────────────────────────────────── */}
      {phase === 'preview' && (
        <div className="flex flex-col gap-4">
          {/* Template identity */}
          <div>
            <p className="text-base font-semibold text-[var(--st-text)]">
              {templateName}
            </p>
            {description && (
              <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
                {description}
              </p>
            )}
          </div>

          {/* Flow stats */}
          {(nodeLabel ?? connectionLabel) && (
            <div className="flex flex-wrap gap-2">
              {nodeLabel && (
                <Badge tone="neutral" kind="outline">
                  <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
                  {nodeLabel}
                </Badge>
              )}
              {connectionLabel && (
                <Badge tone="neutral" kind="outline">
                  <GitFork className="h-3.5 w-3.5" aria-hidden="true" />
                  {connectionLabel}
                </Badge>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--st-text-tertiary)]">
            This template will be cloned into your workspace as a new draft. You
            can review and modify it before activating.
          </p>
        </div>
      )}

      {/* ── Step 2: Installing ───────────────────────────────────── */}
      {phase === 'installing' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner size="lg" label="Installing template" />
          <p className="text-sm text-[var(--st-text-secondary)]">
            Cloning template into your workspace...
          </p>
        </div>
      )}

      {/* ── Step 3: Success ──────────────────────────────────────── */}
      {phase === 'success' && success && (
        <EmptyState
          icon={Check}
          tone="success"
          title="Template installed"
          description="Your new flow is ready in draft state."
          action={
            <Button variant="primary" iconRight={ArrowUpRight} onClick={openInEditor}>
              Open in Editor
            </Button>
          }
        />
      )}

      {/* ── Error state ──────────────────────────────────────────── */}
      {phase === 'error' && (
        <Alert tone="danger" title="Install failed">
          {errorMsg ?? 'Install failed. Please try again.'}
        </Alert>
      )}
    </Modal>
  );
}

export default InstallModal;
