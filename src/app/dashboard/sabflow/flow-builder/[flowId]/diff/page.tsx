"use client";

import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, EmptyState } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState } from "react";
import Link from "next/link";
import { useParams,
  useRouter,
  useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RotateCcw,
  X,
  } from "lucide-react";

/**
 * SabFlow — flow version diff page.
 *
 * /dashboard/sabflow/flow-builder/[flowId]/diff?from={versionId}&to={versionId|current}
 *
 * Fetches both snapshots client-side and renders the shared `FlowDiffView`
 * (composite, untouched). Provides "Restore from left" and "Restore from
 * right" actions which call the existing
 * `/api/sabflow/[flowId]/versions/[versionId]/restore` route.
 *
 * Ui20 rewrite — chrome only. The `FlowDiffView` composite is opaque.
 */

import type { SabFlowDoc } from "@/lib/sabflow/types";
import { FlowDiffView } from "@/components/sabflow/diff/FlowDiffView";
import { getSabFlow } from "@/app/actions/sabflow";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface VersionApiResponse {
  version: {
    _id: string;
    flowId: string;
    label: string;
    savedAt: string;
    snapshot: SabFlowDoc;
    userId: string;
  };
}

interface LoadedSnapshot {
  /** Display label — e.g. "Current", "Draft — 3h ago". */
  label: string;
  /** Version id, or `null` for the current live flow. */
  versionId: string | null;
  /** Flow document itself (always present when loaded). */
  flow: SabFlowDoc;
}

interface LoadState {
  before: LoadedSnapshot | null;
  after: LoadedSnapshot | null;
  isLoading: boolean;
  error: string | null;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function fetchFlow(flowId: string): Promise<SabFlowDoc> {
  const result = (await getSabFlow(flowId)) as
    | (SabFlowDoc & { _id: string })
    | null;
  if (!result) {
    throw new Error("Flow not found or not accessible.");
  }
  return result;
}

async function fetchVersion(
  flowId: string,
  versionId: string,
): Promise<VersionApiResponse["version"]> {
  const res = await fetch(`/api/sabflow/${flowId}/versions/${versionId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load version (${res.status})`);
  }
  const data = (await res.json()) as VersionApiResponse;
  return data.version;
}

function relativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

async function loadSide(
  flowId: string,
  token: string,
): Promise<LoadedSnapshot> {
  if (token === "current") {
    const flow = await fetchFlow(flowId);
    return { label: "Current", versionId: null, flow };
  }
  const version = await fetchVersion(flowId, token);
  const savedAt = new Date(version.savedAt);
  const label = `${version.label} · ${relativeTime(savedAt)}`;
  return { label, versionId: version._id, flow: version.snapshot };
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function FlowDiffPage() {
  const router = useRouter();
  const params = useParams<{ flowId: string }>();
  const searchParams = useSearchParams();
  const flowId = params.flowId;

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const [state, setState] = useState<LoadState>({
    before: null,
    after: null,
    isLoading: true,
    error: null,
  });

  // Restore workflow state
  const [confirming, setConfirming] = useState<null | "before" | "after">(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  /* ── Load snapshots ─────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!fromParam || !toParam) {
        setState({
          before: null,
          after: null,
          isLoading: false,
          error:
            "Missing query parameters. Expected ?from={versionId}&to={versionId|current}.",
        });
        return;
      }

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const [beforeRes, afterRes] = await Promise.all([
          loadSide(flowId, fromParam),
          loadSide(flowId, toParam),
        ]);

        if (cancelled) return;

        setState({
          before: beforeRes,
          after: afterRes,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          before: null,
          after: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load versions",
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [flowId, fromParam, toParam]);

  /* ── Restore handler ────────────────────────────────────── */

  const handleRestore = useCallback(async () => {
    if (!confirming) return;
    const side = confirming === "before" ? state.before : state.after;
    if (!side) return;

    if (side.versionId === null) {
      setConfirming(null);
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    try {
      const res = await fetch(
        `/api/sabflow/${flowId}/versions/${side.versionId}/restore`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to restore version");
      }
      setConfirming(null);
      router.push(`/dashboard/sabflow/flow-builder/${flowId}`);
      router.refresh();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setIsRestoring(false);
    }
  }, [confirming, state.before, state.after, flowId, router]);

  const pendingLabel = useMemo(() => {
    if (!confirming) return "";
    const side = confirming === "before" ? state.before : state.after;
    return side?.label ?? "";
  }, [confirming, state.before, state.after]);

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex min-h-screen flex-col bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]/90 px-4 py-3 backdrop-blur-md">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link
            href={`/dashboard/sabflow/flow-builder/${flowId}`}
            aria-label="Back to flow editor"
          >
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--st-text)]">
            Compare flow versions
          </p>
          <p className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
            {state.before?.label ?? "…"}
            {" → "}
            {state.after?.label ?? "…"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirming("before")}
            disabled={
              !state.before || state.before.versionId === null || state.isLoading
            }
            title="Replace current flow with the left-hand version"
          >
            <RotateCcw />
            Restore from left
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirming("after")}
            disabled={
              !state.after || state.after.versionId === null || state.isLoading
            }
            title="Replace current flow with the right-hand version"
          >
            <RotateCcw />
            Restore from right
          </Button>
        </div>
      </header>

      {/* ── Restore error banner ───────────────────────────── */}
      {restoreError && (
        <div className="mx-4 mt-3">
          <Alert variant="destructive" className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <AlertDescription className="flex-1 truncate">
              {restoreError}
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setRestoreError(null)}
              aria-label="Dismiss error"
            >
              <X />
            </Button>
          </Alert>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────── */}
      <main className="flex-1 p-4">
        {state.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
          </div>
        ) : state.error ? (
          <div className="mx-auto max-w-md">
            <EmptyState
              icon={<AlertTriangle />}
              title="Could not load diff"
              description={state.error}
            />
          </div>
        ) : state.before && state.after ? (
          <div className="mx-auto max-w-6xl">
            <FlowDiffView
              before={state.before.flow}
              after={state.after.flow}
              beforeLabel={state.before.label}
              afterLabel={state.after.label}
            />
          </div>
        ) : null}
      </main>

      {/* ── Restore confirmation ───────────────────────────── */}
      <AlertDialog
        open={!!confirming}
        onOpenChange={(open) => {
          if (!open && !isRestoring) setConfirming(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              Restoring{" "}
              <strong className="font-medium text-[var(--st-text)]">
                &ldquo;{pendingLabel}&rdquo;
              </strong>{" "}
              will overwrite your current flow. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRestoring}
              onClick={() => void handleRestore()}
            >
              {isRestoring ? (
                <>
                  <Loader2 className="animate-spin" />
                  Restoring…
                </>
              ) : (
                <>
                  <RotateCcw />
                  Yes, restore
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
