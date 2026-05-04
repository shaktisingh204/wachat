'use client';

/**
 * Template Creator — full-featured WhatsApp Cloud API template builder,
 * rebuilt on ZoruUI primitives.
 *
 * Same data flow as before. Submit-for-review uses ZoruDialog confirm.
 * Live preview lives in a ZoruCard on the right pane.
 */

import * as React from 'react';
import {
  Suspense,
  useState,
  useTransition,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

/* ── Languages ─────────────────────────────────── */

const LANGUAGES = [
  { code: 'en_US', name: 'English (US)' },
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt_BR', name: 'Portuguese (BR)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh_CN', name: 'Chinese (Simplified)' },
  { code: 'ru', name: 'Russian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'bn', name: 'Bengali' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'fil', name: 'Filipino' },
  { code: 'sw', name: 'Swahili' },
];

const CATEGORIES = [
  { id: 'MARKETING', name: 'Marketing', desc: 'Promotions, offers, updates' },
  { id: 'UTILITY', name: 'Utility', desc: 'Order updates, confirmations' },
  {
    id: 'AUTHENTICATION',
    name: 'Authentication',
    desc: 'OTP, verification codes',
  },
];

const TEMPLATE_TYPES = [
  {
    id: 'STANDARD',
    name: 'Standard',
    icon: MessageSquare,
    desc: 'Text, media, buttons',
  },
  {
    id: 'CAROUSEL',
    name: 'Carousel',
    icon: LayoutGrid,
    desc: 'Scrollable media cards',
  },
  {
    id: 'CATALOG',
    name: 'Catalog',
    icon: ShoppingBag,
    desc: 'Interactive product list',
  },
  { id: 'AUTH', name: 'Authentication', icon: Shield, desc: 'OTP verification' },
  {
    id: 'LTO',
    name: 'Limited Time Offer',
    icon: Clock,
    desc: 'Expiring promotions',
  },
];

const HEADER_FORMATS = [
  { id: 'NONE', name: 'None', icon: Hash },
  { id: 'TEXT', name: 'Text', icon: Type },
  { id: 'IMAGE', name: 'Image', icon: ImageIcon },
  { id: 'VIDEO', name: 'Video', icon: Video },
  { id: 'DOCUMENT', name: 'Document', icon: FileText },
  { id: 'LOCATION', name: 'Location', icon: MapPin },
];

const BUTTON_TYPES = [
  { id: 'QUICK_REPLY', name: 'Quick Reply', icon: MessageSquare },
  { id: 'URL', name: 'URL', icon: ExternalLink },
  { id: 'PHONE_NUMBER', name: 'Call', icon: Phone },
  { id: 'COPY_CODE', name: 'Copy Code', icon: Copy },
];

type ButtonData = {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
};

/* ── Field wrapper ─────────────────────────────── */

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <ZoruLabel className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle">
        {label} {required && <span className="text-zoru-danger">*</span>}
      </ZoruLabel>
      {children}
      {hint && (
        <p className="text-[11px] text-zoru-ink-muted">{hint}</p>
      )}
    </div>
  );
}

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

/* ── AI Body Generator ─────────────────────────── */

function AIBodyGenerator({
  onGenerate,
}: {
  onGenerate: (text: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [open, setOpen] = useState(false);

  const generate = () => {
    if (!prompt.trim()) return;
    const templates: Record<string, string> = {
      welcome:
        "Hello {{1}}! 👋 Welcome to our store. We're excited to have you here. Browse our latest collection and enjoy exclusive deals just for you!",
      order:
        'Hi {{1}}, your order #{{2}} has been {{3}}. Track your delivery at {{4}}. Thank you for shopping with us!',
      appointment:
        'Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Reply YES to confirm or NO to reschedule.',
      promo:
        '🎉 Exclusive offer for {{1}}! Get {{2}}% OFF on your next purchase. Use code: {{3}}. Valid until {{4}}. Shop now!',
      feedback:
        "Hi {{1}}, we hope you enjoyed your recent experience with us! We'd love to hear your feedback. Rate us from 1-5 by replying with a number.",
      payment:
        'Hi {{1}}, your payment of {{2}} for invoice #{{3}} has been received. Thank you!',
    };

    const key = Object.keys(templates).find((k) =>
      prompt.toLowerCase().includes(k),
    );
    onGenerate(
      key ? templates[key] : `Hi {{1}}, ${prompt}. Thank you for choosing us!`,
    );
    setOpen(false);
    setPrompt('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
      >
        <Wand className="h-3 w-3" /> Generate with AI
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zoru-ink">
        <Sparkles className="h-3 w-3" /> AI Body Generator
      </div>
      <ZoruInput
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your message (e.g., 'order confirmation with tracking')"
      />
      <div className="flex gap-2">
        <ZoruButton size="sm" onClick={generate}>
          Generate
        </ZoruButton>
        <ZoruButton
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </ZoruButton>
      </div>
    </div>
  );
}

/* ── Variable Examples ─────────────────────────── */

function VariableExamples({
  text,
  prefix,
}: {
  text: string;
  prefix: string;
}) {
  const matches = text.match(/{{\s*(\d+)\s*}}/g);
  if (!matches || matches.length === 0) return null;

  const vars = [
    ...new Set(
      matches.map((m) => parseInt(m.replace(/[{}]/g, '').trim())),
    ),
  ]
    .sort((a, b) => a - b)
    .filter((n) => n > 0);
  if (vars.length === 0) return null;

  const suggestions: Record<number, string> = {
    1: 'John',
    2: 'ORD-12345',
    3: 'confirmed',
    4: 'https://track.example.com',
  };

  return (
    <div className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <p className="text-[11px] font-semibold text-zoru-ink">
        Variable examples required
      </p>
      <div className="space-y-1.5">
        {vars.map((v) => (
          <div key={v} className="flex items-center gap-2">
            <span className="w-12 font-mono text-[11px] text-zoru-ink-muted">
              {`{{${v}}}`}
            </span>
            <ZoruInput
              name={`${prefix}_example_${v}`}
              placeholder={
                suggestions[v] || `Example for variable ${v}`
              }
              required
              className="h-8 text-[12px]"
            />
          </div>
        ))}
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
  const [headerSampleUrl, setHeaderSampleUrl] = useState('');
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

  // Submit-for-review confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Derived
  const charCount = body.length;
  const varCount = (body.match(/{{\s*\d+\s*}}/g) || []).length;

  const addButton = (type: string) => {
    if (buttons.length >= 10) return;
    setButtons([...buttons, { type, text: '' }]);
  };

  const updateButton = (i: number, field: string, value: string) => {
    const updated = [...buttons];
    (updated[i] as any)[field] = value;
    setButtons(updated);
  };

  const removeButton = (i: number) => {
    setButtons(buttons.filter((_, idx) => idx !== i));
  };

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
        headerSampleUrl
      ) {
        formData.set('headerSampleUrl', headerSampleUrl);
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
        <ZoruBreadcrumb>
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
        </ZoruBreadcrumb>
        <ZoruEmptyState
          icon={<CircleAlert />}
          title="Select a project first"
          description="Choose a project from the dashboard to create templates."
          action={
            <ZoruButton size="sm" onClick={() => router.push('/wachat')}>
              Choose a project
            </ZoruButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
      </ZoruBreadcrumb>

      {/* Header */}
      <ZoruPageHeader bordered={false}>
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
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye /> {showPreview ? 'Hide preview' : 'Show preview'}
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

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
          <ZoruCard>
            <ZoruCardContent className="space-y-4 pt-6">
              <h3 className="text-[13px] font-semibold text-zoru-ink">
                Template details
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Name" required>
                  <ZoruInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., order_confirmation"
                    required
                  />
                </Field>
                {templateType !== 'AUTH' && (
                  <Field label="Category" required>
                    <ZoruSelect value={category} onValueChange={setCategory}>
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
                    </ZoruSelect>
                  </Field>
                )}
                <Field label="Language" required>
                  <ZoruSelect value={language} onValueChange={setLanguage}>
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
                  </ZoruSelect>
                </Field>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          {/* AUTH */}
          {templateType === 'AUTH' && (
            <ZoruCard>
              <ZoruCardContent className="space-y-4 pt-6">
                <h3 className="text-[13px] font-semibold text-zoru-ink">
                  Authentication settings
                </h3>
                <Field label="OTP type">
                  <ZoruSelect
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
                  </ZoruSelect>
                </Field>
                <Field label="Code expiry (minutes)">
                  <ZoruInput
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
            </ZoruCard>
          )}

          {/* LTO */}
          {templateType === 'LTO' && (
            <ZoruCard>
              <ZoruCardContent className="space-y-4 pt-6">
                <h3 className="text-[13px] font-semibold text-zoru-ink">
                  Limited time offer
                </h3>
                <Field
                  label="Offer expiry"
                  hint="When the offer expires (shown as countdown)"
                >
                  <ZoruInput
                    type="datetime-local"
                    value={ltoExpiry}
                    onChange={(e) => setLtoExpiry(e.target.value)}
                  />
                </Field>
                <Field label="Coupon code">
                  <ZoruInput
                    value={ltoCoupon}
                    onChange={(e) => setLtoCoupon(e.target.value)}
                    placeholder="SAVE20"
                  />
                </Field>
              </ZoruCardContent>
            </ZoruCard>
          )}

          {/* Standard / LTO / Carousel content */}
          {(templateType === 'STANDARD' ||
            templateType === 'LTO' ||
            templateType === 'CAROUSEL') && (
            <ZoruCard>
              <ZoruCardContent className="space-y-4 pt-6">
                <h3 className="text-[13px] font-semibold text-zoru-ink">
                  {templateType === 'CAROUSEL'
                    ? 'Carousel introduction'
                    : 'Message content'}
                </h3>

                {templateType === 'STANDARD' && (
                  <Field label="Header">
                    <div className="flex flex-wrap gap-1.5">
                      {HEADER_FORMATS.map((h) => {
                        const Icon = h.icon;
                        const isActive = headerFormat === h.id;
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setHeaderFormat(h.id)}
                            className={cn(
                              'flex items-center gap-1 rounded-[var(--zoru-radius)] border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                              isActive
                                ? 'border-zoru-ink bg-zoru-surface-2 text-zoru-ink'
                                : 'border-zoru-line text-zoru-ink-muted hover:text-zoru-ink',
                            )}
                          >
                            <Icon className="h-3 w-3" /> {h.name}
                          </button>
                        );
                      })}
                    </div>

                    {headerFormat === 'TEXT' && (
                      <div className="mt-2 space-y-2">
                        <ZoruInput
                          name="headerText"
                          value={headerText}
                          onChange={(e) => setHeaderText(e.target.value)}
                          placeholder="Header text (e.g., Welcome {{1}})"
                        />
                        <VariableExamples text={headerText} prefix="header" />
                      </div>
                    )}

                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
                      <div className="mt-2 space-y-2">
                        <ZoruInput
                          name="headerSampleUrl"
                          value={headerSampleUrl}
                          onChange={(e) => setHeaderSampleUrl(e.target.value)}
                          placeholder="Media URL (https://…)"
                        />
                        <p className="text-[10px] text-zoru-ink-muted">
                          Direct link to the media file. Meta requires a sample
                          for approval.
                        </p>
                      </div>
                    )}

                    {headerFormat === 'LOCATION' && (
                      <p className="mt-2 text-[11px] text-zoru-ink-muted">
                        Location header will prompt the user to share or view
                        a location.
                      </p>
                    )}
                  </Field>
                )}

                <Field
                  label="Body"
                  required
                  hint={`${charCount}/1024 chars · ${varCount} variable(s)`}
                >
                  <ZoruTextarea
                    name="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Hello {{1}}, your order #{{2}} is confirmed…"
                    required
                    rows={5}
                  />
                  <div className="mt-2">
                    <AIBodyGenerator onGenerate={setBody} />
                  </div>
                  <VariableExamples text={body} prefix="body" />
                </Field>

                <Field label="Footer" hint="Optional, max 60 chars">
                  <ZoruInput
                    name="footer"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value.slice(0, 60))}
                    placeholder="e.g., Reply STOP to unsubscribe"
                  />
                </Field>
              </ZoruCardContent>
            </ZoruCard>
          )}

          {/* Buttons */}
          {(templateType === 'STANDARD' || templateType === 'CAROUSEL') && (
            <ZoruCard>
              <ZoruCardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-zoru-ink">
                    Buttons ({buttons.length}/10)
                  </h3>
                </div>

                {buttons.map((btn, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                        {btn.type.replace('_', ' ')}
                      </span>
                      <ZoruButton
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeButton(i)}
                        aria-label="Remove button"
                      >
                        <Trash2 />
                      </ZoruButton>
                    </div>
                    <ZoruInput
                      value={btn.text}
                      onChange={(e) =>
                        updateButton(i, 'text', e.target.value)
                      }
                      placeholder="Button label"
                    />
                    {btn.type === 'URL' && (
                      <>
                        <ZoruInput
                          value={btn.url || ''}
                          onChange={(e) =>
                            updateButton(i, 'url', e.target.value)
                          }
                          placeholder="https://example.com/{{1}}"
                        />
                        {btn.url?.includes('{{') && (
                          <ZoruInput
                            name={`btn_${i}_url_example`}
                            placeholder="URL variable example"
                            className="text-[11px]"
                          />
                        )}
                      </>
                    )}
                    {btn.type === 'PHONE_NUMBER' && (
                      <ZoruInput
                        value={btn.phone_number || ''}
                        onChange={(e) =>
                          updateButton(i, 'phone_number', e.target.value)
                        }
                        placeholder="+1234567890"
                      />
                    )}
                    {btn.type === 'COPY_CODE' && (
                      <ZoruInput
                        value={(btn.example || [''])[0]}
                        onChange={(e) => {
                          const updated = [...buttons];
                          updated[i] = {
                            ...updated[i],
                            example: [e.target.value],
                          };
                          setButtons(updated);
                        }}
                        placeholder="Example code (e.g., ABC123)"
                      />
                    )}
                  </div>
                ))}

                {buttons.length < 10 && (
                  <div className="flex flex-wrap gap-1.5">
                    {BUTTON_TYPES.map((bt) => (
                      <button
                        key={bt.id}
                        type="button"
                        onClick={() => addButton(bt.id)}
                        className="flex items-center gap-1 rounded-[var(--zoru-radius)] border border-dashed border-zoru-line px-2.5 py-1.5 text-[11px] text-zoru-ink-muted transition-colors hover:border-zoru-line-strong hover:text-zoru-ink"
                      >
                        <Plus className="h-3 w-3" /> {bt.name}
                      </button>
                    ))}
                  </div>
                )}
              </ZoruCardContent>
            </ZoruCard>
          )}

          {/* SabNode features */}
          <ZoruCard>
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
          </ZoruCard>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <ZoruButton
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
            </ZoruButton>
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={() => router.push('/wachat/templates')}
            >
              Cancel
            </ZoruButton>
          </div>
        </div>

        {/* Preview Column */}
        {showPreview && (
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                <Smartphone className="h-3.5 w-3.5" /> Live preview
              </div>
              <ZoruCard variant="elevated">
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
              </ZoruCard>
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
      <ZoruDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Submit for Meta approval?</ZoruDialogTitle>
            <ZoruDialogDescription>
              Once submitted, this template will be reviewed by Meta. You will
              not be able to edit it until approved or rejected.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                setConfirmOpen(false);
                handleSubmit();
              }}
              disabled={isPending}
            >
              <Send /> Submit
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}

export default function CreateTemplatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1320px] px-6 pt-6">
          <ZoruSkeleton className="h-[400px] w-full" />
        </div>
      }
    >
      <CreateTemplateContent />
    </Suspense>
  );
}
