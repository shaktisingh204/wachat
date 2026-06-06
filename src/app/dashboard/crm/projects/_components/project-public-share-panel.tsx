'use client';

/**
 * Project public-share panel.
 *
 * Surfaces three toggles on the project detail page:
 *   • Public Gantt link      — toggles `public_gantt_chart`, hash on
 *     `publicHash`.
 *   • Public Taskboard link  — toggles `public_taskboard`, hash on
 *     `publicHash` (shared with Gantt).
 *   • Public Rating link     — always-on once generated, hash on the
 *     separate `publicRatingHash` field so admins can share feedback
 *     links without exposing the project board.
 *
 * All mutations route through `toggleWsProjectShare`. The rating hash
 * is auto-generated on first mount via `ensureWsProjectRatingHash`.
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Copy, Check, ExternalLink, Share2 } from 'lucide-react';
import {
  Button,
  Card,
  Switch,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  ensureWsProjectRatingHash,
  getWsProjectShareState,
  toggleWsProjectShare,
  type WsProjectShareKind,
  type WsProjectShareState,
} from '@/app/actions/worksuite/projects.actions';

type Props = { projectId: string };

function safeOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function ProjectPublicSharePanel({ projectId }: Props): React.ReactElement {
  const { toast } = useZoruToast();
  const [state, setState] = useState<WsProjectShareState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingKind, setPendingKind] = useState<WsProjectShareKind | null>(
    null,
  );
  const [, startTransition] = useTransition();

  const refresh = useCallback(async (): Promise<void> => {
    const res = await getWsProjectShareState(projectId);
    if ('error' in res) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    setState(res);
  }, [projectId, toast]);

  // Initial load — and auto-generate the rating hash if it's missing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getWsProjectShareState(projectId);
      if (cancelled) return;
      if ('error' in res) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      if (!res.publicRatingHash) {
        const ensured = await ensureWsProjectRatingHash(projectId);
        if (!cancelled && ensured.success) {
          const refreshed = await getWsProjectShareState(projectId);
          if (!cancelled && !('error' in refreshed)) {
            setState(refreshed);
          }
        } else if (!cancelled) {
          setState(res);
        }
      } else if (!cancelled) {
        setState(res);
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  const onToggle = (kind: WsProjectShareKind, next: boolean): void => {
    setPendingKind(kind);
    startTransition(async () => {
      const res = await toggleWsProjectShare(projectId, kind, next);
      if (!res.success) {
        toast({
          title: 'Error',
          description: res.error || 'Failed to update share setting',
          variant: 'destructive',
        });
      } else if (res.state) {
        setState(res.state);
      } else {
        void refresh();
      }
      setPendingKind(null);
    });
  };

  const origin = safeOrigin();
  const ganttUrl = state?.publicHash
    ? `${origin}/share/gantt/${state.publicHash}`
    : '';
  const taskboardUrl = state?.publicHash
    ? `${origin}/share/taskboard/${state.publicHash}`
    : '';
  const ratingUrl = state?.publicRatingHash
    ? `${origin}/share/project-rating/${state.publicRatingHash}`
    : '';

  return (
    <Card className="p-6">
      <header className="mb-4 flex items-center gap-2">
        <Share2 className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--st-text)]">
            Public share
          </h2>
          <p className="text-[12px] text-[var(--st-text-secondary)]">
            Generate hash-signed links to share read-only views with people
            who don&apos;t have a SabNode account.
          </p>
        </div>
      </header>

      {isLoading || !state ? (
        <p className="text-[13px] text-[var(--st-text-secondary)]">Loading share state…</p>
      ) : (
        <div className="space-y-3">
          <ShareRow
            title="Public Gantt"
            description="Read-only timeline of tasks, dependencies, and milestones."
            enabled={state.public_gantt_chart}
            disabled={pendingKind === 'gantt'}
            onToggle={(v) => onToggle('gantt', v)}
            url={state.public_gantt_chart ? ganttUrl : ''}
          />
          <ShareRow
            title="Public Taskboard"
            description="Read-only Kanban board view of tasks by column."
            enabled={state.public_taskboard}
            disabled={pendingKind === 'taskboard'}
            onToggle={(v) => onToggle('taskboard', v)}
            url={state.public_taskboard ? taskboardUrl : ''}
          />
          <ShareRow
            title="Public Rating"
            description="One-shot feedback form for the client (5-star + categories)."
            enabled
            alwaysOn
            url={ratingUrl}
          />
        </div>
      )}
    </Card>
  );
}

/* ─── Row ─────────────────────────────────────────────────────── */

function ShareRow({
  title,
  description,
  enabled,
  alwaysOn,
  disabled,
  onToggle,
  url,
}: {
  title: string;
  description: string;
  enabled: boolean;
  alwaysOn?: boolean;
  disabled?: boolean;
  onToggle?: (next: boolean) => void;
  url: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-[var(--st-border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--st-text)]">{title}</p>
          <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
            {description}
          </p>
        </div>
        {alwaysOn ? (
          <span className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            Always on
          </span>
        ) : (
          <Switch
            checked={enabled}
            disabled={disabled}
            onCheckedChange={(v) => onToggle?.(Boolean(v))}
            aria-label={`Toggle ${title}`}
          />
        )}
      </div>
      {enabled && url ? <CopyLink url={url} /> : null}
    </div>
  );
}

/* ─── Copyable URL ────────────────────────────────────────────── */

function CopyLink({ url }: { url: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const { toast } = useZoruToast();

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Please copy the URL manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1.5">
      <code className="min-w-0 flex-1 truncate text-[12px] text-[var(--st-text)]">
        {url}
      </code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onCopy}
        aria-label="Copy link"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[var(--st-text)]" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
        aria-label="Open link in new tab"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
