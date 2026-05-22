'use client';

import {
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerFooter,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  Label,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
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

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] text-zoru-ink leading-tight">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-zoru-ink-muted">{hint}</div>
      ) : null}
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
          : 'bg-zinc-500/10 text-zinc-500',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-emerald-500' : 'bg-zinc-400',
        )}
      />
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}

function ColorSwatchInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = HEX_RE.test(value);
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-zoru-ink-muted">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color`}
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-zoru-line bg-zoru-bg p-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-8 text-[12px] font-mono',
            !valid && value && 'border-red-500/60',
          )}
          placeholder="#RRGGBB"
        />
      </div>
      {!valid && value ? (
        <span className="text-[10px] text-red-500">Expected #RRGGBB</span>
      ) : null}
    </div>
  );
}

function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = useCallback(() => {
    const next = draft.trim();
    if (!next) return;
    if (value.includes(next)) {
      setDraft('');
      return;
    }
    onChange([...value, next]);
    setDraft('');
  }, [draft, onChange, value]);
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zoru-line bg-zoru-bg px-2 py-1.5">
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full bg-zoru-bg-muted px-2 py-0.5 text-[11px] text-zoru-ink"
        >
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            className="text-zoru-ink-muted hover:text-zoru-ink"
            onClick={() => onChange(value.filter((x) => x !== v))}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && draft === '' && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={placeholder || 'Add domain and press Enter'}
        className="flex-1 min-w-[140px] bg-transparent text-[12px] outline-none placeholder:text-zoru-ink-muted"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Form
// ---------------------------------------------------------------------------

interface FormState {
  botId: string;
  name: string;
  slug: string;
  webAppUrl: string;
  shortName: string;
  description: string;
  photoUrl: string;
  defaultButtonLabel: string;
  status: 'active' | 'disabled';
  allowedDomains: string[];
  themeParams: ThemeParams;
}

function emptyForm(): FormState {
  return {
    botId: '',
    name: '',
    slug: '',
    webAppUrl: '',
    shortName: '',
    description: '',
    photoUrl: '',
    defaultButtonLabel: 'Open',
    status: 'active',
    allowedDomains: [],
    themeParams: emptyTheme(),
  };
}

function rowToForm(r: MiniAppRow): FormState {
  return {
    botId: r.botId,
    name: r.name,
    slug: r.slug,
    webAppUrl: r.webAppUrl,
    shortName: r.shortName ?? '',
    description: r.description ?? '',
    photoUrl: r.photoUrl ?? '',
    defaultButtonLabel: r.defaultButtonLabel || 'Open',
    status: (r.status === 'disabled' ? 'disabled' : 'active') as
      | 'active'
      | 'disabled',
    allowedDomains: r.allowedDomains ?? [],
    themeParams: { ...emptyTheme(), ...(r.themeParams ?? {}) },
  };
}

function MiniAppFormDrawer({
  open,
  onOpenChange,
  bots,
  initial,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  bots: BotLite[];
  initial: MiniAppRow | null;
  mode: 'create' | 'edit';
  onSaved: () => void;
}) {
  const { toast } = useZoruToast();
  const { activeProjectId } = useProject();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, startSaving] = useTransition();
  const slugTouchedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm(rowToForm(initial));
      slugTouchedRef.current = true;
    } else {
      setForm(emptyForm());
      slugTouchedRef.current = false;
    }
  }, [initial, open]);

  const slugValid = SLUG_RE.test(form.slug);
  const urlValid =
    form.webAppUrl.startsWith('https://') ||
    form.webAppUrl.startsWith('http://');
  const themeValid = useMemo(() => {
    const t = form.themeParams;
    const all = [
      t.bg_color,
      t.text_color,
      t.hint_color,
      t.link_color,
      t.button_color,
      t.button_text_color,
    ];
    return all.every((v) => !v || HEX_RE.test(v));
  }, [form.themeParams]);

  const canSubmit =
    !!activeProjectId &&
    !!form.botId &&
    form.name.trim().length > 0 &&
    slugValid &&
    urlValid &&
    themeValid &&
    !saving;

  const submit = useCallback(() => {
    if (!activeProjectId || !canSubmit) return;
    const body: UpsertBody = {
      projectId: activeProjectId,
      botId: form.botId,
      name: form.name.trim(),
      slug: form.slug,
      webAppUrl: form.webAppUrl,
      shortName: form.shortName || undefined,
      description: form.description || undefined,
      photoUrl: form.photoUrl || undefined,
      defaultButtonLabel: form.defaultButtonLabel || 'Open',
      allowedDomains: form.allowedDomains,
      themeParams: form.themeParams,
      status: form.status,
    };
    startSaving(async () => {
      const res =
        mode === 'edit' && initial
          ? await updateTelegramMiniAppAction(initial._id, body)
          : await createTelegramMiniAppAction(body);
      if (res.success) {
        toast({
          title: mode === 'edit' ? 'Mini app updated' : 'Mini app created',
          description: res.message,
        });
        onSaved();
        onOpenChange(false);
      } else {
        toast({
          title: 'Could not save',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [
    activeProjectId,
    canSubmit,
    form,
    initial,
    mode,
    onOpenChange,
    onSaved,
    toast,
  ]);

  return (
    <ZoruDrawer open={open} onOpenChange={onOpenChange}>
      <ZoruDrawerContent className="max-h-[92vh]">
        <ZoruDrawerHeader>
          <ZoruDrawerTitle>
            {mode === 'edit' ? 'Edit mini app' : 'New mini app'}
          </ZoruDrawerTitle>
          <ZoruDrawerDescription>
            Register a Telegram Web App URL for one of your bots. Users open
            it from a chat or the bot's menu button.
          </ZoruDrawerDescription>
        </ZoruDrawerHeader>

        <div className="grid gap-6 overflow-y-auto px-4 py-2 md:grid-cols-2">
          {/* ------- Basics ------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-medium text-zoru-ink">Basics</h3>
            <div className="flex flex-col gap-1">
              <Label>Bot</Label>
              <Select
                value={form.botId}
                onValueChange={(v) => setForm((p) => ({ ...p, botId: v }))}
                disabled={mode === 'edit'}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select a bot" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {bots.map((b) => (
                    <ZoruSelectItem key={b._id} value={b._id}>
                      @{b.username || b.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((p) => ({
                    ...p,
                    name,
                    slug: slugTouchedRef.current ? p.slug : slugify(name),
                  }));
                }}
                placeholder="My Mini App"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => {
                  slugTouchedRef.current = true;
                  setForm((p) => ({ ...p, slug: e.target.value }));
                }}
                placeholder="my_mini_app"
                className={cn(
                  'font-mono',
                  !slugValid && form.slug && 'border-red-500/60',
                )}
              />
              <span className="text-[11px] text-zoru-ink-muted">
                Used in the t.me direct link. Lowercase letters, digits,
                underscores only.
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Web App URL</Label>
              <Input
                value={form.webAppUrl}
                onChange={(e) =>
                  setForm((p) => ({ ...p, webAppUrl: e.target.value }))
                }
                placeholder="https://example.com/app"
                className={cn(
                  !urlValid && form.webAppUrl && 'border-red-500/60',
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label>Short name (optional)</Label>
              <Input
                value={form.shortName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, shortName: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={3}
              />
            </div>
          </section>

          {/* ------- Branding + Theme ------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-medium text-zoru-ink">Branding</h3>
            <div className="flex flex-col gap-1">
              <Label>Photo (SabFiles)</Label>
              <SabFileUrlInput
                value={form.photoUrl}
                onChange={(v) => setForm((p) => ({ ...p, photoUrl: v }))}
                accept="image"
                placeholder="Pick or upload an image"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Default button label</Label>
              <Input
                value={form.defaultButtonLabel}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    defaultButtonLabel: e.target.value,
                  }))
                }
                placeholder="Open"
              />
            </div>

            <h3 className="mt-2 text-[12px] font-medium text-zoru-ink">
              Theme params
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['bg_color', 'Background'],
                  ['text_color', 'Text'],
                  ['hint_color', 'Hint'],
                  ['link_color', 'Link'],
                  ['button_color', 'Button'],
                  ['button_text_color', 'Button text'],
                ] as const
              ).map(([k, label]) => (
                <ColorSwatchInput
                  key={k}
                  label={label}
                  value={form.themeParams[k] ?? ''}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      themeParams: { ...p.themeParams, [k]: v },
                    }))
                  }
                />
              ))}
            </div>
            <div className="mt-2 rounded-md border border-zoru-line p-3">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-zoru-ink-muted">
                Preview
              </div>
              <div
                className="rounded-md p-3"
                style={{
                  backgroundColor: form.themeParams.bg_color,
                  color: form.themeParams.text_color,
                }}
              >
                <div
                  className="text-[12px]"
                  style={{ color: form.themeParams.hint_color }}
                >
                  Hint text
                </div>
                <div className="text-[13px]">{form.name || 'Mini app name'}</div>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-[12px] underline"
                  style={{ color: form.themeParams.link_color }}
                >
                  link text
                </a>
                <div className="mt-2">
                  <button
                    type="button"
                    className="rounded px-3 py-1.5 text-[12px]"
                    style={{
                      backgroundColor: form.themeParams.button_color,
                      color: form.themeParams.button_text_color,
                    }}
                  >
                    {form.defaultButtonLabel || 'Open'}
                  </button>
                </div>
              </div>
            </div>

            <h3 className="mt-2 text-[12px] font-medium text-zoru-ink">
              Allowed domains
            </h3>
            <ChipInput
              value={form.allowedDomains}
              onChange={(v) => setForm((p) => ({ ...p, allowedDomains: v }))}
              placeholder="example.com"
            />

            <div className="mt-2 flex items-center justify-between rounded-md border border-zoru-line px-3 py-2">
              <div>
                <div className="text-[12px] text-zoru-ink">Status</div>
                <div className="text-[11px] text-zoru-ink-muted">
                  Disabled mini apps don't accept opens.
                </div>
              </div>
              <Switch
                checked={form.status === 'active'}
                onCheckedChange={(c) =>
                  setForm((p) => ({
                    ...p,
                    status: c ? 'active' : 'disabled',
                  }))
                }
              />
            </div>
          </section>
        </div>

        <ZoruDrawerFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            style={{ backgroundColor: ACCENT }}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {mode === 'edit' ? 'Save changes' : 'Create mini app'}
          </Button>
        </ZoruDrawerFooter>
      </ZoruDrawerContent>
    </ZoruDrawer>
  );
}

// ---------------------------------------------------------------------------
//  Send-to-chat dialog
// ---------------------------------------------------------------------------

function SendDialog({
  app,
  open,
  onOpenChange,
}: {
  app: MiniAppRow | null;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const { toast } = useZoruToast();
  const { activeProjectId } = useProject();
  const [chatId, setChatId] = useState('');
  const [label, setLabel] = useState('');
  const [style, setStyle] = useState<'inline' | 'keyboard' | 'web_app_button'>(
    'inline',
  );
  const [text, setText] = useState('');
  const [pending, startPending] = useTransition();

  useEffect(() => {
    if (open && app) {
      setLabel(app.defaultButtonLabel || 'Open');
      setText(`Open ${app.name}`);
      setChatId('');
    }
  }, [app, open]);

  const submit = () => {
    if (!app || !activeProjectId || !chatId.trim()) return;
    startPending(async () => {
      const res = await sendTelegramMiniAppAction(app._id, {
        projectId: activeProjectId,
        chatId: chatId.trim(),
        label: label || undefined,
        replyMarkup: style,
        text: text || undefined,
      });
      if (res.success) {
        toast({
          title: 'Sent',
          description: `Message ${res.messageId ?? ''} delivered.`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: 'Send failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Send mini app to a chat</ZoruDialogTitle>
          <ZoruDialogDescription>
            {app
              ? `Send ${app.name} as a button in a chat the bot can write to.`
              : null}
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Chat ID</Label>
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 12345678 or @channelname"
            />
          </div>
          <div>
            <Label>Message text</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>Button label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <Label>Markup style</Label>
            <Select
              value={style}
              onValueChange={(v) => setStyle(v as typeof style)}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="inline">
                  Inline keyboard
                </ZoruSelectItem>
                <ZoruSelectItem value="keyboard">Reply keyboard</ZoruSelectItem>
                <ZoruSelectItem value="web_app_button">
                  Web app button (inline)
                </ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
        </div>
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!chatId.trim() || pending}
            style={{ backgroundColor: ACCENT }}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
//  Detail drawer (Overview / Sessions / Analytics / Settings)
// ---------------------------------------------------------------------------

type DetailTab = 'overview' | 'sessions' | 'analytics' | 'settings';

function DetailDrawer({
  app,
  open,
  onOpenChange,
  onEdit,
}: {
  app: MiniAppRow | null;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onEdit: () => void;
}) {
  const { toast } = useZoruToast();
  const { activeProjectId } = useProject();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, startLoadingSessions] = useTransition();
  const [analytics, setAnalytics] = useState<AnalyticsResp | null>(null);
  const [loadingAnalytics, startLoadingAnalytics] = useTransition();
  const [initData, setInitData] = useState('');
  const [initDataResult, setInitDataResult] = useState<{
    ok: boolean;
    body: string;
  } | null>(null);
  const [validating, startValidating] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTab('overview');
    setSessions([]);
    setAnalytics(null);
    setInitData('');
    setInitDataResult(null);
  }, [app?._id, open]);

  useEffect(() => {
    if (!app || !activeProjectId) return;
    if (tab === 'sessions' && sessions.length === 0) {
      startLoadingSessions(async () => {
        const res = await listTelegramMiniAppSessionsAction(
          app._id,
          activeProjectId,
          { limit: 100 },
        );
        if (res.error)
          toast({
            title: 'Sessions failed',
            description: res.error,
            variant: 'destructive',
          });
        setSessions(res.sessions ?? []);
      });
    }
    if (tab === 'analytics' && !analytics) {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      startLoadingAnalytics(async () => {
        const res = await getTelegramMiniAppAnalyticsAction(app._id, {
          projectId: activeProjectId,
          from,
          to,
        });
        if (res.error)
          toast({
            title: 'Analytics failed',
            description: res.error,
            variant: 'destructive',
          });
        setAnalytics(res);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, app?._id, activeProjectId]);

  if (!app) return null;

  const link = directLink(app.botUsername, app.slug);

  const onValidate = () => {
    if (!activeProjectId) return;
    startValidating(async () => {
      const res = await validateTelegramMiniAppInitDataAction({
        projectId: activeProjectId,
        appId: app._id,
        initData,
      });
      setInitDataResult({
        ok: res.success,
        body: JSON.stringify(
          res.success
            ? { user: res.user, authDate: res.authDate, queryId: res.queryId }
            : { error: res.error },
          null,
          2,
        ),
      });
    });
  };

  return (
    <ZoruDrawer open={open} onOpenChange={onOpenChange}>
      <ZoruDrawerContent className="max-h-[92vh]">
        <ZoruDrawerHeader>
          <ZoruDrawerTitle>
            {app.name}
            <span className="ml-2 text-[11px] text-zoru-ink-muted font-normal">
              @{app.botUsername || '—'} / {app.slug}
            </span>
          </ZoruDrawerTitle>
          <ZoruDrawerDescription>{app.description || ' '}</ZoruDrawerDescription>
        </ZoruDrawerHeader>

        {/* Segmented section nav */}
        <div className="flex gap-1 px-4">
          {(
            [
              ['overview', 'Overview'],
              ['sessions', 'Sessions'],
              ['analytics', 'Analytics'],
              ['settings', 'Settings'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px]',
                tab === k
                  ? 'bg-zoru-bg-muted text-zoru-ink'
                  : 'text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-4 py-3">
          {tab === 'overview' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={app.webAppUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-[12px] text-blue-500 hover:underline"
                >
                  <LinkIcon className="h-3.5 w-3.5" /> {app.webAppUrl}
                </a>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[12px] text-blue-500 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {link}
                  </a>
                )}
                <div className="ml-auto inline-flex overflow-hidden rounded-md border border-zoru-line">
                  <button
                    type="button"
                    onClick={() => setDevice('desktop')}
                    className={cn(
                      'px-2 py-1 text-[11px]',
                      device === 'desktop' && 'bg-zoru-bg-muted',
                    )}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevice('mobile')}
                    className={cn(
                      'px-2 py-1 text-[11px]',
                      device === 'mobile' && 'bg-zoru-bg-muted',
                    )}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex justify-center rounded-md border border-zoru-line bg-zoru-bg-muted p-3">
                <div
                  className="overflow-hidden rounded-md border border-zoru-line bg-white"
                  style={{
                    width: device === 'desktop' ? 720 : 360,
                    height: device === 'desktop' ? 480 : 640,
                    maxWidth: '100%',
                  }}
                >
                  <iframe
                    title={`Preview of ${app.name}`}
                    src={app.webAppUrl}
                    className="h-full w-full"
                  />
                </div>
              </div>
              <div className="rounded-md border border-zoru-line p-3">
                <div className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
                  Test init-data
                </div>
                <Textarea
                  value={initData}
                  onChange={(e) => setInitData(e.target.value)}
                  rows={4}
                  placeholder="Paste a Telegram WebApp initData string here…"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={onValidate}
                    disabled={!initData || validating}
                  >
                    {validating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Validate
                  </Button>
                  {initDataResult && (
                    <span
                      className={cn(
                        'text-[11px]',
                        initDataResult.ok
                          ? 'text-emerald-500'
                          : 'text-red-500',
                      )}
                    >
                      {initDataResult.ok ? 'Signature OK' : 'Signature failed'}
                    </span>
                  )}
                </div>
                {initDataResult && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-zoru-bg-muted p-2 text-[11px]">
                    {initDataResult.body}
                  </pre>
                )}
              </div>
            </div>
          )}

          {tab === 'sessions' && (
            <SessionsTable
              sessions={sessions}
              loading={loadingSessions}
            />
          )}

          {tab === 'analytics' && (
            <AnalyticsView analytics={analytics} loading={loadingAnalytics} />
          )}

          {tab === 'settings' && (
            <div className="flex flex-col gap-3">
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit mini app
              </Button>
              <div className="rounded-md border border-zoru-line p-3 text-[12px]">
                <div className="text-zoru-ink-muted">App id</div>
                <div className="font-mono text-zoru-ink">{app._id}</div>
                <div className="mt-2 text-zoru-ink-muted">Bot id</div>
                <div className="font-mono text-zoru-ink">{app.botId}</div>
                <div className="mt-2 text-zoru-ink-muted">Created</div>
                <div>{new Date(app.createdAt).toLocaleString()}</div>
                <div className="mt-2 text-zoru-ink-muted">Updated</div>
                <div>{new Date(app.updatedAt).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </ZoruDrawerContent>
    </ZoruDrawer>
  );
}

function SessionsTable({
  sessions,
  loading,
}: {
  sessions: SessionRow[];
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (sessions.length === 0)
    return (
      <div className="rounded-md border border-zoru-line p-6 text-center text-[12px] text-zoru-ink-muted">
        No validated sessions yet.
      </div>
    );
  return (
    <Table>
      <ZoruTableHeader>
        <ZoruTableRow>
          <ZoruTableHead>User</ZoruTableHead>
          <ZoruTableHead>User id</ZoruTableHead>
          <ZoruTableHead>Validated</ZoruTableHead>
          <ZoruTableHead>Device</ZoruTableHead>
        </ZoruTableRow>
      </ZoruTableHeader>
      <ZoruTableBody>
        {sessions.map((s) => (
          <ZoruTableRow key={s._id}>
            <ZoruTableCell>
              {s.username ? `@${s.username}` : s.firstName ?? '—'}
            </ZoruTableCell>
            <ZoruTableCell className="font-mono text-[11px]">
              {s.userId ?? '—'}
            </ZoruTableCell>
            <ZoruTableCell>
              {new Date(s.validatedAt).toLocaleString()}
            </ZoruTableCell>
            <ZoruTableCell>{s.device ?? '—'}</ZoruTableCell>
          </ZoruTableRow>
        ))}
      </ZoruTableBody>
    </Table>
  );
}

function AnalyticsView({
  analytics,
  loading,
}: {
  analytics: AnalyticsResp | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!analytics)
    return <div className="text-[12px] text-zoru-ink-muted">No data.</div>;
  const max = analytics.byDay.reduce((m, d) => Math.max(m, d.opens), 0) || 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Opens" value={analytics.opens} />
        <KpiCard label="Unique users" value={analytics.uniqueUsers} />
        <KpiCard
          label="Conversion"
          value={`${(analytics.conversion * 100).toFixed(1)}%`}
          hint="unique / opens"
        />
      </div>
      <div className="rounded-md border border-zoru-line p-3">
        <div className="mb-2 text-[11px] uppercase tracking-wider text-zoru-ink-muted">
          Opens by day
        </div>
        <div className="flex h-32 items-end gap-1">
          {analytics.byDay.length === 0 ? (
            <span className="text-[11px] text-zoru-ink-muted">No data.</span>
          ) : (
            analytics.byDay.map((d) => (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${d.date}: ${d.opens}`}
              >
                <div
                  className="w-full rounded-t"
                  style={{
                    backgroundColor: ACCENT,
                    height: `${(d.opens / max) * 100}%`,
                    minHeight: 2,
                  }}
                />
                <span className="text-[9px] text-zoru-ink-muted">
                  {d.date.slice(5)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Row actions menu
// ---------------------------------------------------------------------------

function RowActionsMenu({
  app,
  onOpen,
  onSend,
  onSetMenuButton,
  onEdit,
  onDelete,
  onCopyLink,
}: {
  app: MiniAppRow;
  onOpen: () => void;
  onSend: () => void;
  onSetMenuButton: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}) {
  return (
    <DropdownMenu>
      <ZoruDropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${app.name}`}
          className="rounded p-1 text-zoru-ink-muted hover:bg-zoru-bg-muted hover:text-zoru-ink"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </ZoruDropdownMenuTrigger>
      <ZoruDropdownMenuContent align="end">
        <ZoruDropdownMenuItem onClick={onOpen}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open detail
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onClick={onSend}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> Send to chat
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onClick={onSetMenuButton}>
          <Power className="mr-1.5 h-3.5 w-3.5" /> Set as menu button
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onClick={onCopyLink}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy direct link
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuSeparator />
        <ZoruDropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
        </ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onClick={onDelete} className="text-red-500">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
        </ZoruDropdownMenuItem>
      </ZoruDropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
//  Page
// ---------------------------------------------------------------------------

export default function MiniAppsPage() {
  const { toast } = useZoruToast();
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
    const list = await listTelegramBots(activeProjectId);
    setBots(
      (list ?? []).map((b) => ({
        _id: b._id,
        username: b.username,
        name: b.name,
      })),
    );
  }, [activeProjectId]);

  const loadRows = useCallback(() => {
    if (!activeProjectId) {
      setRows([]);
      return;
    }
    startLoading(async () => {
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
        const res = await getTelegramMiniAppAnalyticsAction(r._id, {
          projectId: activeProjectId,
          from,
          to,
        });
        opens += res.opens || 0;
        uniqueUsers += res.uniqueUsers || 0;
        perApp[r._id] = res.opens || 0;
      }),
    );
    setAnalytics7d({ opens, uniqueUsers, perApp });
  }, [activeProjectId, rows]);

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
          <ZoruPageHeading>
            <ZoruPageEyebrow>Telegram</ZoruPageEyebrow>
            <ZoruPageTitle>Telegram Mini Apps</ZoruPageTitle>
            <ZoruPageDescription>
              Pick a project to manage its Telegram Mini Apps.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
        <TelegramProjectGate />
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageEyebrow>Telegram · {activeProjectName ?? ''}</ZoruPageEyebrow>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-2">
              <LayoutGrid
                className="h-5 w-5"
                style={{ color: ACCENT }}
                aria-hidden
              />
              Telegram Mini Apps
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Register Web App URLs for your bots, send them as messages, set
            them as the bot's menu button, and validate incoming initData.
          </ZoruPageDescription>
        </ZoruPageHeading>
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
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-zoru-line bg-zoru-bg p-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, slug or URL…"
            className="pl-7"
          />
        </div>
        <Select value={botFilter} onValueChange={setBotFilter}>
          <ZoruSelectTrigger className="w-[180px]">
            <ZoruSelectValue placeholder="Bot" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All bots</ZoruSelectItem>
            {bots.map((b) => (
              <ZoruSelectItem key={b._id} value={b._id}>
                @{b.username || b.name}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <ZoruSelectTrigger className="w-[140px]">
            <ZoruSelectValue placeholder="Status" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
            <ZoruSelectItem value="active">Active</ZoruSelectItem>
            <ZoruSelectItem value="disabled">Disabled</ZoruSelectItem>
          </ZoruSelectContent>
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
              className="h-8 w-8 text-zoru-ink-muted"
              aria-hidden
            />
            <div className="text-[14px] text-zoru-ink">No mini apps yet</div>
            <div className="text-[12px] text-zoru-ink-muted">
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
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Bot</ZoruTableHead>
                <ZoruTableHead>Slug</ZoruTableHead>
                <ZoruTableHead>URL</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Opens (7 d)</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.map((r) => (
                <ZoruTableRow key={r._id}>
                  <ZoruTableCell>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailApp(r);
                        setDetailOpen(true);
                      }}
                      className="text-left text-zoru-ink hover:underline"
                    >
                      {r.name}
                    </button>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    @{r.botUsername || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px]">
                    {r.slug}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-[11px] text-zoru-ink-muted"
                        title={r.webAppUrl}
                      >
                        {truncate(r.webAppUrl, 36)}
                      </span>
                      <button
                        type="button"
                        aria-label="Copy URL"
                        onClick={() => copy(r.webAppUrl, 'URL copied')}
                        className="rounded p-1 text-zoru-ink-muted hover:bg-zoru-bg-muted hover:text-zoru-ink"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.status === 'active'}
                        onCheckedChange={(c) => onToggleStatus(r, c)}
                        aria-label={`Toggle ${r.name}`}
                      />
                      <StatusPill status={r.status} />
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {analytics7d.perApp[r._id] ?? 0}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
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
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
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
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-bg px-3 py-2 text-[12px] shadow"
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
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Delete mini app?</ZoruDialogTitle>
            <ZoruDialogDescription>
              {deleteApp
                ? `“${deleteApp.name}” will be removed from the registry. Existing menu-button bindings on Telegram are not removed automatically.`
                : ''}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
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
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
