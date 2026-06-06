'use client';

import { Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Switch, Table, TBody, Td, Th, THead, Tr, Textarea, cn, useToast } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  } from 'react';
import {
  AppWindow,
  Copy,
  ExternalLink,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Pencil,
  Power,
  Smartphone,
  Monitor,
  Link as LinkIcon,
  Loader2,
  X as XIcon,
  } from 'lucide-react';

/**
 * Telegram Mini Apps — per-project registry of Web Apps.
 *
 * The page is multi-tenant: every read/write goes through the active
 * project from {@link useProject}. When there's no active project we
 * render the empty-state. All file inputs (the optional photo on a
 * mini-app's branding card) come from SabFiles via `<SabFileUrlInput>`
 * — there is no free-text URL paste anywhere on this page (project
 * policy).
 */

import { SabFileUrlInput } from '@/components/sabfiles';

import { StatusPill } from './_components/status-pill';
import { KpiCard } from './_components/kpi-card';
import { MiniAppFormDrawer } from './_components/mini-app-form-drawer';
import { DetailDrawer } from './_components/detail-drawer';
import { SendDialog } from './_components/send-dialog';
import { RowActionsMenu } from './_components/row-actions-menu';


import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
  listTelegramMiniAppsPagedAction,
  createTelegramMiniAppAction,
  updateTelegramMiniAppAction,
  deleteTelegramMiniAppAction,
  sendTelegramMiniAppAction,
  setTelegramMiniAppMenuButtonAction,
  validateTelegramMiniAppInitDataAction,
  listTelegramMiniAppSessionsAction,
  getTelegramMiniAppAnalyticsAction,
} from '@/app/actions/telegram-extra.actions';
import { listTelegramBots } from '@/app/actions/telegram.actions';
import type {
  MiniAppRow,
  UpsertBody,
  SessionRow,
  AnalyticsResp,
  ThemeParams,
} from '@/lib/rust-client/telegram-mini-apps';

const ACCENT = '#229ED9';

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9_]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function emptyTheme(): ThemeParams {
  return {
    bg_color: '#0e1621',
    text_color: '#ffffff',
    hint_color: '#7c8a9c',
    link_color: '#229ED9',
    button_color: '#229ED9',
    button_text_color: '#ffffff',
  };
}

function directLink(botUsername: string | undefined, slug: string): string {
  if (!botUsername || !slug) return '';
  return `https://t.me/${botUsername}/${slug}`;
}

// ---------------------------------------------------------------------------
//  Subcomponents
// ---------------------------------------------------------------------------

interface BotLite {
  _id: string;
  username: string;
  name: string;
}

export default function MiniAppsPage() {
  const { toast } = useToast();
  const { activeProjectId, activeProjectName } = useProject();

  const [rows, setRows] = useState<MiniAppRow[]>([]);
  const [bots, setBots] = useState<BotLite[]>([]);
  const [loading, startLoading] = useTransition();
  const [analytics7d, setAnalytics7d] = useState<{
    opens: number;
    uniqueUsers: number;
    perApp: Record<string, number>;
  }>({ opens: 0, uniqueUsers: 0, perApp: {} });

  // Filters
  const [search, setSearch] = useState('');
  const [botFilter, setBotFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Drawers / dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<MiniAppRow | null>(null);

  const [detailApp, setDetailApp] = useState<MiniAppRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [sendApp, setSendApp] = useState<MiniAppRow | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const [menuButtonApp, setMenuButtonApp] = useState<MiniAppRow | null>(null);
  const [settingMenu, startSettingMenu] = useTransition();

  const [deleteApp, setDeleteApp] = useState<MiniAppRow | null>(null);
  const [deleting, startDeleting] = useTransition();

  const loadBots = useCallback(async () => {
    if (!activeProjectId) {
      setBots([]);
      return;
    }
    try {
      const list = await listTelegramBots(activeProjectId);
      setBots(
        (list ?? []).map((b) => ({
          _id: b._id,
          username: b.username,
          name: b.name,
        })),
      );
    } catch (e) {
      toast({
        title: 'Could not load bots',
        description: String(e),
        variant: 'destructive',
      });
      setBots([]);
    }
  }, [activeProjectId, toast]);

  const loadRows = useCallback(() => {
    if (!activeProjectId) {
      setRows([]);
      return;
    }
    startLoading(async () => {
      try {
        const res = await listTelegramMiniAppsPagedAction({
          projectId: activeProjectId,
          botId: botFilter === 'all' ? undefined : botFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search.trim() || undefined,
          page: 1,
          pageSize: 100,
        });
        if (res.error) {
          toast({
            title: 'Could not load mini apps',
            description: res.error,
            variant: 'destructive',
          });
        }
        setRows(res.miniApps ?? []);
      } catch (e) {
        toast({
          title: 'Could not load mini apps',
          description: String(e),
          variant: 'destructive',
        });
        setRows([]);
      }
    });
  }, [activeProjectId, botFilter, search, statusFilter, toast]);

  const loadAnalytics = useCallback(async () => {
    if (!activeProjectId) {
      setAnalytics7d({ opens: 0, uniqueUsers: 0, perApp: {} });
      return;
    }
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    let opens = 0;
    let uniqueUsers = 0;
    const perApp: Record<string, number> = {};
    // Fan out — page list will be small enough in practice.
    await Promise.all(
      rows.map(async (r) => {
        try {
          const res = await getTelegramMiniAppAnalyticsAction(r._id, {
            projectId: activeProjectId,
            from,
            to,
          });
          if (res.error) {
            toast({
              title: 'Analytics warning',
              description: res.error,
              variant: 'destructive',
            });
          }
          opens += res.opens || 0;
          uniqueUsers += res.uniqueUsers || 0;
          perApp[r._id] = res.opens || 0;
        } catch (e) {
          toast({
            title: 'Analytics error',
            description: String(e),
            variant: 'destructive',
          });
        }
      }),
    );
    setAnalytics7d({ opens, uniqueUsers, perApp });
  }, [activeProjectId, rows, toast]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (rows.length) loadAnalytics();
    else setAnalytics7d({ opens: 0, uniqueUsers: 0, perApp: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, activeProjectId]);

  const totalApps = rows.length;
  const activeCount = rows.filter((r) => r.status === 'active').length;

  const copy = useCallback(
    async (value: string, label = 'Copied') => {
      try {
        await navigator.clipboard.writeText(value);
        toast({ title: label });
      } catch {
        toast({
          title: 'Could not copy',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const onToggleStatus = useCallback(
    async (r: MiniAppRow, next: boolean) => {
      if (!activeProjectId) return;
      const body: UpsertBody = {
        projectId: activeProjectId,
        botId: r.botId,
        name: r.name,
        slug: r.slug,
        webAppUrl: r.webAppUrl,
        shortName: r.shortName,
        description: r.description,
        photoUrl: r.photoUrl,
        defaultButtonLabel: r.defaultButtonLabel,
        allowedDomains: r.allowedDomains,
        themeParams: r.themeParams,
        status: next ? 'active' : 'disabled',
      };
      const res = await updateTelegramMiniAppAction(r._id, body);
      if (res.success) {
        toast({ title: next ? 'Mini app activated' : 'Mini app disabled' });
        loadRows();
      } else {
        toast({
          title: 'Update failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [activeProjectId, loadRows, toast],
  );

  const onSetMenuButton = useCallback(
    async (r: MiniAppRow) => {
      if (!activeProjectId) return;
      setMenuButtonApp(r);
      startSettingMenu(async () => {
        const res = await setTelegramMiniAppMenuButtonAction(r._id, {
          projectId: activeProjectId,
        });
        if (res.success) {
          toast({
            title: 'Menu button set',
            description: `${r.name} is now the menu button for @${r.botUsername || ''}.`,
          });
        } else {
          toast({
            title: 'Could not set menu button',
            description: res.error,
            variant: 'destructive',
          });
        }
        setMenuButtonApp(null);
      });
    },
    [activeProjectId, toast],
  );

  const onConfirmDelete = useCallback(() => {
    if (!deleteApp || !activeProjectId) return;
    const target = deleteApp;
    startDeleting(async () => {
      const res = await deleteTelegramMiniAppAction(
        target._id,
        activeProjectId,
      );
      if (res.success) {
        toast({ title: 'Mini app deleted' });
        setDeleteApp(null);
        loadRows();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [activeProjectId, deleteApp, loadRows, toast]);

  if (!activeProjectId) {
    return (
      <div className="flex min-h-full flex-col gap-6 p-4">
        <PageHeader>
          <PageHeading>
            <PageEyebrow>Telegram</PageEyebrow>
            <PageTitle>Telegram Mini Apps</PageTitle>
            <PageDescription>
              Pick a project to manage its Telegram Mini Apps.
            </PageDescription>
          </PageHeading>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
        <TelegramProjectGate />
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Telegram · {activeProjectName ?? ''}</PageEyebrow>
          <PageTitle>
            <span className="inline-flex items-center gap-2">
              <LayoutGrid
                className="h-5 w-5"
                style={{ color: ACCENT }}
                aria-hidden
              />
              Telegram Mini Apps
            </span>
          </PageTitle>
          <PageDescription>
            Register Web App URLs for your bots, send them as messages, set
            them as the bot's menu button, and validate incoming initData.
          </PageDescription>
        </PageHeading>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditing(null);
              setFormMode('create');
              setFormOpen(true);
            }}
            style={{ backgroundColor: ACCENT }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New mini app
          </Button>
        </div>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total apps" value={totalApps} />
        <KpiCard label="Active" value={activeCount} />
        <KpiCard label="Opens (7 d)" value={analytics7d.opens} />
        <KpiCard label="Unique users (7 d)" value={analytics7d.uniqueUsers} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-secondary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, slug or URL…"
            className="pl-7"
          />
        </div>
        <Select value={botFilter} onValueChange={setBotFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Bot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bots</SelectItem>
            {bots.map((b) => (
              <SelectItem key={b._id} value={b._id}>
                @{b.username || b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {loading && rows.length === 0 ? (
          <div className="p-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <AppWindow
              className="h-8 w-8 text-[var(--st-text-secondary)]"
              aria-hidden
            />
            <div className="text-[14px] text-[var(--st-text)]">No mini apps yet</div>
            <div className="text-[12px] text-[var(--st-text-secondary)]">
              Register your first Web App URL to share it from a chat or set
              it as the bot's menu button.
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setFormMode('create');
                setFormOpen(true);
              }}
              style={{ backgroundColor: ACCENT }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New mini app
            </Button>
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Bot</Th>
                <Th>Slug</Th>
                <Th>URL</Th>
                <Th>Status</Th>
                <Th>Opens (7 d)</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r._id}>
                  <Td>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailApp(r);
                        setDetailOpen(true);
                      }}
                      className="text-left text-[var(--st-text)] hover:underline"
                    >
                      {r.name}
                    </button>
                  </Td>
                  <Td>
                    @{r.botUsername || '—'}
                  </Td>
                  <Td className="font-mono text-[11px]">
                    {r.slug}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-[11px] text-[var(--st-text-secondary)]"
                        title={r.webAppUrl}
                      >
                        {truncate(r.webAppUrl, 36)}
                      </span>
                      <button
                        type="button"
                        aria-label="Copy URL"
                        onClick={() => copy(r.webAppUrl, 'URL copied')}
                        className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-zoru-bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.status === 'active'}
                        onCheckedChange={(c) => onToggleStatus(r, c)}
                        aria-label={`Toggle ${r.name}`}
                      />
                      <StatusPill status={r.status} />
                    </div>
                  </Td>
                  <Td>
                    {analytics7d.perApp[r._id] ?? 0}
                  </Td>
                  <Td className="text-right">
                    <RowActionsMenu
                      app={r}
                      onOpen={() => {
                        setDetailApp(r);
                        setDetailOpen(true);
                      }}
                      onSend={() => {
                        setSendApp(r);
                        setSendOpen(true);
                      }}
                      onSetMenuButton={() => onSetMenuButton(r)}
                      onCopyLink={() => {
                        const link = directLink(r.botUsername, r.slug);
                        if (!link) {
                          toast({
                            title: 'Bot username missing',
                            description:
                              'Cannot build a t.me link until the bot has a username.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        copy(link, 'Direct link copied');
                      }}
                      onEdit={() => {
                        setEditing(r);
                        setFormMode('edit');
                        setFormOpen(true);
                      }}
                      onDelete={() => setDeleteApp(r)}
                    />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Form drawer */}
      <MiniAppFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        bots={bots}
        initial={editing}
        mode={formMode}
        onSaved={loadRows}
      />

      {/* Detail drawer */}
      <DetailDrawer
        app={detailApp}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={() => {
          if (!detailApp) return;
          setEditing(detailApp);
          setFormMode('edit');
          setFormOpen(true);
          setDetailOpen(false);
        }}
      />

      {/* Send dialog */}
      <SendDialog app={sendApp} open={sendOpen} onOpenChange={setSendOpen} />

      {/* Set-as-menu-button is fire-and-forget; show a small inline spinner. */}
      {menuButtonApp && settingMenu && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[12px] shadow"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating menu
          button…
        </div>
      )}

      {/* Delete confirm */}
      <Dialog
        open={!!deleteApp}
        onOpenChange={(o) => !o && setDeleteApp(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete mini app?</DialogTitle>
            <DialogDescription>
              {deleteApp
                ? `“${deleteApp.name}” will be removed from the registry. Existing menu-button bindings on Telegram are not removed automatically.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteApp(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
