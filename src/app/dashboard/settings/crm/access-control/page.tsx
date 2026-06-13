'use client';

/**
 * SabCRM — Access control / permission ENFORCEMENT settings
 * (`/dashboard/settings/crm/access-control`).
 *
 * A single, deliberately SCARY, DEFAULT-OFF toggle that turns on data-layer
 * permission enforcement (OWD + role-hierarchy + sharing/territory) for the
 * project's records. While off, every read behaves EXACTLY as today — this is
 * the hard safety contract.
 *
 * Before the toggle, the page renders:
 *   - a prominent "enable only after a security review" warning, and
 *   - a DRY-RUN preview that counts how many records the CURRENT user would
 *     lose access to if enforcement were turned on right now (per-object).
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; both actions
 * independently re-run the full gate (read=view, toggle=edit). Degrades to
 * loading / error and never crashes when the engine is unreachable.
 */

import * as React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  RefreshCw,
  Server,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  Switch,
  Badge,
  Alert,
  Button,
  Skeleton,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  useToast,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import { useProject } from '@/context/project-context';
import {
  getAccessFlagTw,
  setAccessFlagTw,
  type AccessFlagView,
} from '@/app/actions/sabcrm-access.actions';

function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AccessControlSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [view, setView] = React.useState<AccessFlagView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmEnable, setConfirmEnable] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError(null);
    const res = await getAccessFlagTw(activeProjectId);
    if (res.ok) setView(res.data);
    else setError(res.error);
    setLoading(false);
  }, [activeProjectId]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!activeProjectId) return;
      const res = await getAccessFlagTw(activeProjectId);
      if (!alive) return;
      if (res.ok) setView(res.data);
      else setError(res.error);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  const enabled = view?.flag.enabled === true;
  const dry = view?.dryRun;

  async function applyToggle(next: boolean): Promise<void> {
    if (!activeProjectId) return;
    setSaving(true);
    const res = await setAccessFlagTw(next, activeProjectId);
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not update', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: next ? 'Enforcement ENABLED' : 'Enforcement disabled',
      description: next
        ? 'Reads are now filtered by the access compiler on the native path.'
        : 'Reads behave exactly as before.',
      tone: next ? 'success' : 'neutral',
    });
    await load();
  }

  /** Turning ON is the dangerous direction → always confirm. Off is immediate. */
  function onToggle(next: boolean): void {
    if (next) setConfirmEnable(true);
    else void applyToggle(false);
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Access control (enforcement)</PageTitle>
          <PageDescription>
            Enforce org-wide defaults, role hierarchy and sharing at the data
            layer. Off by default — while off, every read behaves exactly as it
            does today.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* The scary warning — always visible. */}
      <Alert tone="warning" className="mb-[var(--st-space-4)]">
        <span className="flex items-start gap-[var(--st-space-2)]">
          {renderIcon(TriangleAlert, { size: 18 })}
          <span>
            <strong>Enable only after a security review on a running app.</strong>{' '}
            Turning this on starts hiding records from users at the data layer.
            Verify the dry-run below, confirm role hierarchy + org-wide defaults
            are correct, and remember this only covers the native read path — the
            Rust read path needs a parallel change before this is a hard
            boundary.
          </span>
        </span>
      </Alert>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[1fr_1fr]">
        {/* LEFT — the toggle */}
        <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-5)]">
          <div className="flex items-start justify-between gap-[var(--st-space-3)]">
            <div className="flex items-start gap-[var(--st-space-3)]">
              {renderIcon(enabled ? ShieldCheck : ShieldAlert, {
                size: 22,
                style: {
                  color: enabled
                    ? 'var(--st-success, #16a34a)'
                    : 'var(--st-text-secondary)',
                },
              })}
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold text-[var(--st-text)]">
                  Permission enforcement
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  AND-in the access compiler on every native record read.
                </span>
              </div>
            </div>
            <Badge tone={enabled ? 'success' : 'neutral'} kind="soft">
              {enabled ? 'On' : 'Off'}
            </Badge>
          </div>

          {loading || isLoadingProject ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <div className="flex items-center gap-[var(--st-space-3)]">
              <Switch
                checked={enabled}
                disabled={saving || !activeProjectId}
                aria-label="Enable permission enforcement"
                onCheckedChange={onToggle}
              />
              <span className="text-[13px] text-[var(--st-text)]">
                {enabled
                  ? 'Enforcement is ON — records are filtered by the access compiler.'
                  : 'Enforcement is OFF — reads are unchanged from today.'}
              </span>
            </div>
          )}

          {view?.flag.updatedAt && (
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              Last changed {fmtDate(view.flag.updatedAt)}
              {view.flag.updatedBy ? ` · by ${view.flag.updatedBy}` : ''}
            </span>
          )}

          <Alert tone="info">
            <span className="flex items-start gap-[var(--st-space-2)]">
              {renderIcon(Server, { size: 16 })}
              <span className="text-[12px]">
                <strong>Two-store note:</strong> this flag gates the native-TS
                read path (`records.server`). The Rust read path is NOT covered —
                a parallel change there is required for enforcement to be
                complete.
              </span>
            </span>
          </Alert>
        </Card>

        {/* RIGHT — dry-run preview */}
        <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-5)]">
          <div className="flex items-center justify-between gap-[var(--st-space-2)]">
            <span className="text-[14px] font-semibold text-[var(--st-text)]">
              Dry run — what you would lose
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={RefreshCw}
              onClick={() => void load()}
              disabled={loading || saving}
            >
              Refresh
            </Button>
          </div>

          {loading || isLoadingProject ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : !dry ? (
            <span className="text-[13px] text-[var(--st-text-secondary)]">
              No preview available.
            </span>
          ) : dry.elevated ? (
            <Alert tone="success">
              You are an owner / admin — enforcement never restricts you. You
              would keep access to all {dry.totalVisibleToday} records.
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-[var(--st-space-2)]">
                <Stat label="Visible today" value={dry.totalVisibleToday} />
                <Stat label="If enforced" value={dry.visibleIfEnforced} />
                <Stat
                  label="Would lose"
                  value={dry.wouldLose}
                  danger={dry.wouldLose > 0}
                />
              </div>

              {dry.wouldLose > 0 && (
                <Alert tone="warning" className="text-[12px]">
                  Enabling now would remove your access to{' '}
                  <strong>{dry.wouldLose}</strong> record
                  {dry.wouldLose === 1 ? '' : 's'} you can currently see.
                </Alert>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-[var(--st-text-secondary)]">
                  By object
                </span>
                {dry.perObject.length === 0 ? (
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    No objects to evaluate.
                  </span>
                ) : (
                  dry.perObject.map((o) => (
                    <div
                      key={o.object}
                      className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] py-1 text-[12px] last:border-b-0"
                    >
                      <span className="text-[var(--st-text)]">{o.object}</span>
                      <span className="text-[var(--st-text-secondary)]">
                        {o.ifEnforced}/{o.today} kept
                        {o.wouldLose > 0 ? (
                          <Badge
                            tone="danger"
                            kind="soft"
                            className="ml-2"
                          >
                            -{o.wouldLose}
                          </Badge>
                        ) : null}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Enable confirmation — the dangerous direction. */}
      <AlertDialog open={confirmEnable} onOpenChange={setConfirmEnable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable permission enforcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts hiding records from users at the data layer
              {dry && !dry.elevated && dry.wouldLose > 0
                ? ` — you alone would lose access to ${dry.wouldLose} record${
                    dry.wouldLose === 1 ? '' : 's'
                  }`
                : ''}
              . Enable ONLY after a security review on a running app, and remember
              the Rust read path is not yet covered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmEnable(false);
                void applyToggle(true);
              }}
            >
              Enable enforcement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Small stat tile for the dry-run summary. */
function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-2)]">
      <span
        className="text-[20px] font-semibold"
        style={{
          color: danger ? 'var(--st-danger, #dc2626)' : 'var(--st-text)',
        }}
      >
        {value}
      </span>
      <span className="text-[11px] text-[var(--st-text-secondary)]">
        {label}
      </span>
    </div>
  );
}
