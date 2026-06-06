'use client';

import { useState, useRef, useEffect, useTransition, useCallback, useMemo } from 'react';
import {
  Button,
  ColorPicker,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tag,
  Textarea,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import {
  createTelegramMiniAppAction,
  updateTelegramMiniAppAction,
} from '@/app/actions/telegram-extra.actions';
import type { MiniAppRow, UpsertBody, ThemeParams } from '@/lib/rust-client/telegram-mini-apps';

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
    <Field
      label={label}
      error={!valid && value ? 'Expected #RRGGBB' : undefined}
    >
      <ColorPicker value={value || '#000000'} onChange={onChange} />
    </Field>
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
    <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1.5">
      {value.map((v) => (
        <Tag key={v} onRemove={() => onChange(value.filter((x) => x !== v))} removeLabel={`Remove ${v}`}>
          {v}
        </Tag>
      ))}
      <Input
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
        aria-label="Add allowed domain"
        className="flex-1 min-w-[140px] border-0 bg-transparent px-0"
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
  const { toast } = useToast();
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
            tone: 'success',
          });
          onSaved();
          onOpenChange(false);
        } else {
          toast({
            title: 'Could not save',
            description: res.error,
            tone: 'danger',
          });
        }
      } catch (e) {
        toast({
          title: 'Could not save',
          description: String(e),
          tone: 'danger',
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'edit' ? 'Edit mini app' : 'New mini app'}
          </DrawerTitle>
          <DrawerDescription>
            Register a Telegram Web App URL for one of your bots. Users open
            it from a chat or the bot&apos;s menu button.
          </DrawerDescription>
        </DrawerHeader>

        <div className="grid gap-6 overflow-y-auto px-4 py-2 md:grid-cols-2">
          {/* ------- Basics ------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-medium text-[var(--st-text)]">Basics</h3>
            <Field label="Bot">
              <Select
                value={form.botId}
                onValueChange={(v) => setForm((p) => ({ ...p, botId: v }))}
                disabled={mode === 'edit'}
              >
                <SelectTrigger aria-label="Bot">
                  <SelectValue placeholder="Select a bot" />
                </SelectTrigger>
                <SelectContent>
                  {bots.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      @{b.username || b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Name">
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
            </Field>

            <Field
              label="Slug"
              help="Used in the t.me direct link. Lowercase letters, digits, underscores only."
            >
              <Input
                value={form.slug}
                onChange={(e) => {
                  slugTouchedRef.current = true;
                  setForm((p) => ({ ...p, slug: e.target.value }));
                }}
                placeholder="my_mini_app"
                invalid={!slugValid && !!form.slug}
                className="font-mono"
              />
            </Field>

            <Field label="Web App URL">
              <Input
                value={form.webAppUrl}
                onChange={(e) =>
                  setForm((p) => ({ ...p, webAppUrl: e.target.value }))
                }
                placeholder="https://example.com/app"
                invalid={!urlValid && !!form.webAppUrl}
              />
            </Field>

            <Field label="Short name (optional)">
              <Input
                value={form.shortName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, shortName: e.target.value }))
                }
              />
            </Field>

            <Field label="Description (optional)">
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={3}
              />
            </Field>
          </section>

          {/* ------- Branding + Theme ------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-medium text-[var(--st-text)]">Branding</h3>
            <Field label="Photo (SabFiles)">
              <SabFileUrlInput
                value={form.photoUrl}
                onChange={(v) => setForm((p) => ({ ...p, photoUrl: v }))}
                accept="image"
                placeholder="Pick or upload an image"
              />
            </Field>
            <Field label="Default button label">
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
            </Field>

            <h3 className="mt-2 text-[12px] font-medium text-[var(--st-text)]">
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
            <div className="mt-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--st-text-secondary)]">
                Preview
              </div>
              <div
                className="rounded-[var(--st-radius)] p-3"
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
                <span
                  className="text-[12px] underline"
                  style={{ color: form.themeParams.link_color }}
                >
                  link text
                </span>
                <div className="mt-2">
                  <span
                    className="inline-block rounded px-3 py-1.5 text-[12px]"
                    style={{
                      backgroundColor: form.themeParams.button_color,
                      color: form.themeParams.button_text_color,
                    }}
                  >
                    {form.defaultButtonLabel || 'Open'}
                  </span>
                </div>
              </div>
            </div>

            <h3 className="mt-2 text-[12px] font-medium text-[var(--st-text)]">
              Allowed domains
            </h3>
            <ChipInput
              value={form.allowedDomains}
              onChange={(v) => setForm((p) => ({ ...p, allowedDomains: v }))}
              placeholder="example.com"
            />

            <div className="mt-2 flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2">
              <div>
                <div className="text-[12px] text-[var(--st-text)]">Status</div>
                <div className="text-[11px] text-[var(--st-text-secondary)]">
                  Disabled mini apps do not accept opens.
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
                aria-label="Mini app status"
              />
            </div>
          </section>
        </div>

        <DrawerFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={!canSubmit}
            loading={saving}
          >
            {mode === 'edit' ? 'Save changes' : 'Create mini app'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
