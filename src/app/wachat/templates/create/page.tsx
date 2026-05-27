'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import { Suspense, useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  Send,
  Image as ImageIcon,
  Video,
  FileText,
  RefreshCw,
  Sparkles,
  Globe,
  MapPin,
  Copy,
  ExternalLink,
  Phone,
  CircleAlert,
  Eye,
  EyeOff,
  Variable,
  Sun,
  Moon,
  CircleCheck,
  CircleX,
  TriangleAlert,
  Languages as LanguagesIcon,
  Hash,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { handleCreateTemplate } from '@/app/actions/template.actions';
import { useTemplateStore } from '../template-store';

import {
  WaPage,
  PageHeader,
  WaButton,
  PhoneFrame,
  ChatBubble,
  EmptyState,
} from '@/components/wachat-ui';

import * as React from 'react';

import { Field } from './components/Field';
import { HeaderEditor } from './components/HeaderEditor';
import { BodyEditor } from './components/BodyEditor';
import { ButtonManager } from './components/ButtonManager';
import {
  LANGUAGES,
  CATEGORIES,
  TEMPLATE_TYPES,
  ButtonData,
} from './constants';

/* ── WhatsApp byte/char limits (per Cloud API spec) ────────────── */

const LIMITS = {
  body: 1024,
  header: 60,
  footer: 60,
  button: 25,
  maxButtons: 10, // 3 quick reply + URL/phone combos
};

/* ── Live phone preview (dark + light variants share one render) */

function PreviewBody({
  headerFormat,
  headerText,
  body,
  footer,
  buttons,
  templateType,
  reduceMotion,
}: {
  headerFormat: string;
  headerText: string;
  body: string;
  footer: string;
  buttons: ButtonData[];
  templateType: string;
  reduceMotion: boolean | null;
}) {
  const mediaIcon =
    headerFormat === 'IMAGE'
      ? ImageIcon
      : headerFormat === 'VIDEO'
      ? Video
      : headerFormat === 'DOCUMENT'
      ? FileText
      : headerFormat === 'LOCATION'
      ? MapPin
      : null;

  const bodyText =
    templateType === 'AUTH'
      ? `*123456* is your verification code.`
      : body || 'Your message body will appear here…';

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {mediaIcon && (
        <m.div
          key={`media-${headerFormat}`}
          layout
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="flex justify-start"
        >
          <div className="grid h-24 w-[80%] place-items-center rounded-2xl rounded-bl-sm bg-white/95 shadow-sm">
            {React.createElement(mediaIcon, {
              className: 'h-7 w-7 text-emerald-700/60',
              strokeWidth: 1.75,
              'aria-hidden': true,
            })}
          </div>
        </m.div>
      )}

      {headerFormat === 'TEXT' && headerText && (
        <m.div key="header-text" layout transition={{ duration: 0.25, ease: EASE_OUT }}>
          <ChatBubble
            who="them"
            text={<span className="text-[12.5px] font-semibold text-zinc-900">{headerText}</span>}
          />
        </m.div>
      )}

      <m.div key="body" layout transition={{ duration: 0.25, ease: EASE_OUT }}>
        <ChatBubble
          who="them"
          text={
            <div className="space-y-1">
              <p className="whitespace-pre-wrap">{bodyText}</p>
              {footer && <p className="pt-1 text-[10px] text-zinc-500">{footer}</p>}
            </div>
          }
          time="12:00 PM"
        />
      </m.div>

      {buttons.length > 0 && (
        <m.div
          key="buttons"
          layout
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="space-y-1 pt-1"
        >
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-white/95 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-700 shadow-sm"
            >
              {btn.type === 'URL' && <ExternalLink className="h-3 w-3" strokeWidth={2.25} />}
              {btn.type === 'PHONE_NUMBER' && <Phone className="h-3 w-3" strokeWidth={2.25} />}
              {btn.type === 'COPY_CODE' && <Copy className="h-3 w-3" strokeWidth={2.25} />}
              {btn.text || `Button ${i + 1}`}
            </div>
          ))}
        </m.div>
      )}

      {templateType === 'AUTH' && (
        <m.div
          key="auth-copy"
          layout
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="pt-1"
        >
          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-white/95 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-700 shadow-sm">
            <Copy className="h-3 w-3" strokeWidth={2.25} /> Copy code
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/* ── Variable inspector ─────────────────────────────────────────── */

function VariableInspector({
  body,
  values,
  onChange,
}: {
  body: string;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const vars = useMemo(() => {
    const matches = Array.from(body.matchAll(/{{\s*(\d+)\s*}}/g));
    return Array.from(new Set(matches.map((m) => m[1]))).sort(
      (a, b) => Number(a) - Number(b),
    );
  }, [body]);

  if (vars.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-center text-[11px] text-zinc-500">
        No variables detected. Use {`{{1}}, {{2}}`} in the body to add placeholders.
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {vars.map((v) => (
        <li key={v} className="flex items-center gap-2">
          <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-zinc-200 bg-white font-mono text-[10.5px] font-semibold text-zinc-700">
            {`{{${v}}}`}
          </span>
          <Input
            value={values[v] ?? ''}
            onChange={(e) => onChange({ ...values, [v]: e.target.value })}
            placeholder={`Sample for {{${v}}}`}
            className="h-7 text-[12px]"
          />
        </li>
      ))}
    </ul>
  );
}

/* ── Validation panel ──────────────────────────────────────────── */

type Check = { ok: boolean; severity: 'error' | 'warn' | 'info'; label: string };

function ValidationPanel({ checks }: { checks: Check[] }) {
  return (
    <ul className="divide-y divide-zinc-100">
      {checks.map((c, i) => {
        const Icon = c.ok ? CircleCheck : c.severity === 'error' ? CircleX : TriangleAlert;
        const color = c.ok
          ? 'text-emerald-600'
          : c.severity === 'error'
          ? 'text-rose-600'
          : 'text-amber-600';
        return (
          <li key={i} className="flex items-start gap-2 py-1.5 text-[11.5px]">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} strokeWidth={2.25} aria-hidden />
            <span className={c.ok ? 'text-zinc-600' : 'text-zinc-900'}>{c.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Limit bar ─────────────────────────────────────────────────── */

function LimitBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const over = used > limit;
  const near = !over && pct >= 80;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="font-semibold uppercase tracking-[0.06em] text-zinc-500">{label}</span>
        <span
          className={`tabular-nums ${
            over ? 'text-rose-600' : near ? 'text-amber-600' : 'text-zinc-600'
          }`}
        >
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            over ? 'bg-rose-500' : near ? 'bg-amber-500' : ''
          }`}
          style={{
            width: `${Math.min(100, pct)}%`,
            background: over || near ? undefined : 'var(--mt-accent)',
          }}
        />
      </div>
    </div>
  );
}

/* ── Multi-language selector ───────────────────────────────────── */

function MultiLanguageSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (langs: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={2} /> Clone to multiple languages
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-900">
          <Globe className="h-3.5 w-3.5" strokeWidth={2} /> Multi-language cloning
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-zinc-500 hover:text-zinc-900"
        >
          Close
        </button>
      </div>
      <p className="text-[11.5px] text-zinc-500">
        After creating the primary template, clones will be auto-created for selected languages.
      </p>
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {LANGUAGES.map((l) => {
          const isSelected = selected.includes(l.code);
          return (
            <button
              key={l.code}
              type="button"
              onClick={() =>
                onChange(
                  isSelected ? selected.filter((s) => s !== l.code) : [...selected, l.code],
                )
              }
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors active:scale-[0.97]',
                isSelected
                  ? 'border-transparent text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-900 hover:text-zinc-900',
              )}
              style={isSelected ? { backgroundColor: 'var(--mt-accent)' } : undefined}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-[11px] font-semibold" style={{ color: 'var(--mt-accent)' }}>
          {selected.length} language(s) selected for cloning
        </p>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */

function CreateTemplateContent() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const { activeProject } = useProject();
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const [isPending, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  // Template state
  const [templateType, setTemplateType] = useState('STANDARD');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en_US');
  const [headerFormat, setHeaderFormat] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState<ButtonData[]>([]);

  // Auth OTP state
  const [otpType, setOtpType] = useState<'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP'>('COPY_CODE');
  const [codeExpiry, setCodeExpiry] = useState('10');

  // LTO state
  const [ltoExpiry, setLtoExpiry] = useState('');
  const [ltoCoupon, setLtoCoupon] = useState('');

  // SabNode features
  const [cloneLanguages, setCloneLanguages] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark' | 'both'>('both');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const templateToAction = useTemplateStore((s) => s.templateToAction);

  useEffect(() => {
    if (action === 'clone' && templateToAction) {
      setName(templateToAction.name + '_clone');
      setCategory(templateToAction.category);
      setLanguage(templateToAction.language);
      setBody(templateToAction.body);

      const header = templateToAction.components.find((c: any) => c.type === 'HEADER');
      if (header) {
        setHeaderFormat(header.format || 'NONE');
        if (header.text) setHeaderText(header.text);
      }

      const footerComp = templateToAction.components.find((c: any) => c.type === 'FOOTER');
      if (footerComp) setFooter(footerComp.text || '');

      const btns = templateToAction.components.find((c: any) => c.type === 'BUTTONS');
      if (btns && btns.buttons) setButtons(btns.buttons);
    }
  }, [action, templateToAction]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Derived metrics
  const charCount = body.length;
  const varCount = (body.match(/{{\s*\d+\s*}}/g) || []).length;
  const headerLen = headerText.length;
  const footerLen = footer.length;

  // Validation checks
  const checks = useMemo<Check[]>(() => {
    const out: Check[] = [];
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    out.push({
      ok: !!name.trim() && slug.length >= 3 && slug.length <= 512,
      severity: 'error',
      label: 'Name is lowercase, snake_case, 3-512 chars (auto-formatted on submit).',
    });
    out.push({
      ok: templateType === 'AUTH' || !!body.trim(),
      severity: 'error',
      label: 'Body text is present.',
    });
    out.push({
      ok: body.length <= LIMITS.body,
      severity: 'error',
      label: `Body is within ${LIMITS.body} characters.`,
    });
    if (headerFormat === 'TEXT') {
      out.push({
        ok: headerText.length > 0 && headerText.length <= LIMITS.header,
        severity: 'error',
        label: `Text header is 1-${LIMITS.header} characters.`,
      });
    }
    if (footer) {
      out.push({
        ok: footer.length <= LIMITS.footer,
        severity: 'error',
        label: `Footer is within ${LIMITS.footer} characters.`,
      });
    }
    // Variable continuity
    const matches = Array.from(body.matchAll(/{{\s*(\d+)\s*}}/g)).map((m) => Number(m[1]));
    const uniq = Array.from(new Set(matches)).sort((a, b) => a - b);
    const continuous = uniq.every((n, idx) => n === idx + 1);
    if (uniq.length > 0) {
      out.push({
        ok: continuous,
        severity: 'error',
        label: 'Variables are numbered sequentially starting at 1 ({{1}}, {{2}}, …).',
      });
    }
    // Salesy CTA hint
    const salesy = /\b(click here|buy now|act fast|limited offer|free!)\b/i.test(body);
    out.push({
      ok: !salesy,
      severity: 'warn',
      label: 'No overly salesy phrases (avoid "buy now", "click here", "act fast").',
    });
    // URL lowercase hint
    const urls = body.match(/https?:\/\/\S+/g) ?? [];
    const allLower = urls.every((u) => u === u.toLowerCase());
    if (urls.length > 0) {
      out.push({
        ok: allLower,
        severity: 'warn',
        label: 'URLs in body are lowercase.',
      });
    }
    // Button count
    out.push({
      ok: buttons.length <= LIMITS.maxButtons,
      severity: 'error',
      label: `Maximum ${LIMITS.maxButtons} buttons.`,
    });
    // Button label lengths
    const longBtn = buttons.find((b) => (b.text ?? '').length > LIMITS.button);
    out.push({
      ok: !longBtn,
      severity: 'error',
      label: `Each button label is within ${LIMITS.button} characters.`,
    });
    return out;
  }, [name, body, headerFormat, headerText, footer, buttons, templateType]);

  const errors = checks.filter((c) => !c.ok && c.severity === 'error').length;
  const warnings = checks.filter((c) => !c.ok && c.severity === 'warn').length;

  const handleSubmit = () => {
    if (!activeProject?._id || !name.trim() || !body.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Name and body are required.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set('projectId', activeProject._id.toString());
      formData.set(
        'name',
        name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      );
      formData.set('category', templateType === 'AUTH' ? 'AUTHENTICATION' : category);
      formData.set('language', language);
      formData.set(
        'templateType',
        templateType === 'CAROUSEL'
          ? 'MARKETING_CAROUSEL'
          : templateType === 'CATALOG'
          ? 'CATALOG_MESSAGE'
          : 'STANDARD',
      );

      formData.set('headerFormat', templateType === 'AUTH' ? 'NONE' : headerFormat);
      if (headerFormat === 'TEXT') formData.set('headerText', headerText);
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && headerMediaUrl) {
        formData.set('headerMediaUrl', headerMediaUrl);
      }

      if (templateType === 'AUTH') {
        formData.set(
          'body',
          `{{1}} is your verification code. This code expires in ${codeExpiry} minutes.`,
        );
      } else {
        formData.set('body', body);
      }

      if (footer) formData.set('footer', footer);

      if (templateType === 'AUTH') {
        formData.set(
          'buttons',
          JSON.stringify([{ type: 'COPY_CODE', text: 'Copy Code', example: ['123456'] }]),
        );
      } else if (templateType === 'LTO') {
        const ltoButtons: ButtonData[] = [
          { type: 'COPY_CODE', text: 'Get Offer', example: [ltoCoupon || 'SAVE20'] },
        ];
        formData.set('buttons', JSON.stringify(ltoButtons));
      } else {
        formData.set('buttons', JSON.stringify(buttons));
      }

      const result = await handleCreateTemplate(
        { message: null, error: null, payload: null, debugInfo: null },
        formData,
      );

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({
          title: 'Success',
          description: result.message || 'Template submitted for approval.',
        });
        router.push('/wachat/templates');
      }
    });
  };

  if (!activeProject) {
    return (
      <WaPage>
        <PageHeader
          title={action === 'clone' ? 'Clone template' : 'Create template'}
          description="Compose a WhatsApp Cloud API template. Submit for Meta approval when ready."
          kicker="Wachat · templates"
          backHref="/wachat/templates"
        />
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Choose a project from the picker to create templates."
          action={
            <WaButton href="/wachat" leftIcon={Sparkles}>
              Choose a project
            </WaButton>
          }
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title={action === 'clone' ? 'Clone template' : 'Create template'}
        description="Compose a WhatsApp Cloud API template. Live preview, variable inspector, and Meta policy checks update as you type."
        kicker={`Wachat · ${activeProject.name}`}
        backHref="/wachat/templates"
        actions={
          <>
            <div className="hidden items-center gap-1 rounded-full border border-zinc-200 bg-white p-0.5 sm:inline-flex">
              {(['light', 'both', 'dark'] as const).map((m) => {
                const isActive = previewMode === m;
                const Icon = m === 'light' ? Sun : m === 'dark' ? Moon : Eye;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPreviewMode(m)}
                    aria-pressed={isActive}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors capitalize"
                    style={{
                      color: isActive ? '#ffffff' : '#52525b',
                      background: isActive ? 'var(--mt-accent)' : 'transparent',
                    }}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    {m}
                  </button>
                );
              })}
            </div>
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              leftIcon={showPreview ? EyeOff : Eye}
            >
              {showPreview ? 'Hide preview' : 'Show preview'}
            </WaButton>
          </>
        }
      />

      {/* Template type selector */}
      <m.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {TEMPLATE_TYPES.map((t, i) => {
          const Icon = t.icon;
          const isActive = templateType === t.id;
          return (
            <m.button
              key={t.id}
              type="button"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.03 + i * 0.04, ease: EASE_OUT }}
              onClick={() => {
                setTemplateType(t.id);
                setButtons([]);
                setHeaderFormat('NONE');
              }}
              className="group relative flex flex-col items-center gap-1.5 rounded-xl border bg-white p-3.5 text-center transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px] active:scale-[0.97]"
              style={{
                borderColor: isActive ? 'var(--mt-accent)' : '#e4e4e7',
                boxShadow: isActive ? '0 18px 40px -22px var(--mt-accent-glow)' : 'none',
              }}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{
                  background: isActive ? 'var(--mt-accent-soft)' : '#fafafa',
                  color: isActive ? 'var(--mt-accent)' : '#71717a',
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span
                className={cn(
                  'text-[12px] font-semibold',
                  isActive ? 'text-zinc-950' : 'text-zinc-700',
                )}
              >
                {t.name}
              </span>
              <span className="text-[10.5px] leading-tight text-zinc-500">{t.desc}</span>
            </m.button>
          );
        })}
      </m.div>

      <div
        className={cn(
          'grid gap-5',
          showPreview ? 'lg:grid-cols-[1fr_380px]' : 'lg:grid-cols-1',
        )}
      >
        {/* Editor column */}
        <div className="space-y-3">
          <Card>
            <ZoruCardContent className="space-y-4 pt-5">
              <h3 className="text-[13px] font-semibold tracking-tight text-zinc-900">
                Template details
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name" required>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., order_confirmation"
                    required
                  />
                </Field>
                {templateType !== 'AUTH' && (
                  <Field label="Category" required>
                    <Select value={category} onValueChange={setCategory}>
                      <ZoruSelectTrigger>
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {CATEGORIES.map((c) => (
                          <ZoruSelectItem key={c.id} value={c.id}>
                            {c.name}
                          </ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="Language" required>
                  <Select value={language} onValueChange={setLanguage}>
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent className="max-h-72">
                      {LANGUAGES.map((l) => (
                        <ZoruSelectItem key={l.code} value={l.code}>
                          {l.name}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </Field>
              </div>
            </ZoruCardContent>
          </Card>

          {templateType === 'AUTH' && (
            <Card>
              <ZoruCardContent className="space-y-4 pt-5">
                <h3 className="text-[13px] font-semibold tracking-tight text-zinc-900">
                  Authentication settings
                </h3>
                <Field label="OTP type">
                  <Select value={otpType} onValueChange={(v) => setOtpType(v as any)}>
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="COPY_CODE">Copy code button</ZoruSelectItem>
                      <ZoruSelectItem value="ONE_TAP">One-tap autofill</ZoruSelectItem>
                      <ZoruSelectItem value="ZERO_TAP">Zero-tap (auto-verify)</ZoruSelectItem>
                    </ZoruSelectContent>
                  </Select>
                </Field>
                <Field label="Code expiry (minutes)">
                  <Input
                    value={codeExpiry}
                    onChange={(e) => setCodeExpiry(e.target.value)}
                    placeholder="10"
                  />
                </Field>
                <div
                  className="rounded-lg p-3 text-[11.5px] text-zinc-700"
                  style={{ background: 'var(--mt-accent-soft)' }}
                >
                  <p className="mb-1 font-semibold text-zinc-900">Auto-generated body:</p>
                  <p className="font-mono">{`{{1}} is your verification code. This code expires in ${codeExpiry} minutes.`}</p>
                </div>
              </ZoruCardContent>
            </Card>
          )}

          {templateType === 'LTO' && (
            <Card>
              <ZoruCardContent className="space-y-4 pt-5">
                <h3 className="text-[13px] font-semibold tracking-tight text-zinc-900">
                  Limited time offer
                </h3>
                <Field
                  label="Offer expiry"
                  hint="When the offer expires (shown as countdown)"
                >
                  <Input
                    type="datetime-local"
                    value={ltoExpiry}
                    onChange={(e) => setLtoExpiry(e.target.value)}
                  />
                </Field>
                <Field label="Coupon code">
                  <Input
                    value={ltoCoupon}
                    onChange={(e) => setLtoCoupon(e.target.value)}
                    placeholder="SAVE20"
                  />
                </Field>
              </ZoruCardContent>
            </Card>
          )}

          {(templateType === 'STANDARD' ||
            templateType === 'LTO' ||
            templateType === 'CAROUSEL') && (
            <Card>
              <ZoruCardContent className="space-y-4 pt-5">
                <h3 className="text-[13px] font-semibold tracking-tight text-zinc-900">
                  {templateType === 'CAROUSEL' ? 'Carousel introduction' : 'Message content'}
                </h3>

                {templateType === 'STANDARD' && (
                  <HeaderEditor
                    headerFormat={headerFormat}
                    setHeaderFormat={setHeaderFormat}
                    headerText={headerText}
                    setHeaderText={setHeaderText}
                    headerMediaUrl={headerMediaUrl}
                    setHeaderMediaUrl={setHeaderMediaUrl}
                  />
                )}

                <BodyEditor body={body} setBody={setBody} footer={footer} setFooter={setFooter} />
              </ZoruCardContent>
            </Card>
          )}

          {(templateType === 'STANDARD' || templateType === 'CAROUSEL') && (
            <Card>
              <ZoruCardContent className="space-y-3 pt-5">
                <ButtonManager buttons={buttons} setButtons={setButtons} />
              </ZoruCardContent>
            </Card>
          )}

          <Card>
            <ZoruCardContent className="space-y-3 pt-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: 'var(--mt-accent)' }} />
                <h3 className="text-[13px] font-semibold tracking-tight text-zinc-900">
                  SabNode features
                </h3>
              </div>
              <MultiLanguageSelector selected={cloneLanguages} onChange={setCloneLanguages} />
            </ZoruCardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <WaButton
              onClick={() => setConfirmOpen(true)}
              disabled={isPending || errors > 0 || !name.trim() || (!body.trim() && templateType !== 'AUTH')}
              leftIcon={isPending ? RefreshCw : Send}
            >
              {isPending ? 'Submitting' : 'Submit for approval'}
            </WaButton>
            <WaButton
              variant="ghost"
              size="sm"
              onClick={() => router.push('/wachat/templates')}
            >
              Cancel
            </WaButton>
            <span className="ml-auto inline-flex items-center gap-2 text-[11px]">
              {errors > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                  <CircleX className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {errors} blocking
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <CircleCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Ready
                </span>
              )}
              {warnings > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                  <TriangleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {warnings} warning{warnings > 1 ? 's' : ''}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Preview column */}
        {showPreview && (
          <aside className="hidden lg:block">
            <div className="sticky top-5 space-y-3">
              {/* Phone preview - dual mode */}
              <div className={previewMode === 'both' ? 'grid grid-cols-2 gap-3' : ''}>
                {(previewMode === 'light' || previewMode === 'both') && (
                  <div className="space-y-1.5">
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      <Sun className="h-2.5 w-2.5" strokeWidth={2.25} /> Light
                    </p>
                    <PhoneFrame
                      title={activeProject?.name ?? 'Wachat Business'}
                      subtitle="online"
                    >
                      <PreviewBody
                        headerFormat={headerFormat}
                        headerText={headerText}
                        body={body}
                        footer={footer}
                        buttons={buttons}
                        templateType={templateType}
                        reduceMotion={reduceMotion}
                      />
                    </PhoneFrame>
                  </div>
                )}
                {(previewMode === 'dark' || previewMode === 'both') && (
                  <div className="space-y-1.5">
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      <Moon className="h-2.5 w-2.5" strokeWidth={2.25} /> Dark
                    </p>
                    <div className="[&_.bg-white\\/95]:bg-zinc-800/95 [&_.bg-white\\/95]:text-zinc-100 [&_.text-emerald-700]:text-emerald-300 [&_.text-zinc-800]:text-zinc-100 [&_.text-zinc-900]:text-zinc-50 [&_.text-zinc-500]:text-zinc-400 [&_.text-zinc-600]:text-zinc-300 [&_.text-emerald-700\\/60]:text-emerald-200/70">
                      <PhoneFrame
                        title={activeProject?.name ?? 'Wachat Business'}
                        subtitle="online"
                      >
                        <PreviewBody
                          headerFormat={headerFormat}
                          headerText={headerText}
                          body={body}
                          footer={footer}
                          buttons={buttons}
                          templateType={templateType}
                          reduceMotion={reduceMotion}
                        />
                      </PhoneFrame>
                    </div>
                  </div>
                )}
              </div>

              {/* Limits */}
              <div className="space-y-2.5 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3 text-zinc-500" strokeWidth={2.25} aria-hidden />
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Limits
                  </span>
                </div>
                <LimitBar used={charCount} limit={LIMITS.body} label="Body" />
                {headerFormat === 'TEXT' && (
                  <LimitBar used={headerLen} limit={LIMITS.header} label="Header" />
                )}
                {footer && <LimitBar used={footerLen} limit={LIMITS.footer} label="Footer" />}
                <LimitBar used={buttons.length} limit={LIMITS.maxButtons} label="Buttons" />
              </div>

              {/* Variable inspector */}
              <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    <Variable className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Variables
                  </span>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-600">
                    {varCount}
                  </span>
                </div>
                <VariableInspector
                  body={templateType === 'AUTH' ? '{{1}}' : body}
                  values={variableValues}
                  onChange={setVariableValues}
                />
              </div>

              {/* Validation panel */}
              <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    <CircleCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Policy checks
                  </span>
                  <span className="text-[10px] tabular-nums text-zinc-500">
                    {checks.filter((c) => c.ok).length} / {checks.length}
                  </span>
                </div>
                <ValidationPanel checks={checks} />
              </div>

              {/* Clone summary */}
              {cloneLanguages.length > 0 && (
                <div
                  className="flex items-center gap-2 rounded-xl border p-3 text-[11.5px]"
                  style={{ borderColor: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
                >
                  <LanguagesIcon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  <span className="font-semibold">
                    +{cloneLanguages.length} language clone{cloneLanguages.length > 1 ? 's' : ''}
                  </span>
                  <span className="ml-auto text-zinc-500">on submit</span>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Submit for Meta approval?</ZoruDialogTitle>
            <ZoruDialogDescription>
              Once submitted, this template will be reviewed by Meta. You will not be able to edit
              it until approved or rejected.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                handleSubmit();
              }}
              disabled={isPending}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Submit
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}

export default function CreateTemplatePage() {
  return (
    <Suspense
      fallback={
        <WaPage>
          <div className="h-9 w-64 animate-pulse rounded-lg bg-zinc-100" />
          <div className="mt-4 h-3 w-80 animate-pulse rounded-full bg-zinc-100" />
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-xl border border-zinc-200 bg-white" />
              ))}
            </div>
            <div className="h-[460px] animate-pulse rounded-[2.2rem] border border-zinc-200 bg-white" />
          </div>
        </WaPage>
      }
    >
      <CreateTemplateContent />
    </Suspense>
  );
}
