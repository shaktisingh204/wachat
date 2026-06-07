'use client';

/**
 * SabFlow Marketplace - upgrade diff modal.
 *
 * Phase C.10.7 - Template versioning + upgrade diff.
 *
 * Displays the computed diff between two marketplace template versions and
 * lets the user apply the upgrade (which installs the newer version as a
 * fresh doc - it does NOT overwrite the existing flow).
 *
 * Props:
 *   - `templateId`   - marketplace template id (used in API calls)
 *   - `installedDocId` - the existing SabFlow doc id (sent to the upgrade API
 *                        so it can stamp the lineage on the new doc)
 *   - `fromVersion`  - currently installed version string, e.g. `"1.0.0"`
 *   - `toVersion`    - target version string, e.g. `"1.1.0"`
 *   - `onClose`      - close callback
 *
 * Data flow:
 *   1. On mount, fetches `GET /api/sabflow/marketplace/templates/[id]/diff?from=...&to=...`.
 *   2. Renders added/removed/changed nodes with tone-coded badges.
 *   3. "Apply Upgrade" posts to `POST /api/sabflow/marketplace/templates/[id]/upgrade`
 *      and navigates to the new flow's editor URL on success.
 */

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Check,
  Loader,
  Minus,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/sabcrm/20ui';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface UpgradeDiffModalProps {
  templateId: string;
  installedDocId: string;
  fromVersion: string;
  toVersion: string;
  onClose: () => void;
  /**
   * Optional callback fired after a successful upgrade with the new flow id
   * and the editor deep-link. The default behaviour (navigate to `editorUrl`)
   * runs regardless.
   */
  onUpgraded?: (newFlowId: string, editorUrl: string) => void;
}

interface DiffData {
  addedNodes: string[];
  removedNodes: string[];
  changedNodes: string[];
  addedConnections: number;
  removedConnections: number;
}

type FetchState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; diff: DiffData };

type UpgradeState =
  | { phase: 'idle' }
  | { phase: 'upgrading' }
  | { phase: 'done'; newFlowId: string; editorUrl: string }
  | { phase: 'error'; message: string };

/* ── Component ───────────────────────────────────────────────────────────── */

export function UpgradeDiffModal({
  templateId,
  installedDocId,
  fromVersion,
  toVersion,
  onClose,
  onUpgraded,
}: UpgradeDiffModalProps) {
  const router = useRouter();
  const [fetchState, setFetchState] = useState<FetchState>({ phase: 'idle' });
  const [upgradeState, setUpgradeState] = useState<UpgradeState>({ phase: 'idle' });

  /* ── Fetch diff on mount ─────────────────────────────────────────────── */
  const fetchDiff = useCallback(async () => {
    setFetchState({ phase: 'loading' });
    try {
      const params = new URLSearchParams({ from: fromVersion, to: toVersion });
      const res = await fetch(
        `/api/sabflow/marketplace/templates/${encodeURIComponent(templateId)}/diff?${params.toString()}`,
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setFetchState({
          phase: 'error',
          message: body.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const data = (await res.json()) as DiffData;
      setFetchState({ phase: 'ready', diff: data });
    } catch (err) {
      setFetchState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  }, [templateId, fromVersion, toVersion]);

  useEffect(() => {
    void fetchDiff();
  }, [fetchDiff]);

  /* ── Apply upgrade ───────────────────────────────────────────────────── */
  const handleUpgrade = useCallback(async () => {
    setUpgradeState({ phase: 'upgrading' });
    try {
      const res = await fetch(
        `/api/sabflow/marketplace/templates/${encodeURIComponent(templateId)}/upgrade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            installedDocId,
            fromVersion,
            toVersion,
          }),
        },
      );
      const body = (await res.json()) as {
        newFlowId?: string;
        editorUrl?: string;
        error?: string;
      };
      if (!res.ok || !body.newFlowId || !body.editorUrl) {
        setUpgradeState({
          phase: 'error',
          message: body.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setUpgradeState({
        phase: 'done',
        newFlowId: body.newFlowId,
        editorUrl: body.editorUrl,
      });
      onUpgraded?.(body.newFlowId, body.editorUrl);
      // Brief pause so the user sees the success state before navigation.
      setTimeout(() => {
        router.push(body.editorUrl!);
      }, 800);
    } catch (err) {
      setUpgradeState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  }, [templateId, installedDocId, fromVersion, toVersion, onUpgraded, router]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  const isUpgrading = upgradeState.phase === 'upgrading';
  const isDone = upgradeState.phase === 'done';

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            Upgrade template
          </DialogTitle>
          <DialogDescription>
            Changes from version{' '}
            <span className="font-mono text-xs">{fromVersion}</span>
            {' '}to{' '}
            <span className="font-mono text-xs">{toVersion}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Loading */}
          {fetchState.phase === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
              <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
              Computing diff...
            </div>
          )}

          {/* Error fetching diff */}
          {fetchState.phase === 'error' && (
            <Alert tone="danger" title="Could not compute diff">
              {fetchState.message}
            </Alert>
          )}

          {/* Diff ready */}
          {fetchState.phase === 'ready' && (
            <DiffSummary diff={fetchState.diff} />
          )}

          {/* Upgrade error */}
          {upgradeState.phase === 'error' && (
            <Alert tone="danger" title="Upgrade failed">
              {upgradeState.message}
            </Alert>
          )}

          {/* Upgrade done */}
          {isDone && (
            <Alert tone="success" title="Upgrade applied" icon={Check}>
              Opening the new flow...
            </Alert>
          )}
        </div>

        {/* Actions */}
        <DialogFooter className="mt-6">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isUpgrading || isDone} iconLeft={X}>
            Cancel
          </Button>
          {fetchState.phase === 'error' && (
            <Button variant="outline" size="sm" onClick={() => void fetchDiff()} iconLeft={RefreshCw}>
              Retry diff
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleUpgrade()}
            loading={isUpgrading}
            iconLeft={isDone ? Check : ArrowUpRight}
            disabled={fetchState.phase !== 'ready' || isUpgrading || isDone}
          >
            {isUpgrading ? 'Upgrading...' : isDone ? 'Done' : 'Apply Upgrade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── DiffSummary sub-component ───────────────────────────────────────────── */

function DiffSummary({ diff }: { diff: DiffData }) {
  const hasDiff =
    diff.addedNodes.length > 0 ||
    diff.removedNodes.length > 0 ||
    diff.changedNodes.length > 0 ||
    diff.addedConnections > 0 ||
    diff.removedConnections > 0;

  if (!hasDiff) {
    return (
      <p className="text-sm text-[var(--st-text-secondary)]">
        No structural changes between these two versions.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <NodeList
        label="Added nodes"
        items={diff.addedNodes}
        icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
        tone="success"
      />
      <NodeList
        label="Removed nodes"
        items={diff.removedNodes}
        icon={<Minus className="h-3.5 w-3.5" aria-hidden="true" />}
        tone="danger"
      />
      <NodeList
        label="Changed nodes"
        items={diff.changedNodes}
        icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
        tone="warning"
      />

      {(diff.addedConnections > 0 || diff.removedConnections > 0) && (
        <ConnectionDelta
          added={diff.addedConnections}
          removed={diff.removedConnections}
        />
      )}
    </div>
  );
}

function NodeList({
  label,
  items,
  icon,
  tone,
}: {
  label: string;
  items: string[];
  icon: React.ReactNode;
  tone: 'success' | 'danger' | 'warning';
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label} ({items.length})
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item}>
            <Badge tone={tone} kind="soft" className="w-full justify-start font-mono">
              {icon}
              {item}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConnectionDelta({
  added,
  removed,
}: {
  added: number;
  removed: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {added > 0 && (
        <Badge tone="success" kind="soft">
          <Plus className="h-3 w-3" aria-hidden="true" />
          {added} connection{added !== 1 ? 's' : ''} added
        </Badge>
      )}
      {removed > 0 && (
        <Badge tone="danger" kind="soft">
          <Minus className="h-3 w-3" aria-hidden="true" />
          {removed} connection{removed !== 1 ? 's' : ''} removed
        </Badge>
      )}
    </div>
  );
}
