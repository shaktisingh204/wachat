'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  StatCard,
  cn,
  useToast,
  type BadgeVariant,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  LogOut,
  Pencil,
  Plus,
  QrCode,
  Smartphone,
  Sparkles,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  useSabwaSession,
  type SabwaSessionInfo,
} from '@/lib/sabwa/session-context';
import {
  listSessions,
  logoutSession,
  renameSession,
} from '@/app/actions/sabwa.actions';

/**
 * OverviewAccountsClient. The `/sabwa/overview` accounts hub.
 *
 * Once a project is opened, this becomes the home for that project:
 *   - Active project name + "Change project" link back to /sabwa
 *   - List of linked WhatsApp accounts (sessions) for the project
 *   - Radio-select an account to activate it for Inbox / Chats / etc.
 *   - "Connect another WhatsApp" CTA to /sabwa/connect
 *
 * When no accounts are linked, renders an empty state with a primary
 * "Connect WhatsApp" CTA. When one is selected, the rest of SabWa
 * (sidebar links: Inbox, Chats, Groups, etc.) operates against that
 * session via `useSabwaSession()`.
 */

import * as React from 'react';
import Link from 'next/link';

/* status pill helpers */

function statusVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'connected':
      return 'success';
    case 'pairing':
    case 'syncing':
    case 'pending':
      return 'warning';
    case 'banned':
    case 'error':
      return 'destructive';
    case 'logged_out':
    default:
      return 'secondary';
  }
}

function statusLabel(status?: string): string {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function formatPhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.startsWith('+') ? phone : `+${phone}`;
}

function defaultLabel(session: {
  id: string;
  pushName?: string;
  label?: string;
  phoneE164?: string;
}): string {
  if (session.label?.trim()) return session.label;
  if (session.pushName?.trim()) return session.pushName;
  const phone = formatPhone(session.phoneE164);
  if (phone) return phone;
  // Final fallback: short suffix of the session id so each row is
  // visually distinct even before the phone is known. The engine
  // populates `phoneE164` / `pushName` after the engine's first
  // `connection.update`.
  const tail = session.id?.slice(-6) ?? '';
  return tail ? `Linked WhatsApp · ${tail}` : 'Linked WhatsApp';
}

/* rename dialog */

function RenameDialog({
  session,
  onOpenChange,
  onRenamed,
}: {
  session: SabwaSessionInfo | null;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (session) setValue(session.label ?? session.pushName ?? '');
  }, [session]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const label = value.trim();
    if (!label) return;
    startTransition(async () => {
      const res = await renameSession(session.id, label);
      if (!res.ok) {
        toast.error({
          title: 'Rename failed',
          description: res.error,
        });
        return;
      }
      toast.success('Renamed');
      onRenamed();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename account</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Label" id="sabwa-rename-label">
            <Input
              autoFocus
              maxLength={80}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Primary number"
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending || !value.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* account row */

function AccountRow({
  session,
  isActive,
  onActivate,
  onRename,
  onLogout,
}: {
  session: SabwaSessionInfo;
  isActive: boolean;
  onActivate: () => void;
  onRename: () => void;
  onLogout: () => void;
}) {
  const phone = formatPhone(session.phoneE164);
  const label = defaultLabel(session);
  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-x-4 gap-y-2 rounded-[var(--st-radius-lg)] border p-4 transition',
        isActive
          ? 'border-[var(--st-text)] bg-[var(--st-bg-secondary)] shadow-[var(--st-shadow-sm)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg)] hover:border-[var(--st-border-strong)]',
      )}
    >
      <IconButton
        icon={Check}
        label={isActive ? 'Active account' : 'Set as active account'}
        onClick={onActivate}
        aria-pressed={isActive}
        className={cn(
          'mt-0.5 h-5 w-5 shrink-0 rounded-full border',
          isActive
            ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-text-inverted)]'
            : 'border-[var(--st-border-strong)] bg-[var(--st-bg)] text-transparent hover:border-[var(--st-text)]',
        )}
      />

      <div className="min-w-0 flex-1 basis-[200px]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] text-[var(--st-text)]">{label}</p>
          <Badge variant={statusVariant(session.status)} className="text-[10px]">
            {statusLabel(session.status)}
          </Badge>
          {isActive && (
            <Badge variant="default" className="text-[10px]">
              Active
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--st-text-secondary)]">
          {phone}
        </p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <IconButton
          icon={Pencil}
          label="Rename"
          variant="ghost"
          size="sm"
          onClick={onRename}
        />
        <IconButton
          icon={LogOut}
          label="Log out"
          variant="ghost"
          size="sm"
          onClick={onLogout}
        />
      </div>
    </div>
  );
}

/* page */

export function OverviewAccountsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeProjectId, projects } = useProject();
  const { current, sessions, setCurrent, refresh, loading } = useSabwaSession();

  const activeProject = React.useMemo(
    () =>
      projects.find(
        (p) =>
          // Defensive: a partially-hydrated project row could be
          // missing `_id`. Don't crash the render, just skip it.
          p?._id?.toString?.() === activeProjectId,
      ) ?? null,
    [projects, activeProjectId],
  );

  // If no project is active (e.g. direct nav to /sabwa/overview), bounce
  // back to /sabwa where the user can pick one.
  React.useEffect(() => {
    if (!activeProjectId) router.replace('/sabwa');
  }, [activeProjectId, router]);

  // Pull the latest sessions list when this page opens. The provider's
  // `refresh()` re-runs `listSessions` against the active project.
  const [reloading, setReloading] = React.useState(false);
  React.useEffect(() => {
    if (!activeProjectId) return;
    setReloading(true);
    (async () => {
      try {
        const res = await listSessions(activeProjectId);
        if (res.ok) {
          // Push freshest into context via refresh(). The provider
          // re-derives `current` from `setCurrent` storage.
          await refresh();
        }
      } finally {
        setReloading(false);
      }
    })();
    // refresh is stable from the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // Auto-select a sensible default once sessions arrive:
  //   - If nothing is active yet, prefer the first connected one.
  //   - Otherwise leave it unselected so the user picks deliberately.
  React.useEffect(() => {
    if (current) return;
    const connected = sessions.find((s) => s.id && s.status === 'connected');
    if (connected) {
      setCurrent(connected.id);
      return;
    }
    if (sessions.length === 1 && sessions[0]?.id) {
      setCurrent(sessions[0].id);
    }
  }, [current, sessions, setCurrent]);

  // Auto-refresh while any session is in a transitional state. The engine
  // flips `pending`/`pairing`/`syncing` to `connected` over SSE, but this
  // hub doesn't subscribe to the per-session stream. Instead we poll the
  // sessions list every 4s while at least one row is still settling, so
  // the user sees the row update without a manual reload. Stops as soon
  // as every session is `connected` or in a terminal state.
  React.useEffect(() => {
    const hasPending = sessions.some(
      (s) =>
        s.status === 'pending' ||
        s.status === 'pairing' ||
        s.status === 'syncing',
    );
    if (!hasPending) return;
    const id = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [sessions, refresh]);

  const [renameTarget, setRenameTarget] =
    React.useState<SabwaSessionInfo | null>(null);
  const [logoutTarget, setLogoutTarget] =
    React.useState<SabwaSessionInfo | null>(null);
  const [logoutPending, startLogoutTransition] = React.useTransition();

  const handleLogout = () => {
    if (!logoutTarget) return;
    startLogoutTransition(async () => {
      const res = await logoutSession(logoutTarget.id);
      if (!res.ok) {
        toast.error({
          title: 'Logout failed',
          description: res.error,
        });
        return;
      }
      toast.success('Account logged out');
      setLogoutTarget(null);
      await refresh();
      router.refresh();
    });
  };

  const showSkeleton = loading || reloading;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-10 sm:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{activeProject?.name ?? 'Project'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader bordered={false} className="mt-5">
        <PageHeaderHeading>
          <PageEyebrow>
            <Briefcase className="-mt-0.5 mr-1 inline h-3 w-3" aria-hidden="true" />
            {activeProject?.name ?? 'Project'}
          </PageEyebrow>
          <PageTitle>WhatsApp accounts</PageTitle>
          <PageDescription>
            Pick one account to activate it across SabWa. Inbox, Chats,
            Broadcasts, and AI all use whichever account is active.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link href="/sabwa">
            <Button variant="outline" size="md">
              Change project
            </Button>
          </Link>
          <Link href="/sabwa/connect">
            <Button variant="primary" size="md" iconLeft={Plus}>
              Connect WhatsApp
            </Button>
          </Link>
        </PageActions>
      </PageHeader>

      {/* Active-account ready banner. Confirms the rest of SabWa works */}
      {current && current.status === 'connected' && (
        <Card variant="outlined" padding="md" className="mt-5 bg-[var(--st-bg-secondary)]">
          <CardBody className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-status-ok)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-[var(--st-text)]">
                <strong>
                  {current.label ?? current.pushName ?? 'This account'}
                </strong>{' '}
                is active. Inbox, Chats, Groups, Broadcasts and AI assistant
                now operate on this number.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href="/sabwa/inbox">
                  <Button variant="outline" size="sm" iconRight={ArrowRight}>
                    Open inbox
                  </Button>
                </Link>
                <Link href="/sabwa/chats">
                  <Button variant="ghost" size="sm">
                    Chats
                  </Button>
                </Link>
                <Link href="/sabwa/broadcasts">
                  <Button variant="ghost" size="sm">
                    Broadcasts
                  </Button>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Global Metric Roll-ups */}
      {sessions.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Accounts"
            value={sessions.length.toString()}
            icon={Smartphone}
          />
          <StatCard
            label="Ready to Use"
            value={sessions
              .filter((s) => s.status === 'connected')
              .length.toString()}
            icon={CheckCircle2}
            accent="var(--st-status-ok)"
          />
          <StatCard
            label="Needs Attention"
            value={sessions
              .filter((s) => s.status !== 'connected')
              .length.toString()}
            icon={AlertCircle}
            accent={
              sessions.filter((s) => s.status !== 'connected').length > 0
                ? 'var(--st-warn)'
                : undefined
            }
          />
        </div>
      )}

      {/* Accounts list */}
      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-[16px] text-[var(--st-text)]">Linked accounts</h2>
          <p className="text-[12px] text-[var(--st-text-secondary)]">
            {sessions.length}{' '}
            {sessions.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>

        {showSkeleton ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px]" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No WhatsApp accounts linked yet"
            description="Connect a personal WhatsApp number to start using Inbox, Chats, Broadcasts, and AI for this project."
            action={
              <Link href="/sabwa/connect">
                <Button variant="primary" size="md" iconLeft={QrCode}>
                  Connect WhatsApp
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {sessions.map((s, idx) => (
              <AccountRow
                // Some upstreams have transiently produced empty ids; fall
                // back to the index so React doesn't reuse rows by mistake.
                key={s.id || `row-${idx}`}
                session={s}
                // An empty session id should never match the active one,
                // otherwise every row with `id === ''` would render as
                // the active account.
                isActive={!!s.id && current?.id === s.id}
                onActivate={() => {
                  if (!s.id) return;
                  setCurrent(s.id);
                  if (s.status !== 'connected') {
                    toast({
                      title: "This account isn't connected yet",
                      description:
                        'Finish pairing first to use it across SabWa.',
                    });
                  }
                }}
                onRename={() => setRenameTarget(s)}
                onLogout={() => setLogoutTarget(s)}
              />
            ))}
            <Link href="/sabwa/connect" className="mt-1 block">
              <Button
                variant="outline"
                size="md"
                block
                iconLeft={Plus}
                className="border-dashed text-[var(--st-text-secondary)]"
              >
                Connect another WhatsApp account
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Hint when accounts exist but none active */}
      {sessions.length > 0 && !current && (
        <Card variant="outlined" padding="md" className="mt-5">
          <CardBody className="flex items-start gap-3">
            <Smartphone
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-text-secondary)]"
              aria-hidden="true"
            />
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              Pick an account above to activate it. Other SabWa features
              (Inbox, Chats, Broadcasts) need an active account to work.
            </p>
          </CardBody>
        </Card>
      )}

      <RenameDialog
        session={renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        onRenamed={() => {
          void refresh();
          router.refresh();
        }}
      />

      <AlertDialog
        open={!!logoutTarget}
        onOpenChange={(o) => !o && setLogoutTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This unlinks the WhatsApp session from SabWa. Chats stored
              in your workspace are kept; you can re-link the number at
              any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={logoutPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              disabled={logoutPending}
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default OverviewAccountsClient;
</content>
</invoke>
