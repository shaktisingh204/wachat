'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
  Boxes,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Smartphone,
  Table as TableIcon,
  } from 'lucide-react';
import type { WithId } from 'mongodb';

/**
 * DevicesClient — responsive Linked-Devices manager for SabWa.
 *
 * On mobile (and by default on md+) a card grid; on md+ users can flip
 * to a compact table view. Each session can be renamed or logged out via
 * dialogs; both confirm against the corresponding server action and
 * refresh the list on success.
 *
 * Rebuilt on ZoruUI primitives. The grid/table view-mode picker is a
 * segmented Button group (no tab UI per the ZoruUI design rules).
 */

import * as React from 'react';
import Link from 'next/link';

import { useProject } from '@/context/project-context';
import {
  listSessions,
  logoutSession,
  renameSession,
} from '@/app/actions/sabwa.actions';
import type { SabwaSession } from '@/lib/sabwa/types';

import { EmptyState } from '../_components/empty-state';
import { StatusBadge } from '../_components/status-badge';

type ViewMode = 'grid' | 'table';

function initials(s?: SabwaSession): string {
  const src = s?.pushName ?? s?.label ?? s?.phoneE164 ?? '?';
  return src
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('') || '?';
}

function formatPhone(p?: string): string {
  if (!p) return 'Unknown number';
  return p.startsWith('+') ? p : `+${p}`;
}

function formatRelative(date?: Date | string): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function DevicesClient() {
  const router = useRouter();
  const toast = useZoruToast();
  const { activeProjectId, activeProjectName } = useProject();

  const [sessions, setSessions] = React.useState<WithId<SabwaSession>[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [view, setView] = React.useState<ViewMode>('grid');

  const [renameTarget, setRenameTarget] =
    React.useState<WithId<SabwaSession> | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [renamePending, startRenameTransition] = React.useTransition();

  const [logoutTarget, setLogoutTarget] =
    React.useState<WithId<SabwaSession> | null>(null);
  const [logoutPending, startLogoutTransition] = React.useTransition();

  const refresh = React.useCallback(async () => {
    if (!activeProjectId) {
      setSessions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listSessions(activeProjectId);
      if (!result.ok) throw new Error(result.error);
      setSessions(result.sessions as WithId<SabwaSession>[]);
    } catch (error) {
      setSessions([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load sessions. The SabWa engine may be offline.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRename = () => {
    if (!renameTarget) return;
    const newLabel = renameValue.trim();
    if (!newLabel) {
      toast.toast({
        title: 'Label cannot be empty',
        variant: 'destructive',
      });
      return;
    }
    startRenameTransition(async () => {
      try {
        const result = await renameSession(
          renameTarget._id.toString(),
          newLabel,
        );
        if (!result.ok) throw new Error(result.error);
        toast.toast({ title: 'Renamed', description: `Now labelled “${newLabel}”.` });
        setRenameTarget(null);
        await refresh();
        router.refresh();
      } catch (error) {
        toast.toast({
          title: 'Rename failed',
          description: error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleLogout = () => {
    if (!logoutTarget) return;
    startLogoutTransition(async () => {
      try {
        const result = await logoutSession(logoutTarget._id.toString());
        if (!result.ok) throw new Error(result.error);
        toast.toast({ title: 'Session logged out' });
        setLogoutTarget(null);
        await refresh();
        router.refresh();
      } catch (error) {
        toast.toast({
          title: 'Logout failed',
          description: error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 md:px-6 lg:px-8 pt-6 pb-10 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Linked Devices</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] tracking-[-0.015em] text-[var(--st-text)] leading-[1.2]">
              Linked Devices
            </h1>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
              Every WhatsApp number connected to{' '}
              <strong className="text-[var(--st-text)]">
                {activeProjectName ?? 'this project'}
              </strong>
              .
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ZoruTooltipProvider delayDuration={150}>
            <Tooltip>
              <ZoruTooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void refresh()}
                  disabled={isLoading}
                  aria-label="Refresh sessions"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isLoading && 'animate-spin')}
                  />
                </Button>
              </ZoruTooltipTrigger>
              <ZoruTooltipContent>Refresh</ZoruTooltipContent>
            </Tooltip>
          </ZoruTooltipProvider>

          {/* Segmented view-mode switcher — replaces the previous Tabs UI */}
          <div
            role="group"
            aria-label="View mode"
            className="hidden md:inline-flex rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
          >
            <Button
              type="button"
              size="sm"
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              onClick={() => setView('grid')}
              aria-pressed={view === 'grid'}
              className="h-7 rounded-[calc(var(--zoru-radius)-2px)] px-2"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Grid</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'table' ? 'secondary' : 'ghost'}
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              className="h-7 rounded-[calc(var(--zoru-radius)-2px)] px-2"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Table</span>
            </Button>
          </div>

          <Button asChild className="gap-2">
            <Link href="/sabwa/connect">
              <Plus className="h-4 w-4" /> Connect another number
            </Link>
          </Button>
        </div>
      </header>

      {/* Body */}
      {isLoading ? (
        <Card>
          <ZoruCardContent className="flex h-40 items-center justify-center text-[var(--st-text-secondary)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sessions…
          </ZoruCardContent>
        </Card>
      ) : !sessions || sessions.length === 0 ? (
        <Card>
          <ZoruCardContent className="py-10">
            <EmptyState
              icon={Smartphone}
              title="No linked WhatsApp numbers yet"
              description={
                loadError ?? 'Connect your first WhatsApp number to start receiving messages, scheduling broadcasts, and automating chats.'
              }
              action={
                <Button asChild className="gap-2">
                  <Link href="/sabwa/connect">
                    <Plus className="h-4 w-4" /> Connect WhatsApp
                  </Link>
                </Button>
              }
            />
          </ZoruCardContent>
        </Card>
      ) : view === 'table' ? (
        <Card className="p-0 overflow-hidden">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Number</ZoruTableHead>
                <ZoruTableHead>Label</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Platform</ZoruTableHead>
                <ZoruTableHead>Last seen</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {sessions.map((s) => (
                <ZoruTableRow key={s._id.toString()}>
                  <ZoruTableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-xs font-semibold text-[var(--st-text)]"
                      >
                        {initials(s)}
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span>{formatPhone(s.phoneE164)}</span>
                        {s.pushName ? (
                          <span className="text-xs text-[var(--st-text-secondary)]">
                            {s.pushName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell>{s.label ?? '—'}</ZoruTableCell>
                  <ZoruTableCell>
                    <StatusBadge status={s.status} size="sm" />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[var(--st-text-secondary)]">
                    {s.deviceMeta?.platform ?? '—'}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[var(--st-text-secondary)]">
                    {formatRelative(s.lastSeenAt)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRenameTarget(s);
                        setRenameValue(s.label ?? '');
                      }}
                      className="h-7 px-2"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="ml-1 text-xs">Rename</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setLogoutTarget(s)}
                      className="h-7 px-2 text-[var(--st-danger)] hover:text-[var(--st-danger)]"
                    >
                      Logout
                    </Button>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Card key={s._id.toString()} className="flex flex-col p-0">
              <ZoruCardHeader className="flex flex-row items-start gap-3 space-y-0">
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-base font-semibold text-[var(--st-text)]"
                >
                  {initials(s)}
                </span>
                <div className="min-w-0 flex-1">
                  <ZoruCardTitle className="truncate text-base">
                    {formatPhone(s.phoneE164)}
                  </ZoruCardTitle>
                  <ZoruCardDescription className="truncate">
                    {s.pushName ?? s.label ?? 'Unnamed session'}
                  </ZoruCardDescription>
                  <div className="mt-2">
                    <StatusBadge status={s.status} size="sm" />
                  </div>
                </div>
              </ZoruCardHeader>
              <ZoruCardContent className="flex-1 text-sm">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[var(--st-text-secondary)]">Platform</dt>
                    <dd className="mt-0.5 font-medium text-[var(--st-text)]">
                      {s.deviceMeta?.platform ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--st-text-secondary)]">Last seen</dt>
                    <dd className="mt-0.5 font-medium text-[var(--st-text)]">
                      {formatRelative(s.lastSeenAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--st-text-secondary)]">Method</dt>
                    <dd className="mt-0.5 font-medium capitalize text-[var(--st-text)]">
                      {s.pairMethod}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--st-text-secondary)]">Rate limit</dt>
                    <dd className="mt-0.5 font-medium capitalize text-[var(--st-text)]">
                      {s.rateLimitProfile}
                    </dd>
                  </div>
                </dl>
                {s.banSignals && s.banSignals.length > 0 ? (
                  <Badge variant="warning" className="mt-3 gap-1">
                    {s.banSignals.length} ban signal
                    {s.banSignals.length === 1 ? '' : 's'}
                  </Badge>
                ) : null}
              </ZoruCardContent>
              <ZoruCardFooter className="flex justify-between gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 py-3 px-5 sm:px-6">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRenameTarget(s);
                    setRenameValue(s.label ?? '');
                  }}
                  className="gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-[var(--st-danger)] hover:text-[var(--st-danger)]"
                  onClick={() => setLogoutTarget(s)}
                >
                  Logout
                </Button>
              </ZoruCardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Rename session</ZoruDialogTitle>
            <ZoruDialogDescription>
              Choose an internal label — it is never shown to your WhatsApp
              contacts.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-label">Label</Label>
            <Input
              id="rename-label"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="e.g. Sales line, Personal, Team broadcaster"
              maxLength={64}
            />
          </div>
          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRenameTarget(null)}
              disabled={renamePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRename}
              disabled={renamePending || renameValue.trim().length === 0}
            >
              {renamePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Logout confirmation */}
      <ZoruAlertDialog
        open={logoutTarget !== null}
        onOpenChange={(o) => {
          if (!o) setLogoutTarget(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Log this WhatsApp session out?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {logoutTarget
                ? `${formatPhone(logoutTarget.phoneE164)} will be unlinked from this project. You can reconnect later from the Connect page.`
                : ''}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={logoutPending}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              disabled={logoutPending}
              className="bg-[var(--st-danger)] text-zoru-danger-foreground hover:bg-[var(--st-danger)]/90"
            >
              {logoutPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log out
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}

export default DevicesClient;
