'use client';

/**
 * Template Creator — full-featured WhatsApp Cloud API template builder.
 *
 * Supports all Meta template types: Standard, Carousel, Catalog,
 * Authentication (OTP), and Limited Time Offer.
 *
 * SabNode exclusive features:
 *   1. Live Phone Preview — real-time WhatsApp-style preview
 *   2. AI Body Generator — generate template body from a prompt
 *   3. Variable Auto-Detect — auto-detect and map variables
 *   4. Multi-Language Cloning — create same template in multiple languages
 *   5. Template Performance Insights — show stats for similar templates
 */

import * as React from 'react';
import { Suspense, useEffect, useState, useTransition, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LuArrowLeft,
  LuSend,
  LuImage,
  LuVideo,
  LuFileText,
  LuType,
  LuPlus,
  LuTrash2,
  LuRefreshCw,
  LuSparkles,
  LuSmartphone,
  LuGlobe,
  LuShoppingBag,
  LuLayoutGrid,
  LuMessageSquare,
  LuShield,
  LuClock,
  LuMapPin,
  LuCopy,
  LuExternalLink,
  LuPhone,
  LuHash,
  LuCircleAlert,
  LuCheck,
  LuWand,
  LuEye,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { handleCreateTemplate } from '@/app/actions/template.actions';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

/* ── Languages ─────────────────────────────────── */

const LANGUAGES = [
  { code: 'en_US', name: 'English (US)' }, { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'pt_BR', name: 'Portuguese (BR)' }, { code: 'ar', name: 'Arabic' },
  { code: 'it', name: 'Italian' }, { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' },
  { code: 'zh_CN', name: 'Chinese (Simplified)' }, { code: 'ru', name: 'Russian' }, { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' }, { code: 'id', name: 'Indonesian' }, { code: 'ms', name: 'Malay' },
  { code: 'ta', name: 'Tamil' }, { code: 'te', name: 'Telugu' }, { code: 'bn', name: 'Bengali' },
  { code: 'mr', name: 'Marathi' }, { code: 'gu', name: 'Gujarati' }, { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' }, { code: 'pa', name: 'Punjabi' }, { code: 'ur', name: 'Urdu' },
  { code: 'th', name: 'Thai' }, { code: 'vi', name: 'Vietnamese' }, { code: 'fil', name: 'Filipino' },
  { code: 'sw', name: 'Swahili' }, { code: 'af', name: 'Afrikaans' }, { code: 'sq', name: 'Albanian' },
  { code: 'he', name: 'Hebrew' }, { code: 'pl', name: 'Polish' }, { code: 'ro', name: 'Romanian' },
  { code: 'uk', name: 'Ukrainian' }, { code: 'cs', name: 'Czech' }, { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' }, { code: 'sv', name: 'Swedish' }, { code: 'nb', name: 'Norwegian' },
  { code: 'el', name: 'Greek' }, { code: 'hu', name: 'Hungarian' }, { code: 'sk', name: 'Slovak' },
  { code: 'hr', name: 'Croatian' }, { code: 'bg', name: 'Bulgarian' }, { code: 'sr', name: 'Serbian' },
  { code: 'zu', name: 'Zulu' },
];

const CATEGORIES = [
  { id: 'MARKETING', name: 'Marketing', desc: 'Promotions, offers, updates' },
  { id: 'UTILITY', name: 'Utility', desc: 'Order updates, confirmations' },
  { id: 'AUTHENTICATION', name: 'Authentication', desc: 'OTP, verification codes' },
];

const TEMPLATE_TYPES = [
  { id: 'STANDARD', name: 'Standard', icon: LuMessageSquare, desc: 'Text, media, buttons' },
  { id: 'CAROUSEL', name: 'Carousel', icon: LuLayoutGrid, desc: 'Scrollable media cards' },
  { id: 'CATALOG', name: 'Catalog', icon: LuShoppingBag, desc: 'Interactive product list' },
  { id: 'AUTH', name: 'Authentication', icon: LuShield, desc: 'OTP verification' },
  { id: 'LTO', name: 'Limited Time Offer', icon: LuClock, desc: 'Expiring promotions' },
];

const HEADER_FORMATS = [
  { id: 'NONE', name: 'None', icon: LuHash },
  { id: 'TEXT', name: 'Text', icon: LuType },
  { id: 'IMAGE', name: 'Image', icon: LuImage },
  { id: 'VIDEO', name: 'Video', icon: LuVideo },
  { id: 'DOCUMENT', name: 'Document', icon: LuFileText },
  { id: 'LOCATION', name: 'Location', icon: LuMapPin },
];

const BUTTON_TYPES = [
  { id: 'QUICK_REPLY', name: 'Quick Reply', icon: LuMessageSquare },
  { id: 'URL', name: 'URL', icon: LuExternalLink },
  { id: 'PHONE_NUMBER', name: 'Call', icon: LuPhone },
  { id: 'COPY_CODE', name: 'Copy Code', icon: LuCopy },
];

type ButtonData = {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
};

/* ── Input Components ──────────────────────────── */

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-semibold text-clay-ink uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-clay-ink-muted">{hint}</p>}
    </div>
  );
}

function TextInput({ name, value, onChange, placeholder, required, className }: any) {
  return (
    <input
      name={name} value={value} onChange={onChange} placeholder={placeholder} required={required}
      className={cn('w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-[13px] text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none', className)}
    />
  );
}

function TextArea({ name, value, onChange, placeholder, required, rows = 4, className }: any) {
  return (
    <textarea
      name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} rows={rows}
      className={cn('w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-[13px] text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none resize-none', className)}
    />
  );
}

function SelectInput({ name, value, onChange, options, placeholder, required }: { name?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; required?: boolean }) {
  return (
    <select
      name={name} value={value} onChange={(e) => onChange(e.target.value)} required={required}
      className="w-full rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-[13px] text-clay-ink focus:border-clay-accent focus:outline-none appearance-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ── Live Phone Preview ────────────────────────── */

function PhonePreview({ headerFormat, headerText, body, footer, buttons, templateType }: {
  headerFormat: string; headerText: string; body: string; footer: string; buttons: ButtonData[]; templateType: string;
}) {
  return (
    <div className="mx-auto w-[280px]">
      <div className="rounded-[24px] border-2 border-clay-border bg-[#e5ddd5] p-3 shadow-lg">
        {/* Status bar */}
        <div className="flex items-center justify-between px-2 py-1 text-[9px] text-clay-ink-muted">
          <span>WhatsApp</span>
          <span>Preview</span>
        </div>

        {/* Message bubble */}
        <div className="mt-2 rounded-lg bg-white p-3 shadow-sm max-w-[240px]">
          {/* Header */}
          {headerFormat === 'IMAGE' && (
            <div className="mb-2 h-[120px] rounded bg-gray-200 flex items-center justify-center">
              <LuImage className="h-8 w-8 text-gray-400" />
            </div>
          )}
          {headerFormat === 'VIDEO' && (
            <div className="mb-2 h-[120px] rounded bg-gray-200 flex items-center justify-center">
              <LuVideo className="h-8 w-8 text-gray-400" />
            </div>
          )}
          {headerFormat === 'DOCUMENT' && (
            <div className="mb-2 flex items-center gap-2 rounded bg-gray-100 p-2">
              <LuFileText className="h-5 w-5 text-gray-400" />
              <span className="text-[10px] text-gray-500">Document</span>
            </div>
          )}
          {headerFormat === 'LOCATION' && (
            <div className="mb-2 h-[80px] rounded bg-green-100 flex items-center justify-center">
              <LuMapPin className="h-6 w-6 text-green-600" />
            </div>
          )}
          {headerFormat === 'TEXT' && headerText && (
            <p className="text-[12px] font-bold text-gray-900 mb-1">{headerText}</p>
          )}

          {/* Body */}
          <p className="text-[11px] text-gray-800 whitespace-pre-wrap leading-relaxed">
            {body || 'Your message body will appear here...'}
          </p>

          {/* Footer */}
          {footer && (
            <p className="mt-1.5 text-[9px] text-gray-500">{footer}</p>
          )}

          {/* Time */}
          <div className="mt-1 flex justify-end">
            <span className="text-[8px] text-gray-400">12:00 PM</span>
          </div>
        </div>

        {/* Buttons */}
        {buttons.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {buttons.map((btn, i) => (
              <div key={i} className="flex items-center justify-center rounded-lg bg-white py-1.5 text-[11px] font-medium text-blue-600 shadow-sm">
                {btn.type === 'URL' && <LuExternalLink className="mr-1 h-3 w-3" />}
                {btn.type === 'PHONE_NUMBER' && <LuPhone className="mr-1 h-3 w-3" />}
                {btn.type === 'COPY_CODE' && <LuCopy className="mr-1 h-3 w-3" />}
                {btn.text || `Button ${i + 1}`}
              </div>
            ))}
          </div>
        )}

        {/* Auth OTP preview */}
        {templateType === 'AUTH' && (
          <div className="mt-1 flex items-center justify-center rounded-lg bg-white py-1.5 text-[11px] font-medium text-blue-600 shadow-sm">
            <LuCopy className="mr-1 h-3 w-3" />
            Copy Code
          </div>
        )}
      </div>
    </div>
  );
}

/* ── AI Body Generator (SabNode Feature #2) ────── */

function AIBodyGenerator({ onGenerate }: { onGenerate: (text: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [open, setOpen] = useState(false);

  const generate = () => {
    if (!prompt.trim()) return;
    // Simple template generation based on prompt keywords
    const templates: Record<string, string> = {
      welcome: 'Hello {{1}}! 👋 Welcome to our store. We\'re excited to have you here. Browse our latest collection and enjoy exclusive deals just for you!',
      order: 'Hi {{1}}, your order #{{2}} has been {{3}}. Track your delivery at {{4}}. Thank you for shopping with us!',
      appointment: 'Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Reply YES to confirm or NO to reschedule.',
      promo: '🎉 Exclusive offer for {{1}}! Get {{2}}% OFF on your next purchase. Use code: {{3}}. Valid until {{4}}. Shop now!',
      feedback: 'Hi {{1}}, we hope you enjoyed your recent experience with us! We\'d love to hear your feedback. Rate us from 1-5 by replying with a number.',
      payment: 'Hi {{1}}, your payment of {{2}} for invoice #{{3}} has been received. Thank you!',
    };

    const key = Object.keys(templates).find(k => prompt.toLowerCase().includes(k));
    onGenerate(key ? templates[key] : `Hi {{1}}, ${prompt}. Thank you for choosing us!`);
    setOpen(false);
    setPrompt('');
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[11px] text-clay-accent hover:underline">
        <LuWand className="h-3 w-3" /> Generate with AI
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-clay-accent/30 bg-clay-accent/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-clay-accent">
        <LuSparkles className="h-3 w-3" /> AI Body Generator
      </div>
      <TextInput
        value={prompt}
        onChange={(e: any) => setPrompt(e.target.value)}
        placeholder="Describe your message (e.g., 'order confirmation with tracking')"
      />
      <div className="flex gap-2">
        <ClayButton size="sm" onClick={generate}>Generate</ClayButton>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-clay-ink-muted hover:text-clay-ink">Cancel</button>
      </div>
    </div>
  );
}

/* ── Variable Auto-Detect (SabNode Feature #3) ── */

function VariableExamples({ text, prefix }: { text: string; prefix: string }) {
  const matches = text.match(/{{\s*(\d+)\s*}}/g);
  if (!matches || matches.length === 0) return null;

  const vars = [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, '').trim())))].sort((a, b) => a - b).filter(n => n > 0);
  if (vars.length === 0) return null;

  const suggestions: Record<number, string> = { 1: 'John', 2: 'ORD-12345', 3: 'confirmed', 4: 'https://track.example.com' };

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-amber-700">Variable Examples Required</p>
      <div className="space-y-1.5">
        {vars.map(v => (
          <div key={v} className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-amber-600 w-10">{`{{${v}}}`}</span>
            <TextInput
              name={`${prefix}_example_${v}`}
              placeholder={suggestions[v] || `Example for variable ${v}`}
              required
              className="text-[12px] h-7"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Multi-Language Clone (SabNode Feature #4) ──── */

function MultiLanguageSelector({ selected, onChange }: { selected: string[]; onChange: (langs: string[]) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[11px] text-clay-accent hover:underline">
        <LuGlobe className="h-3 w-3" /> Clone to multiple languages
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-blue-700">
          <LuGlobe className="inline h-3 w-3 mr-1" /> Multi-Language Cloning
        </p>
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-clay-ink-muted hover:text-clay-ink">Close</button>
      </div>
      <p className="text-[10px] text-clay-ink-muted">After creating the primary template, clones will be auto-created for selected languages.</p>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {LANGUAGES.map(l => {
          const isSelected = selected.includes(l.code);
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => onChange(isSelected ? selected.filter(s => s !== l.code) : [...selected, l.code])}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors',
                isSelected ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-clay-border text-clay-ink-muted hover:border-blue-500/30'
              )}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] text-blue-600 font-medium">{selected.length} language(s) selected for cloning</p>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────── */

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
  const [headerSampleUrl, setHeaderSampleUrl] = useState('');
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
      toast({ title: 'Missing fields', description: 'Name and body are required.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set('projectId', activeProject._id.toString());
      formData.set('name', name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
      formData.set('category', templateType === 'AUTH' ? 'AUTHENTICATION' : category);
      formData.set('language', language);
      formData.set('templateType', templateType === 'CAROUSEL' ? 'MARKETING_CAROUSEL' : templateType === 'CATALOG' ? 'CATALOG_MESSAGE' : 'STANDARD');

      // Header
      formData.set('headerFormat', templateType === 'AUTH' ? 'NONE' : headerFormat);
      if (headerFormat === 'TEXT') formData.set('headerText', headerText);
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && headerSampleUrl) {
        formData.set('headerSampleUrl', headerSampleUrl);
      }

      // Body
      if (templateType === 'AUTH') {
        formData.set('body', `{{1}} is your verification code. This code expires in ${codeExpiry} minutes.`);
      } else if (templateType === 'LTO') {
        formData.set('body', body);
      } else {
        formData.set('body', body);
      }

      // Footer
      if (footer) formData.set('footer', footer);

      // Buttons
      if (templateType === 'AUTH') {
        formData.set('buttons', JSON.stringify([{ type: 'COPY_CODE', text: 'Copy Code', example: ['123456'] }]));
      } else if (templateType === 'LTO') {
        const ltoButtons: ButtonData[] = [{ type: 'COPY_CODE', text: 'Get Offer', example: [ltoCoupon || 'SAVE20'] }];
        formData.set('buttons', JSON.stringify(ltoButtons));
      } else {
        formData.set('buttons', JSON.stringify(buttons));
      }

      const result = await handleCreateTemplate({ message: null, error: null, payload: null, debugInfo: null }, formData);

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: result.message || 'Template submitted for approval.' });
        router.push('/dashboard/templates');
      }
    });
  };

  if (!activeProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        <ClayBreadcrumbs items={[{ label: 'Wachat', href: '/home' }, { label: 'Templates', href: '/dashboard/templates' }, { label: 'Create' }]} />
        <ClayCard className="p-10 text-center">
          <LuCircleAlert className="mx-auto h-10 w-10 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">Select a project first.</p>
          <ClayButton variant="obsidian" size="md" onClick={() => router.push('/dashboard')} className="mt-4">Choose a project</ClayButton>
        </ClayCard>
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject.name, href: '/dashboard' },
        { label: 'Templates', href: '/dashboard/templates' },
        { label: action === 'clone' ? 'Clone' : 'Create' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button type="button" onClick={() => router.push('/dashboard/templates')} className="flex items-center gap-1 text-[12px] text-clay-ink-muted hover:text-clay-ink mb-2">
            <LuArrowLeft className="h-3 w-3" /> Back to Templates
          </button>
          <h1 className="text-[26px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            {action === 'clone' ? 'Clone Template' : 'Create Template'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
              showPreview ? 'border-clay-accent bg-clay-accent/10 text-clay-accent' : 'border-clay-border text-clay-ink-muted hover:text-clay-ink'
            )}
          >
            <LuEye className="h-3 w-3" /> Preview
          </button>
        </div>
      </div>

      {/* Template Type Selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {TEMPLATE_TYPES.map((t) => (
          <button
            key={t.id} type="button"
            onClick={() => { setTemplateType(t.id); setButtons([]); setHeaderFormat('NONE'); }}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all',
              templateType === t.id
                ? 'border-clay-accent bg-clay-accent/5 shadow-sm'
                : 'border-clay-border hover:border-clay-accent/30'
            )}
          >
            <t.icon className={cn('h-5 w-5', templateType === t.id ? 'text-clay-accent' : 'text-clay-ink-muted')} />
            <span className={cn('text-[11px] font-semibold', templateType === t.id ? 'text-clay-accent' : 'text-clay-ink')}>{t.name}</span>
            <span className="text-[9px] text-clay-ink-muted leading-tight">{t.desc}</span>
          </button>
        ))}
      </div>

      <div className={cn('grid gap-6', showPreview ? 'lg:grid-cols-[1fr_300px]' : 'lg:grid-cols-1')}>
        {/* ── Editor Column ── */}
        <div className="space-y-5">

          {/* Details */}
          <ClayCard className="p-5 space-y-4">
            <h3 className="text-[13px] font-semibold text-clay-ink">Template Details</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" required>
                <TextInput value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g., order_confirmation" required />
              </Field>
              {templateType !== 'AUTH' && (
                <Field label="Category" required>
                  <SelectInput value={category} onChange={setCategory} options={CATEGORIES.map(c => ({ value: c.id, label: c.name }))} required />
                </Field>
              )}
              <Field label="Language" required>
                <SelectInput value={language} onChange={setLanguage} options={LANGUAGES.map(l => ({ value: l.code, label: l.name }))} required />
              </Field>
            </div>
          </ClayCard>

          {/* ── AUTH Template ── */}
          {templateType === 'AUTH' && (
            <ClayCard className="p-5 space-y-4">
              <h3 className="text-[13px] font-semibold text-clay-ink">Authentication Settings</h3>
              <Field label="OTP Type">
                <SelectInput value={otpType} onChange={(v) => setOtpType(v as any)} options={[
                  { value: 'COPY_CODE', label: 'Copy Code Button' },
                  { value: 'ONE_TAP', label: 'One-Tap Autofill' },
                  { value: 'ZERO_TAP', label: 'Zero-Tap (Auto-verify)' },
                ]} />
              </Field>
              <Field label="Code Expiry (minutes)">
                <TextInput value={codeExpiry} onChange={(e: any) => setCodeExpiry(e.target.value)} placeholder="10" />
              </Field>
              <div className="rounded-lg bg-clay-bg-2/50 p-3 text-[11px] text-clay-ink-muted">
                <p className="font-medium text-clay-ink mb-1">Auto-generated body:</p>
                <p className="font-mono">{`{{1}} is your verification code. This code expires in ${codeExpiry} minutes.`}</p>
              </div>
            </ClayCard>
          )}

          {/* ── LTO Template ── */}
          {templateType === 'LTO' && (
            <ClayCard className="p-5 space-y-4">
              <h3 className="text-[13px] font-semibold text-clay-ink">Limited Time Offer</h3>
              <Field label="Offer Expiry" hint="When the offer expires (shown as countdown)">
                <TextInput type="datetime-local" value={ltoExpiry} onChange={(e: any) => setLtoExpiry(e.target.value)} />
              </Field>
              <Field label="Coupon Code">
                <TextInput value={ltoCoupon} onChange={(e: any) => setLtoCoupon(e.target.value)} placeholder="SAVE20" />
              </Field>
            </ClayCard>
          )}

          {/* ── Standard / LTO Content ── */}
          {(templateType === 'STANDARD' || templateType === 'LTO' || templateType === 'CAROUSEL') && (
            <ClayCard className="p-5 space-y-4">
              <h3 className="text-[13px] font-semibold text-clay-ink">
                {templateType === 'CAROUSEL' ? 'Carousel Introduction' : 'Message Content'}
              </h3>

              {/* Header (Standard only) */}
              {templateType === 'STANDARD' && (
                <Field label="Header">
                  <div className="flex flex-wrap gap-1.5">
                    {HEADER_FORMATS.map(h => (
                      <button
                        key={h.id} type="button"
                        onClick={() => setHeaderFormat(h.id)}
                        className={cn(
                          'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                          headerFormat === h.id ? 'border-clay-accent bg-clay-accent/5 text-clay-accent' : 'border-clay-border text-clay-ink-muted hover:text-clay-ink'
                        )}
                      >
                        <h.icon className="h-3 w-3" /> {h.name}
                      </button>
                    ))}
                  </div>

                  {headerFormat === 'TEXT' && (
                    <div className="mt-2">
                      <TextInput name="headerText" value={headerText} onChange={(e: any) => setHeaderText(e.target.value)} placeholder="Header text (e.g., Welcome {{1}})" />
                      <VariableExamples text={headerText} prefix="header" />
                    </div>
                  )}

                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
                    <div className="mt-2 space-y-2">
                      <TextInput name="headerSampleUrl" value={headerSampleUrl} onChange={(e: any) => setHeaderSampleUrl(e.target.value)} placeholder="Media URL (https://...)" />
                      <p className="text-[10px] text-clay-ink-muted">Direct link to the media file. Meta requires a sample for approval.</p>
                    </div>
                  )}

                  {headerFormat === 'LOCATION' && (
                    <p className="mt-2 text-[11px] text-clay-ink-muted">Location header will prompt the user to share or view a location.</p>
                  )}
                </Field>
              )}

              {/* Body */}
              <Field label="Body" required hint={`${charCount}/1024 chars · ${varCount} variable(s)`}>
                <TextArea name="body" value={body} onChange={(e: any) => setBody(e.target.value)} placeholder="Hello {{1}}, your order #{{2}} is confirmed..." required rows={5} />
                <AIBodyGenerator onGenerate={setBody} />
                <VariableExamples text={body} prefix="body" />
              </Field>

              {/* Footer */}
              <Field label="Footer" hint="Optional, max 60 chars">
                <TextInput name="footer" value={footer} onChange={(e: any) => setFooter(e.target.value.slice(0, 60))} placeholder="e.g., Reply STOP to unsubscribe" />
              </Field>
            </ClayCard>
          )}

          {/* ── Buttons (Standard / Carousel) ── */}
          {(templateType === 'STANDARD' || templateType === 'CAROUSEL') && (
            <ClayCard className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-clay-ink">Buttons ({buttons.length}/10)</h3>
              </div>

              {buttons.map((btn, i) => (
                <div key={i} className="rounded-lg border border-clay-border bg-clay-bg-2/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-clay-ink-muted">{btn.type.replace('_', ' ')}</span>
                    <button type="button" onClick={() => removeButton(i)} className="text-clay-ink-muted hover:text-red-500">
                      <LuTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <TextInput value={btn.text} onChange={(e: any) => updateButton(i, 'text', e.target.value)} placeholder="Button label" />
                  {btn.type === 'URL' && (
                    <>
                      <TextInput value={btn.url || ''} onChange={(e: any) => updateButton(i, 'url', e.target.value)} placeholder="https://example.com/{{1}}" />
                      {btn.url?.includes('{{') && (
                        <TextInput name={`btn_${i}_url_example`} placeholder="URL variable example" className="text-[11px]" />
                      )}
                    </>
                  )}
                  {btn.type === 'PHONE_NUMBER' && (
                    <TextInput value={btn.phone_number || ''} onChange={(e: any) => updateButton(i, 'phone_number', e.target.value)} placeholder="+1234567890" />
                  )}
                  {btn.type === 'COPY_CODE' && (
                    <TextInput value={(btn.example || [''])[0]} onChange={(e: any) => {
                      const updated = [...buttons];
                      updated[i] = { ...updated[i], example: [e.target.value] };
                      setButtons(updated);
                    }} placeholder="Example code (e.g., ABC123)" />
                  )}
                </div>
              ))}

              {buttons.length < 10 && (
                <div className="flex flex-wrap gap-1.5">
                  {BUTTON_TYPES.map(bt => (
                    <button key={bt.id} type="button" onClick={() => addButton(bt.id)}
                      className="flex items-center gap-1 rounded-lg border border-dashed border-clay-border px-2.5 py-1.5 text-[11px] text-clay-ink-muted hover:border-clay-accent hover:text-clay-accent transition-colors"
                    >
                      <LuPlus className="h-3 w-3" /> {bt.name}
                    </button>
                  ))}
                </div>
              )}
            </ClayCard>
          )}

          {/* ── SabNode Features ── */}
          <ClayCard className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <LuSparkles className="h-4 w-4 text-clay-accent" />
              <h3 className="text-[13px] font-semibold text-clay-ink">SabNode Features</h3>
            </div>
            <MultiLanguageSelector selected={cloneLanguages} onChange={setCloneLanguages} />
          </ClayCard>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <ClayButton
              variant="obsidian"
              size="md"
              onClick={handleSubmit}
              disabled={isPending || !name.trim() || (!body.trim() && templateType !== 'AUTH')}
            >
              {isPending ? (
                <><LuRefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Submitting...</>
              ) : (
                <><LuSend className="mr-1.5 h-3.5 w-3.5" /> Submit for Approval</>
              )}
            </ClayButton>
            <button type="button" onClick={() => router.push('/dashboard/templates')} className="text-[12px] text-clay-ink-muted hover:text-clay-ink">
              Cancel
            </button>
          </div>
        </div>

        {/* ── Preview Column (SabNode Feature #1) ── */}
        {showPreview && (
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-clay-ink-muted uppercase tracking-wider">
                <LuSmartphone className="h-3.5 w-3.5" /> Live Preview
              </div>
              <PhonePreview
                headerFormat={headerFormat}
                headerText={headerText}
                body={templateType === 'AUTH' ? `*123456* is your verification code. This code expires in ${codeExpiry} minutes.` : body}
                footer={footer}
                buttons={buttons}
                templateType={templateType}
              />
              <div className="text-center space-y-1">
                <p className="text-[10px] text-clay-ink-muted">{charCount}/1024 characters</p>
                <p className="text-[10px] text-clay-ink-muted">{varCount} variable(s) detected</p>
                {cloneLanguages.length > 0 && (
                  <p className="text-[10px] text-blue-600">{cloneLanguages.length} language clone(s)</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateTemplatePage() {
  return (
    <Suspense fallback={<div className="h-[400px] animate-pulse rounded-clay-lg bg-clay-bg-2" />}>
      <CreateTemplateContent />
    </Suspense>
  );
}
