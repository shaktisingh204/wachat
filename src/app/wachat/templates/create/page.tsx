'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  ZoruFileInput,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  Suspense,
  useState,
  useTransition,
  useEffect,
  } from 'react';
import { useRouter,
  useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Video,
  FileText,
  Type,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Smartphone,
  Globe,
  ShoppingBag,
  LayoutGrid,
  MessageSquare,
  Shield,
  Clock,
  MapPin,
  Copy,
  ExternalLink,
  Phone,
  Hash,
  CircleAlert,
  Wand,
  Eye,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { handleCreateTemplate } from '@/app/actions/template.actions';
import { useTemplateStore } from '../template-store';

/**
 * Template Creator — full-featured WhatsApp Cloud API template builder,
 * rebuilt on ZoruUI primitives.
 *
 * Same data flow as before. Submit-for-review uses Dialog confirm.
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

/* ── Live Phone Preview ────────────────────────── */

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
      <div className="rounded-[24px] border border-zoru-line-strong bg-zoru-surface-2 p-3 shadow-[var(--zoru-shadow-md)]">
        <div className="flex items-center justify-between px-2 py-1 text-[9px] text-zoru-ink-muted">
          <span>WhatsApp</span>
          <span>Preview</span>
        </div>

        <div className="mt-2 max-w-[240px] rounded-lg bg-zoru-bg p-3 shadow-[var(--zoru-shadow-sm)]">
          {headerFormat === 'IMAGE' && (
            <div className="mb-2 flex h-[120px] items-center justify-center rounded bg-zoru-surface">
              <ImageIcon className="h-8 w-8 text-zoru-ink-subtle" />
            </div>
          )}
          {headerFormat === 'VIDEO' && (
            <div className="mb-2 flex h-[120px] items-center justify-center rounded bg-zoru-surface">
              <Video className="h-8 w-8 text-zoru-ink-subtle" />
            </div>
          )}
          {headerFormat === 'DOCUMENT' && (
            <div className="mb-2 flex items-center gap-2 rounded bg-zoru-surface p-2">
              <FileText className="h-5 w-5 text-zoru-ink-subtle" />
              <span className="text-[10px] text-zoru-ink-muted">Document</span>
            </div>
          )}
          {headerFormat === 'LOCATION' && (
            <div className="mb-2 flex h-[80px] items-center justify-center rounded bg-zoru-surface">
              <MapPin className="h-6 w-6 text-zoru-ink-muted" />
            </div>
          )}
          {headerFormat === 'TEXT' && headerText && (
            <p className="mb-1 text-[12px] font-bold text-zoru-ink">
              {headerText}
            </p>
          )}

          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zoru-ink">
            {body || 'Your message body will appear here…'}
          </p>

          {footer && (
            <p className="mt-1.5 text-[9px] text-zoru-ink-muted">{footer}</p>
          )}

          <div className="mt-1 flex justify-end">
            <span className="text-[8px] text-zoru-ink-subtle">12:00 PM</span>
          </div>
        </div>

        {buttons.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {buttons.map((btn, i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-lg bg-zoru-bg py-1.5 text-[11px] font-medium text-zoru-ink shadow-[var(--zoru-shadow-sm)]"
              >
                {btn.type === 'URL' && (
                  <ExternalLink className="mr-1 h-3 w-3" />
                )}
                {btn.type === 'PHONE_NUMBER' && (
                  <Phone className="mr-1 h-3 w-3" />
                )}
                {btn.type === 'COPY_CODE' && <Copy className="mr-1 h-3 w-3" />}
                {btn.text || `Button ${i + 1}`}
              </div>
            ))}
          </div>
        )}

        {templateType === 'AUTH' && (
          <div className="mt-1 flex items-center justify-center rounded-lg bg-zoru-bg py-1.5 text-[11px] font-medium text-zoru-ink shadow-[var(--zoru-shadow-sm)]">
            <Copy className="mr-1 h-3 w-3" />
            Copy Code
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Multi-Language Selector ───────────────────── */

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
        className="flex items-center gap-1.5 text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
      >
        <Globe className="h-3 w-3" /> Clone to multiple languages
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-zoru-ink">
          <Globe className="mr-1 inline h-3 w-3" /> Multi-language cloning
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          Close
        </button>
      </div>
      <p className="text-[10px] text-zoru-ink-muted">
        After creating the primary template, clones will be auto-created for
        selected languages.
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
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                isSelected
                  ? 'border-zoru-ink bg-zoru-ink text-zoru-on-primary'
                  : 'border-zoru-line text-zoru-ink-muted hover:border-zoru-line-strong hover:text-zoru-ink',
              )}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] font-medium text-zoru-ink">
          {selected.length} language(s) selected for cloning
        </p>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────── */

function CreateTemplateContent() {
  const router = useRouter();
  const { toast } = useZoruToast();
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
  const [otpType, setOtpType] = useState<
    'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP'
  >('COPY_CODE');
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
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set('projectId', activeProject._id.toString());
      formData.set(
        'name',
        name
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, ''),
      );
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
          variant: 'destructive',
        });
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
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
        <Breadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/wachat/templates">
                Templates
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Create</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>
        <EmptyState
          icon={<CircleAlert />}
          title="Select a project first"
          description="Choose a project from the dashboard to create templates."
          action={
            <Button size="sm" onClick={() => router.push('/wachat')}>
              Choose a project
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/templates">
              Templates
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>
              {action === 'clone' ? 'Clone' : 'Create'}
            </ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <PageHeader bordered={false}>
        <ZoruPageHeading>
          <button
            type="button"
            onClick={() => router.push('/wachat/templates')}
            className="mb-1 flex items-center gap-1 text-[12px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
          >
            <ArrowLeft className="h-3 w-3" /> Back to templates
          </button>
          <ZoruPageTitle>
            {action === 'clone' ? 'Clone template' : 'Create template'}
          </ZoruPageTitle>
          <ZoruPageDescription>
            Compose a WhatsApp Cloud API template. Submit for Meta approval
            once it&apos;s ready.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye /> {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {/* Template Type Selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {TEMPLATE_TYPES.map((t) => {
          const Icon = t.icon;
          const isActive = templateType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTemplateType(t.id);
                setButtons([]);
                setHeaderFormat('NONE');
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-[var(--zoru-radius-lg)] border p-3 text-center transition-colors',
                isActive
                  ? 'border-zoru-ink bg-zoru-surface-2'
                  : 'border-zoru-line hover:border-zoru-line-strong',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5',
                  isActive ? 'text-zoru-ink' : 'text-zoru-ink-muted',
                )}
              />
              <span
                className={cn(
                  'text-[11px] font-semibold',
                  isActive ? 'text-zoru-ink' : 'text-zoru-ink-muted',
                )}
              >
                {t.name}
              </span>
              <span className="text-[9px] leading-tight text-zoru-ink-subtle">
                {t.desc}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          'grid gap-6',
          showPreview ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-1',
        )}
      >
        {/* ── Editor Column ── */}
        <div className="space-y-5">
          {/* Details */}
          <Card>
            <ZoruCardContent className="space-y-4 pt-6">
              <h3 className="text-[13px] font-semibold text-zoru-ink">
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

          {/* AUTH */}
          {templateType === 'AUTH' && (
            <Card>
              <ZoruCardContent className="space-y-4 pt-6">
                <h3 className="text-[13px] font-semibold text-zoru-ink">
                  Authentication settings
                </h3>
                <Field label="OTP type">
                  <Select
                    value={otpType}
                    onValueChange={(v) => setOtpType(v as any)}
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="COPY_CODE">
                        Copy code button
                      </ZoruSelectItem>
                      <ZoruSelectItem value="ONE_TAP">
                        One-tap autofill
                      </ZoruSelectItem>
                      <ZoruSelectItem value="ZERO_TAP">
                        Zero-tap (auto-verify)
                      </ZoruSelectItem>
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
                <div className="rounded-[var(--zoru-radius)] bg-zoru-surface p-3 text-[11px] text-zoru-ink-muted">
                  <p className="mb-1 font-medium text-zoru-ink">
                    Auto-generated body:
                  </p>
                  <p className="font-mono">{`{{1}} is your verification code. This code expires in ${codeExpiry} minutes.`}</p>
                </div>
              </ZoruCardContent>
            </Card>
          )}

          {/* LTO */}
          {templateType === 'LTO' && (
            <Card>
              <ZoruCardContent className="space-y-4 pt-6">
                <h3 className="text-[13px] font-semibold text-zoru-ink">
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

          {/* Standard / LTO / Carousel content */}
          {(templateType === 'STANDARD' ||
            templateType === 'LTO' ||
            templateType === 'CAROUSEL') && (
            <Card>
              <ZoruCardContent className="space-y-4 pt-6">
                <h3 className="text-[13px] font-semibold text-zoru-ink">
                  {templateType === 'CAROUSEL'
                    ? 'Carousel introduction'
                    : 'Message content'}
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

                <BodyEditor
                  body={body}
                  setBody={setBody}
                  footer={footer}
                  setFooter={setFooter}
                />
              </ZoruCardContent>
            </Card>
          )}

          {/* Buttons */}
          {(templateType === 'STANDARD' || templateType === 'CAROUSEL') && (
            <Card>
              <ZoruCardContent className="space-y-3 pt-6">
                <ButtonManager
                  buttons={buttons}
                  setButtons={setButtons}
                />
              </ZoruCardContent>
            </Card>
          )}

          {/* SabNode features */}
          <Card>
            <ZoruCardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zoru-ink" />
                <h3 className="text-[13px] font-semibold text-zoru-ink">
                  SabNode features
                </h3>
              </div>
              <MultiLanguageSelector
                selected={cloneLanguages}
                onChange={setCloneLanguages}
              />
            </ZoruCardContent>
          </Card>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={
                isPending ||
                !name.trim() ||
                (!body.trim() && templateType !== 'AUTH')
              }
            >
              {isPending ? (
                <>
                  <RefreshCw className="animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Send /> Submit for approval
                </>
              )}
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
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                <Smartphone className="h-3.5 w-3.5" /> Live preview
              </div>
              <Card variant="elevated">
                <ZoruCardContent className="pt-6">
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
                </ZoruCardContent>
              </Card>
              <div className="space-y-1 text-center">
                <p className="text-[10px] text-zoru-ink-muted">
                  {charCount}/1024 characters
                </p>
                <p className="text-[10px] text-zoru-ink-muted">
                  {varCount} variable(s) detected
                </p>
                {cloneLanguages.length > 0 && (
                  <p className="text-[10px] text-zoru-ink">
                    {cloneLanguages.length} language clone(s)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit-for-review confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Submit for Meta approval?</ZoruDialogTitle>
            <ZoruDialogDescription>
              Once submitted, this template will be reviewed by Meta. You will
              not be able to edit it until approved or rejected.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                handleSubmit();
              }}
              disabled={isPending}
            >
              <Send /> Submit
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}

export default function CreateTemplatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1320px] px-6 pt-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      }
    >
      <CreateTemplateContent />
    </Suspense>
  );
}
