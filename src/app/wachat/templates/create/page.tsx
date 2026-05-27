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
import { Suspense, useState, useTransition, useEffect } from 'react';
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

/* ── Live phone preview ────────────────────────────────────────── */

function PreviewPane({
  headerFormat,
  headerText,
  body,
  footer,
  buttons,
  templateType,
  projectName,
  reduceMotion,
}: {
  headerFormat: string;
  headerText: string;
  body: string;
  footer: string;
  buttons: ButtonData[];
  templateType: string;
  projectName: string;
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
    <PhoneFrame title={projectName || 'Wachat Business'} subtitle="online">
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
    </PhoneFrame>
  );
}

/* ── Multi-language selector (compact) ─────────────────────────── */

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
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
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

  const charCount = body.length;
  const varCount = (body.match(/{{\s*\d+\s*}}/g) || []).length;

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
        description="Compose a WhatsApp Cloud API template. Submit for Meta approval when ready."
        kicker={`Wachat · ${activeProject.name}`}
        backHref="/wachat/templates"
        actions={
          <WaButton
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            leftIcon={showPreview ? EyeOff : Eye}
          >
            {showPreview ? 'Hide preview' : 'Show preview'}
          </WaButton>
        }
      />

      {/* Template type selector */}
      <m.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5"
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
              className="group relative flex flex-col items-center gap-1.5 rounded-2xl border bg-white p-4 text-center transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px] active:scale-[0.97]"
              style={{
                borderColor: isActive ? 'var(--mt-accent)' : '#e4e4e7',
                boxShadow: isActive ? '0 18px 40px -22px var(--mt-accent-glow)' : 'none',
              }}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-xl"
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
          'grid gap-6',
          showPreview ? 'lg:grid-cols-[1fr_360px]' : 'lg:grid-cols-1',
        )}
      >
        {/* Editor column */}
        <div className="space-y-4">
          <Card>
            <ZoruCardContent className="space-y-4 pt-6">
              <h3 className="text-[13px] font-semibold tracking-tight text-zinc-900">
                Template details
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
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
              <ZoruCardContent className="space-y-4 pt-6">
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
                  className="rounded-xl p-3 text-[11.5px] text-zinc-700"
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
              <ZoruCardContent className="space-y-4 pt-6">
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
              <ZoruCardContent className="space-y-4 pt-6">
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
              <ZoruCardContent className="space-y-3 pt-6">
                <ButtonManager buttons={buttons} setButtons={setButtons} />
              </ZoruCardContent>
            </Card>
          )}

          <Card>
            <ZoruCardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: 'var(--mt-accent)' }} />
                <h3 className="text-[13px] font-semibold tracking-tight text-zinc-900">
                  SabNode features
                </h3>
              </div>
              <MultiLanguageSelector selected={cloneLanguages} onChange={setCloneLanguages} />
            </ZoruCardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <WaButton
              onClick={() => setConfirmOpen(true)}
              disabled={isPending || !name.trim() || (!body.trim() && templateType !== 'AUTH')}
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
          </div>
        </div>

        {/* Preview column */}
        {showPreview && (
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <PreviewPane
                headerFormat={headerFormat}
                headerText={headerText}
                body={body}
                footer={footer}
                buttons={buttons}
                templateType={templateType}
                projectName={activeProject?.name ?? 'Wachat Business'}
                reduceMotion={reduceMotion}
              />
              <div className="space-y-1 text-center">
                <p className="text-[11px] tabular-nums text-zinc-500">
                  {charCount}/1024 characters
                </p>
                <p className="text-[11px] tabular-nums text-zinc-500">
                  {varCount} variable{varCount === 1 ? '' : 's'} detected
                </p>
                {cloneLanguages.length > 0 && (
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: 'var(--mt-accent)' }}
                  >
                    {cloneLanguages.length} language clone(s)
                  </p>
                )}
              </div>
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
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
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
