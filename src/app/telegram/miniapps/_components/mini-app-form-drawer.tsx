'use client';

import { useState, useRef, useEffect, useTransition, useCallback, useMemo } from 'react';
import { Loader2, X as XIcon } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Textarea,
  cn,
  useZoruToast,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerFooter,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
} from '@/components/sabcrm/20ui/compat';
import { SabFileUrlInput } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import {
  createTelegramMiniAppAction,
  updateTelegramMiniAppAction,
} from '@/app/actions/telegram-extra.actions';
import type { MiniAppRow, UpsertBody, ThemeParams } from '@/lib/rust-client/telegram-mini-apps';

const ACCENT = '#229ED9';
const SLUG_RE = /^[a-z0-9_]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
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
            !valid && value && 'border-zoru-line/60',
          )}
          placeholder="#RRGGBB"
        />
      </div>
      {!valid && value ? (
        <span className="text-[10px] text-zoru-ink">Expected #RRGGBB</span>
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
          className="inline-flex items-center gap-1 rounded-full bg-zoru-bg-zoru-surface-2 px-2 py-0.5 text-[11px] text-zoru-ink"
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

export function MiniAppFormDrawer({
  open,
  onOpenChange,
  bots,
  initial,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  bots: { _id: string; username: string; name: string }[];
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
      try {
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
      } catch (e) {
        toast({
          title: 'Could not save',
          description: String(e),
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
                  !slugValid && form.slug && 'border-zoru-line/60',
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
                  !urlValid && form.webAppUrl && 'border-zoru-line/60',
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
