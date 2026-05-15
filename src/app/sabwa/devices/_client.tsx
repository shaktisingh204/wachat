'use client';

/**
 * DevicesClient — responsive Linked-Devices manager for SabWa.
 *
 * On mobile (and by default on md+) a card grid; on md+ users can flip
 * to a compact table view. Each session can be renamed or logged out via
 * dialogs; both confirm against the corresponding server action and
 * refresh the list on success.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
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
      toast({
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
        toast({ title: 'Renamed', description: `Now labelled “${newLabel}”.` });
        setRenameTarget(null);
        await refresh();
        router.refresh();
      } catch (error) {
        toast({
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
        toast({ title: 'Session logged out' });
        setLogoutTarget(null);
        await refresh();
        router.refresh();
      } catch (error) {
        toast({
          title: 'Logout failed',
          description: error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-600/10 p-3 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
            <Boxes className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Linked Devices
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every WhatsApp number connected to{' '}
              <strong>{activeProjectName ?? 'this project'}</strong>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="hidden items-center rounded-md border bg-card p-0.5 md:flex">
            <Button
              type="button"
              size="sm"
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              onClick={() => setView('grid')}
              className="h-7 px-2"
              aria-pressed={view === 'grid'}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Grid</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'table' ? 'secondary' : 'ghost'}
              onClick={() => setView('table')}
              className="h-7 px-2"
              aria-pressed={view === 'table'}
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
          <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sessions…
          </CardContent>
        </Card>
      ) : !sessions || sessions.length === 0 ? (
        <Card>
          <CardContent className="py-10">
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
          </CardContent>
        </Card>
      ) : view === 'table' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s._id.toString()}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600/10 text-xs font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                      >
                        {initials(s)}
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span>{formatPhone(s.phoneE164)}</span>
                        {s.pushName ? (
                          <span className="text-xs text-muted-foreground">
                            {s.pushName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{s.label ?? '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.deviceMeta?.platform ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelative(s.lastSeenAt)}
                  </TableCell>
                  <TableCell className="text-right">
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
                      className="h-7 px-2 text-destructive hover:text-destructive"
                    >
                      Logout
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Card key={s._id.toString()} className="flex flex-col">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-base font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                >
                  {initials(s)}
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-base">
                    {formatPhone(s.phoneE164)}
                  </CardTitle>
                  <CardDescription className="truncate">
                    {s.pushName ?? s.label ?? 'Unnamed session'}
                  </CardDescription>
                  <div className="mt-2">
                    <StatusBadge status={s.status} size="sm" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 text-sm">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Platform</dt>
                    <dd className="mt-0.5 font-medium">
                      {s.deviceMeta?.platform ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last seen</dt>
                    <dd className="mt-0.5 font-medium">
                      {formatRelative(s.lastSeenAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Method</dt>
                    <dd className="mt-0.5 font-medium capitalize">
                      {s.pairMethod}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Rate limit</dt>
                    <dd className="mt-0.5 font-medium capitalize">
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
              </CardContent>
              <CardFooter className="flex justify-between gap-2 border-t bg-muted/30 py-3">
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
                  className="text-destructive hover:text-destructive"
                  onClick={() => setLogoutTarget(s)}
                >
                  Logout
                </Button>
              </CardFooter>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename session</DialogTitle>
            <DialogDescription>
              Choose an internal label — it is never shown to your WhatsApp
              contacts.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout confirmation */}
      <AlertDialog
        open={logoutTarget !== null}
        onOpenChange={(o) => {
          if (!o) setLogoutTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log this WhatsApp session out?</AlertDialogTitle>
            <AlertDialogDescription>
              {logoutTarget
                ? `${formatPhone(logoutTarget.phoneE164)} will be unlinked from this project. You can reconnect later from the Connect page.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={logoutPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              disabled={logoutPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {logoutPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DevicesClient;
