'use client';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Modal,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Callout,
  Badge,
  Spinner,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Suspense,
  useState,
  useTransition,
  useEffect,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Video,
  FileText,
  Type,
  Sparkles,
  Smartphone,
  Globe,
  MapPin,
  Copy,
  ExternalLink,
  Phone,
  CircleAlert,
  Eye,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  handleCreateTemplate,
  handleCloneTemplateMultilang,
  type CloneTemplateOutcome,
} from '@/app/actions/template.actions';
import { useTemplateStore } from '../template-store';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Template Creator -- full-featured WhatsApp Cloud API template builder,
 * rebuilt on 20ui primitives.
 *
 * Same data flow as before. Submit-for-review uses Modal confirm.
 * Live preview lives in a Card on the right pane.
 */

import * as React from 'react';

import { Field } from './components/Field';
import { HeaderEditor } from './components/HeaderEditor';
import { BodyEditor } from './components/BodyEditor';
import { ButtonManager } from './components/ButtonManager';
import {
  LANGUAGES,
  CATEGORIES,
  TEMPLATE_TYPES,
  HEADER_FORMATS,
  BUTTON_TYPES,
  ButtonData,
} from './constants';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

/* -- Live Phone Preview ────────────────────────── */

function PhonePreview({
  headerFormat,
  headerText,
  body,
  footer,
  buttons,
  templateType,
}: {
  headerFormat: string;
  headerText: string;
  body: string;
  footer: string;
  buttons: ButtonData[];
  templateType: string;
}) {
  return (
    <div className="mx-auto w-[280px]">
      <div className="rounded-[18px] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
        <div className="flex items-center justify-between px-2 py-1 text-[9px] text-[var(--st-text-tertiary)]">
          <span>WhatsApp</span>
          <span>Preview</span>
        </div>

        <div className="mt-2 max-w-[240px] rounded-lg bg-[var(--st-bg)] p-3">
          {headerFormat === 'IMAGE' && (
            <div className="mb-2 flex h-[120px] items-center justify-center rounded bg-[var(--st-bg-secondary)]">
              <ImageIcon className="h-8 w-8 text-[var(--st-text-tertiary)]" aria-hidden="true" />
            </div>
          )}
          {headerFormat === 'VIDEO' && (
            <div className="mb-2 flex h-[120px] items-center justify-center rounded bg-[var(--st-bg-secondary)]">
              <Video className="h-8 w-8 text-[var(--st-text-tertiary)]" aria-hidden="true" />
            </div>
          )}
          {headerFormat === 'DOCUMENT' && (
            <div className="mb-2 flex items-center gap-2 rounded bg-[var(--st-bg-secondary)] p-2">
              <FileText className="h-5 w-5 text-[var(--st-text-tertiary)]" aria-hidden="true" />
              <span className="text-[10px] text-[var(--st-text-secondary)]">Document</span>
            </div>
          )}
          {headerFormat === 'LOCATION' && (
            <div className="mb-2 flex h-[80px] items-center justify-center rounded bg-[var(--st-bg-secondary)]">
              <MapPin className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
            </div>
          )}
          {headerFormat === 'TEXT' && headerText && (
            <p className="mb-1 text-[12px] font-bold text-[var(--st-text)]">
              {headerText}
            </p>
          )}

          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--st-text)]">
            {body || 'Your message body will appear here...'}
          </p>

          {footer && (
            <p className="mt-1.5 text-[9px] text-[var(--st-text-tertiary)]">
              {footer}
            </p>
          )}

          <div className="mt-1 flex justify-end">
            <span className="text-[8px] text-[var(--st-text-tertiary)]">12:00 PM</span>
          </div>
        </div>

        {buttons.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {buttons.map((btn, i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-lg bg-[var(--st-bg)] py-1.5 text-[11px] font-medium text-[var(--st-text)]"
              >
                {btn.type === 'URL' && <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />}
                {btn.type === 'PHONE_NUMBER' && <Phone className="mr-1 h-3 w-3" aria-hidden="true" />}
                {btn.type === 'COPY_CODE' && <Copy className="mr-1 h-3 w-3" aria-hidden="true" />}
                {btn.text || `Button ${i + 1}`}
              </div>
            ))}
          </div>
        )}

        {templateType === 'AUTH' && (
          <div className="mt-1 flex items-center justify-center rounded-lg bg-[var(--st-bg)] py-1.5 text-[11px] font-medium text-[var(--st-text)]">
            <Copy className="mr-1 h-3 w-3" aria-hidden="true" />
            Copy Code
          </div>
        )}
      </div>
    </div>
  );
}

/* -- Multi-Language Selector ───────────────────── */

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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconLeft={Globe}
        onClick={() => setOpen(true)}
      >
        Clone to multiple languages
      </Button>
    );
  }

  return (
    <Card variant="outlined" padding="sm">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-[var(--st-text)]">
            <Globe className="h-3 w-3" aria-hidden="true" /> Multi-language cloning
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <p className="text-[10px] text-[var(--st-text-secondary)]">
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
                    isSelected
                      ? selected.filter((s) => s !== l.code)
                      : [...selected, l.code],
                  )
                }
                className={cx(
                  'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                  isSelected
                    ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-bg)]'
                    : 'border-[var(--st-border)] text-[var(--st-text-secondary)]',
                )}
              >
                {l.name}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <p className="text-[10px] font-medium text-[var(--st-text)]">
            {selected.length} language(s) selected for cloning
          </p>
        )}
      </div>
    </Card>
  );
}

/* -- Main Page ─────────────────────────────────── */

function CreateTemplateContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeProject } = useProject();
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  const [isPending, startTransition] = useTransition();

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

  // Multi-language clone results (shown after the primary template is created).
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneOutcomes, setCloneOutcomes] = useState<CloneTemplateOutcome[]>([]);

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
      if (footerComp) {
        setFooter(footerComp.text || '');
      }

      const btns = templateToAction.components.find((c: any) => c.type === 'BUTTONS');
      if (btns && btns.buttons) {
        setButtons(btns.buttons);
      }
    }
  }, [action, templateToAction]);

  // Submit-for-review confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Derived
  const charCount = body.length;
  const varCount = (body.match(/{{\s*\d+\s*}}/g) || []).length;

  const handleSubmit = () => {
    if (!activeProject?._id || !name.trim() || !body.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Name and body are required.',
        tone: 'danger',
      });
      return;
    }

    const sanitizedName = name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    startTransition(async () => {
      const formData = new FormData();
      formData.set('projectId', activeProject._id.toString());
      formData.set('name', sanitizedName);
      formData.set(
        'category',
        templateType === 'AUTH' ? 'AUTHENTICATION' : category,
      );
      formData.set('language', language);
      formData.set(
        'templateType',
        templateType === 'CAROUSEL'
          ? 'MARKETING_CAROUSEL'
          : templateType === 'CATALOG'
          ? 'CATALOG_MESSAGE'
          : 'STANDARD',
      );

      formData.set(
        'headerFormat',
        templateType === 'AUTH' ? 'NONE' : headerFormat,
      );
      if (headerFormat === 'TEXT') formData.set('headerText', headerText);
      if (
        ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) &&
        headerMediaUrl
      ) {
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
          JSON.stringify([
            { type: 'COPY_CODE', text: 'Copy Code', example: ['123456'] },
          ]),
        );
      } else if (templateType === 'LTO') {
        const ltoButtons: ButtonData[] = [
          {
            type: 'COPY_CODE',
            text: 'Get Offer',
            example: [ltoCoupon || 'SAVE20'],
          },
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
        toast({
          title: 'Error',
          description: result.error,
          tone: 'danger',
        });
        return;
      }

      toast({
        title: 'Success',
        description: result.message || 'Template submitted for approval.',
        tone: 'success',
      });

      // Optional Wave-E step: also create the template in other languages.
      // Only runs when the user picked clone languages; the primary create
      // flow above is unchanged when none are selected.
      const targets = cloneLanguages.filter((l) => l !== language);
      if (targets.length === 0) {
        router.push('/wachat/templates');
        return;
      }

      setCloneModalOpen(true);
      setCloneBusy(true);
      setCloneError(null);
      setCloneOutcomes([]);

      const cloneResult = await handleCloneTemplateMultilang({
        projectId: activeProject._id.toString(),
        sourceTemplateName: sanitizedName,
        targetLanguages: targets,
      });

      setCloneBusy(false);
      if (cloneResult.error) {
        setCloneError(cloneResult.error);
      } else {
        setCloneOutcomes(cloneResult.outcomes ?? []);
      }
    });
  };

  const langLabel = (code: string) =>
    LANGUAGES.find((l) => l.code === code)?.name ?? code;

  const closeCloneModal = () => {
    setCloneModalOpen(false);
    router.push('/wachat/templates');
  };

  const breadcrumb = [
    { label: 'SabNode', href: '/dashboard' },
    { label: 'WaChat', href: '/wachat' },
    { label: 'Templates', href: '/wachat/templates' },
    { label: action === 'clone' ? 'Clone' : 'Create' },
  ];

  if (!activeProject) {
    return (
      <WachatPage
        breadcrumb={breadcrumb}
        title={action === 'clone' ? 'Clone template' : 'Create template'}
        description="Compose a WhatsApp Cloud API template. Submit for Meta approval once it's ready."
      >
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Choose a project from the dashboard to create templates."
          action={
            <Button size="sm" variant="primary" onClick={() => router.push('/wachat')}>
              Choose a project
            </Button>
          }
        />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={breadcrumb}
      title={action === 'clone' ? 'Clone template' : 'Create template'}
      description="Compose a WhatsApp Cloud API template. Submit for Meta approval once it's ready."
      actions={
        <Button
          variant="outline"
          size="sm"
          iconLeft={Eye}
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? 'Hide preview' : 'Show preview'}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconLeft={ArrowLeft}
          onClick={() => router.push('/wachat/templates')}
          className="self-start"
        >
          Back to templates
        </Button>

        {/* Template Type Selector */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TEMPLATE_TYPES.map((t) => {
            const Icon = t.icon;
            const isActive = templateType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setTemplateType(t.id);
                  setButtons([]);
                  setHeaderFormat('NONE');
                }}
                className={cx(
                  'u-card u-card--interactive u-card--pad-sm flex flex-col items-center gap-1.5 text-center transition-colors',
                  isActive && 'u-card--outlined border-[var(--st-text)] bg-[var(--st-bg-secondary)]',
                )}
              >
                <Icon
                  className={cx(
                    'h-5 w-5',
                    isActive ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]',
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cx(
                    'text-[11px] font-semibold',
                    isActive ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]',
                  )}
                >
                  {t.name}
                </span>
                <span className="text-[9px] leading-tight text-[var(--st-text-tertiary)]">
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={cx(
            'grid gap-6',
            showPreview ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-1',
          )}
        >
          {/* -- Editor Column -- */}
          <div className="space-y-5">
            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle>Template details</CardTitle>
              </CardHeader>
              <CardBody>
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
                      <Select
                        value={category}
                        onChange={(v) => v && setCategory(v)}
                        aria-label="Category"
                        options={CATEGORIES.map((c) => ({
                          value: c.id,
                          label: c.name,
                        }))}
                      />
                    </Field>
                  )}
                  <Field label="Language" required>
                    <Select
                      value={language}
                      onChange={(v) => v && setLanguage(v)}
                      searchable
                      aria-label="Language"
                      options={LANGUAGES.map((l) => ({
                        value: l.code,
                        label: l.name,
                      }))}
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>

            {/* AUTH */}
            {templateType === 'AUTH' && (
              <Card>
                <CardHeader>
                  <CardTitle>Authentication settings</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <Field label="OTP type">
                      <Select
                        value={otpType}
                        onChange={(v) => v && setOtpType(v as any)}
                        aria-label="OTP type"
                        options={[
                          { value: 'COPY_CODE', label: 'Copy code button' },
                          { value: 'ONE_TAP', label: 'One-tap autofill' },
                          { value: 'ZERO_TAP', label: 'Zero-tap (auto-verify)' },
                        ]}
                      />
                    </Field>
                    <Field label="Code expiry (minutes)">
                      <Input
                        value={codeExpiry}
                        onChange={(e) => setCodeExpiry(e.target.value)}
                        placeholder="10"
                      />
                    </Field>
                    <Callout tone="neutral" icon={null} title="Auto-generated body:">
                      <span className="font-mono text-[11px]">
                        {`{{1}} is your verification code. This code expires in ${codeExpiry} minutes.`}
                      </span>
                    </Callout>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* LTO */}
            {templateType === 'LTO' && (
              <Card>
                <CardHeader>
                  <CardTitle>Limited time offer</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
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
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Standard / LTO / Carousel content */}
            {(templateType === 'STANDARD' ||
              templateType === 'LTO' ||
              templateType === 'CAROUSEL') && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {templateType === 'CAROUSEL'
                      ? 'Carousel introduction'
                      : 'Message content'}
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
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

                    <BodyEditor
                      body={body}
                      setBody={setBody}
                      footer={footer}
                      setFooter={setFooter}
                    />
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Buttons */}
            {(templateType === 'STANDARD' || templateType === 'CAROUSEL') && (
              <Card>
                <CardBody>
                  <div className="space-y-3">
                    <ButtonManager
                      buttons={buttons}
                      setButtons={setButtons}
                    />
                  </div>
                </CardBody>
              </Card>
            )}

            {/* SabNode features */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    SabNode features
                  </span>
                </CardTitle>
              </CardHeader>
              <CardBody>
                <MultiLanguageSelector
                  selected={cloneLanguages}
                  onChange={setCloneLanguages}
                />
              </CardBody>
            </Card>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                iconLeft={isPending ? undefined : Send}
                loading={isPending}
                onClick={() => setConfirmOpen(true)}
                disabled={
                  isPending ||
                  !name.trim() ||
                  (!body.trim() && templateType !== 'AUTH')
                }
              >
                {isPending ? 'Submitting...' : 'Submit for approval'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/wachat/templates')}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Preview Column */}
          {showPreview && (
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> Live preview
                </div>
                <Card variant="elevated">
                  <PhonePreview
                    headerFormat={headerFormat}
                    headerText={headerText}
                    body={
                      templateType === 'AUTH'
                        ? `*123456* is your verification code. This code expires in ${codeExpiry} minutes.`
                        : body
                    }
                    footer={footer}
                    buttons={buttons}
                    templateType={templateType}
                  />
                </Card>
                <div className="space-y-1 text-center">
                  <p className="text-[10px] text-[var(--st-text-secondary)]">
                    {charCount}/1024 characters
                  </p>
                  <p className="text-[10px] text-[var(--st-text-secondary)]">
                    {varCount} variable(s) detected
                  </p>
                  {cloneLanguages.length > 0 && (
                    <p className="text-[10px] text-[var(--st-text)]">
                      {cloneLanguages.length} language clone(s)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit-for-review confirm dialog */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit for Meta approval?"
        description="Once submitted, this template will be reviewed by Meta. You will not be able to edit it until approved or rejected."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              iconLeft={Send}
              onClick={() => {
                setConfirmOpen(false);
                handleSubmit();
              }}
              disabled={isPending}
            >
              Submit
            </Button>
          </>
        }
      />

      {/* Multi-language clone results */}
      <Modal
        open={cloneModalOpen}
        onClose={cloneBusy ? () => {} : closeCloneModal}
        title="Cloning to other languages"
        description="The primary template was submitted. We are creating a copy in each selected language."
        footer={
          <Button
            variant="primary"
            onClick={closeCloneModal}
            disabled={cloneBusy}
          >
            {cloneBusy ? 'Working...' : 'Done'}
          </Button>
        }
      >
        {cloneBusy ? (
          <div className="flex items-center gap-2 py-4 text-[13px] text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Cloning to other languages" />
            <span>
              Creating {cloneLanguages.filter((l) => l !== language).length}{' '}
              language clone(s)...
            </span>
          </div>
        ) : cloneError ? (
          <Callout tone="danger" title="Multi-language clone failed">
            {cloneError} The primary template was still submitted for approval.
          </Callout>
        ) : cloneOutcomes.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No languages cloned"
            description="No additional language clones were attempted."
          />
        ) : (
          <div className="space-y-3">
            {cloneOutcomes.some((o) => o.status === 'failed') && (
              <Callout tone="warning" title="Some clones could not be created">
                Languages marked failed may be missing Meta credentials or were
                rejected. You can retry them from the templates list.
              </Callout>
            )}
            <ul className="space-y-2">
              {cloneOutcomes.map((o) => (
                <li
                  key={o.language}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--st-text)]">
                      {langLabel(o.language)}
                    </p>
                    {o.error && (
                      <p className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
                        {o.error}
                      </p>
                    )}
                  </div>
                  <Badge
                    tone={
                      o.status === 'created'
                        ? 'success'
                        : o.status === 'skipped'
                        ? 'neutral'
                        : 'danger'
                    }
                  >
                    {o.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </WachatPage>
  );
}

export default function CreateTemplatePage() {
  return (
    <Suspense
      fallback={
        <WachatPage>
          <Skeleton height={400} width="100%" />
        </WachatPage>
      }
    >
      <CreateTemplateContent />
    </Suspense>
  );
}
