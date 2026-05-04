'use client';

/**
 * CreateTemplateForm (wachat-local, ZoruUI)
 *
 * The WhatsApp template builder. Three top-level template types:
 *   - STANDARD            (text/media + buttons)            — full parity
 *   - MARKETING_CAROUSEL  (scrollable cards)                — STUBBED
 *   - CATALOG_MESSAGE     (catalog product picker)          — STUBBED
 *
 * The 80% case (STANDARD) is fully reproduced on Zoru primitives.
 * Carousel and Catalog modes show a TODO placeholder pending zoru-port
 * of CarouselBuilder + ProductPicker (currently wabasimplify-only).
 *
 * Server-action calls preserved 1:1:
 *   handleCreateTemplate (default)
 *   saveLibraryTemplate  (isAdminForm)
 *   handleBulkCreateTemplate (isBulkForm)
 *
 * NOTE: FlowsEncryptionDialog (Meta error 139002 fallback) is also
 * stubbed — error surfaces via toast instead. TODO: zoru-local port.
 */

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  FileUp,
  LayoutGrid,
  Loader2,
  MessageSquare,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  handleBulkCreateTemplate,
  handleCreateTemplate,
  saveLibraryTemplate,
} from '@/app/actions/template.actions';
import { getTemplateCategories } from '@/app/actions/plan.actions';
import { getCatalogs, type Catalog } from '@/app/actions/catalog.actions';
import type {
  CreateTemplateState,
  Project,
  Template,
} from '@/lib/definitions';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruInput,
  ZoruLabel,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';

const createTemplateInitialState: CreateTemplateState = {
  message: null,
  error: null,
  payload: null,
  debugInfo: null,
};

function SubmitButton({
  templateType,
  isAdminForm,
  isBulkForm,
}: {
  templateType: string;
  isAdminForm?: boolean;
  isBulkForm?: boolean;
}) {
  const { pending } = useFormStatus();
  let buttonText = 'Submit for Approval';
  if (isAdminForm) buttonText = 'Save to Library';
  else if (isBulkForm) buttonText = 'Save to All Selected Projects';
  else if (templateType === 'CATALOG_MESSAGE')
    buttonText = 'Save Product Carousel';
  else if (templateType === 'MARKETING_CAROUSEL')
    buttonText = 'Submit Carousel for Approval';

  return (
    <ZoruButton size="lg" type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileUp className="h-4 w-4" />
      )}
      {pending ? 'Submitting…' : buttonText}
    </ZoruButton>
  );
}

type ButtonType = {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
  payload?: string;
  example?: string[];
};

const languages = [
  { name: 'Afrikaans', code: 'af' },
  { name: 'Albanian', code: 'sq' },
  { name: 'Arabic', code: 'ar' },
  { name: 'Azerbaijani', code: 'az' },
  { name: 'Bengali', code: 'bn' },
  { name: 'Bulgarian', code: 'bg' },
  { name: 'Catalan', code: 'ca' },
  { name: 'Chinese (CHN)', code: 'zh_CN' },
  { name: 'Chinese (HKG)', code: 'zh_HK' },
  { name: 'Chinese (TAI)', code: 'zh_TW' },
  { name: 'Croatian', code: 'hr' },
  { name: 'Czech', code: 'cs' },
  { name: 'Danish', code: 'da' },
  { name: 'Dutch', code: 'nl' },
  { name: 'English', code: 'en' },
  { name: 'English (US)', code: 'en_US' },
  { name: 'Estonian', code: 'et' },
  { name: 'Filipino', code: 'fil' },
  { name: 'Finnish', code: 'fi' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  { name: 'Greek', code: 'el' },
  { name: 'Gujarati', code: 'gu' },
  { name: 'Hebrew', code: 'he' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Hungarian', code: 'hu' },
  { name: 'Indonesian', code: 'id' },
  { name: 'Irish', code: 'ga' },
  { name: 'Italian', code: 'it' },
  { name: 'Japanese', code: 'ja' },
  { name: 'Kannada', code: 'kn' },
  { name: 'Korean', code: 'ko' },
  { name: 'Malay', code: 'ms' },
  { name: 'Malayalam', code: 'ml' },
  { name: 'Marathi', code: 'mr' },
  { name: 'Norwegian', code: 'nb' },
  { name: 'Persian', code: 'fa' },
  { name: 'Polish', code: 'pl' },
  { name: 'Portuguese (BR)', code: 'pt_BR' },
  { name: 'Portuguese (POR)', code: 'pt_PT' },
  { name: 'Punjabi', code: 'pa' },
  { name: 'Romanian', code: 'ro' },
  { name: 'Russian', code: 'ru' },
  { name: 'Serbian', code: 'sr' },
  { name: 'Slovak', code: 'sk' },
  { name: 'Slovenian', code: 'sl' },
  { name: 'Spanish', code: 'es' },
  { name: 'Spanish (ARG)', code: 'es_AR' },
  { name: 'Spanish (MEX)', code: 'es_MX' },
  { name: 'Spanish (SPA)', code: 'es_ES' },
  { name: 'Swahili', code: 'sw' },
  { name: 'Swedish', code: 'sv' },
  { name: 'Tamil', code: 'ta' },
  { name: 'Telugu', code: 'te' },
  { name: 'Thai', code: 'th' },
  { name: 'Turkish', code: 'tr' },
  { name: 'Ukrainian', code: 'uk' },
  { name: 'Urdu', code: 'ur' },
  { name: 'Uzbek', code: 'uz' },
  { name: 'Vietnamese', code: 'vi' },
  { name: 'Zulu', code: 'zu' },
];

interface CreateTemplateFormProps {
  project?: WithId<Project>;
  bulkProjectIds?: string[];
  initialTemplate?: WithId<Template> | null;
  isCloning?: boolean;
  isAdminForm?: boolean;
  isBulkForm?: boolean;
}

export function CreateTemplateForm({
  project,
  bulkProjectIds = [],
  initialTemplate,
  isCloning,
  isAdminForm = false,
  isBulkForm = false,
}: CreateTemplateFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  let serverAction: any = handleCreateTemplate;
  if (isAdminForm) serverAction = saveLibraryTemplate;
  if (isBulkForm) serverAction = handleBulkCreateTemplate;

  const [, startTransition] = useTransition();
  const [state, setState] = useState(createTemplateInitialState);

  const [templateType, setTemplateType] = useState<
    'STANDARD' | 'CATALOG_MESSAGE' | 'MARKETING_CAROUSEL'
  >('STANDARD');

  // Standard fields
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<Template['category'] | ''>('');
  const [language, setLanguage] = useState('en_US');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [headerFormat, setHeaderFormat] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerSampleUrl, setHeaderSampleUrl] = useState('');
  const [buttons, setButtons] = useState<ButtonType[]>([]);
  const [categories, setCategories] = useState<
    { id: string; name: string }[]
  >([]);

  // Catalog state (only the fields wired to FormData; product picker stubbed)
  const [catalogId, setCatalogId] = useState('');
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [catalogSection1Title, setCatalogSection1Title] = useState(
    'Featured Items',
  );
  const [catalogSection2Title, setCatalogSection2Title] =
    useState('More Products');
  const [catalogHeader, setCatalogHeader] = useState('');
  const [catalogBody, setCatalogBody] = useState('Check out our catalog!');
  const [catalogFooter, setCatalogFooter] = useState('');

  // Initial load
  useEffect(() => {
    if (isAdminForm) {
      getTemplateCategories().then((data) =>
        setCategories(data.map((c) => ({ id: c.name, name: c.name }))),
      );
    } else {
      setCategories([
        { id: 'MARKETING', name: 'Marketing' },
        { id: 'UTILITY', name: 'Utility' },
        { id: 'AUTHENTICATION', name: 'Authentication' },
      ]);
    }

    if (project && !isAdminForm && !isBulkForm) {
      getCatalogs(project._id.toString()).then((res) => {
        if (res.catalogs) setCatalogs(res.catalogs);
      });
    }
  }, [isAdminForm, isBulkForm, project]);

  // Restore from clone/edit
  useEffect(() => {
    if (initialTemplate) {
      setTemplateName(
        isCloning ? `${initialTemplate.name}_copy` : initialTemplate.name,
      );
      setLanguage(initialTemplate.language);
      setCategory(initialTemplate.category || '');

      if (initialTemplate.type === 'MARKETING_CAROUSEL') {
        setTemplateType('MARKETING_CAROUSEL');
      } else if (initialTemplate.type === 'CATALOG_MESSAGE') {
        setTemplateType('CATALOG_MESSAGE');
      } else {
        setTemplateType('STANDARD');
        const bodyComp = initialTemplate.components?.find(
          (c) => c.type === 'BODY',
        );
        setBody(bodyComp?.text || '');
      }
    }
  }, [initialTemplate, isCloning]);

  const formAction = (formData: FormData) => {
    if (templateType === 'MARKETING_CAROUSEL') {
      // TODO: zoru-port CarouselBuilder. Until then we send empty cards.
      formData.set('carouselCards', JSON.stringify([]));
    } else if (templateType === 'CATALOG_MESSAGE') {
      formData.set('catalogId', catalogId);
      formData.set('carouselHeader', catalogHeader);
      formData.set('carouselBody', catalogBody);
      formData.set('carouselFooter', catalogFooter);
      formData.set('section1Title', catalogSection1Title);
      // TODO: zoru-port ProductPicker — section IDs currently unset.
      formData.set('section1ProductIDs', '');
      if (catalogSection2Title) {
        formData.set('section2Title', catalogSection2Title);
        formData.set('section2ProductIDs', '');
      }
    } else {
      formData.set('buttons', JSON.stringify(buttons));
    }

    startTransition(async () => {
      const result = await serverAction(createTemplateInitialState, formData);
      setState(result);
    });
  };

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      if (isAdminForm) router.push('/admin/dashboard/template-library');
      else if (isBulkForm) router.push('/wachat');
      else router.push('/wachat/templates');
    }
    if (state?.error) {
      // TODO: zoru-port FlowsEncryptionDialog (Meta 139002 fallback).
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, router, toast, isAdminForm, isBulkForm]);

  return (
    <form action={formAction}>
      {project && (
        <input
          type="hidden"
          name="projectId"
          value={project._id.toString()}
        />
      )}
      {isBulkForm && (
        <input
          type="hidden"
          name="projectIds"
          value={bulkProjectIds.join(',')}
        />
      )}
      <input type="hidden" name="templateType" value={templateType} />

      {/* Type selector */}
      <div className="mb-8">
        <ZoruLabel className="text-base mb-2 block text-zoru-ink">
          Choose Template Type
        </ZoruLabel>
        <ZoruRadioGroup
          value={templateType}
          onValueChange={(v) => {
            const newType = v as
              | 'STANDARD'
              | 'CATALOG_MESSAGE'
              | 'MARKETING_CAROUSEL';
            setTemplateType(newType);
            // reset
            setTemplateName('');
            setBody('');
            setFooter('');
            setHeaderFormat('NONE');
            setHeaderText('');
            setHeaderSampleUrl('');
            setButtons([]);
            setCatalogId('');
            setCatalogHeader('');
            setCatalogBody('Check out our catalog!');
            setCatalogFooter('');
            setCatalogSection1Title('Featured Items');
            setCatalogSection2Title('More Products');
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <TypeCard
            value="STANDARD"
            id="t-standard"
            icon={<MessageSquare className="h-6 w-6" />}
            title="Standard Message"
            description="Text, Media, Buttons"
            active={templateType === 'STANDARD'}
          />
          <TypeCard
            value="MARKETING_CAROUSEL"
            id="t-carousel"
            icon={<LayoutGrid className="h-6 w-6" />}
            title="Marketing Carousel"
            description="Scrollable cards with media"
            active={templateType === 'MARKETING_CAROUSEL'}
          />
          <TypeCard
            value="CATALOG_MESSAGE"
            id="t-catalog"
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Product Catalog"
            description="Interactive product list"
            active={templateType === 'CATALOG_MESSAGE'}
          />
        </ZoruRadioGroup>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editor column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Common details */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Template Details</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <ZoruLabel>Name</ZoruLabel>
                <ZoruInput
                  name="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., summer_promo"
                  required
                />
              </div>
              {templateType !== 'CATALOG_MESSAGE' && (
                <>
                  <div className="space-y-2">
                    <ZoruLabel>Category</ZoruLabel>
                    <ZoruSelect
                      name="category"
                      value={category}
                      onValueChange={(v) => setCategory(v as any)}
                      required
                    >
                      <ZoruSelectTrigger>
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {categories.map((c) => (
                          <ZoruSelectItem key={c.id} value={c.id}>
                            {c.name}
                          </ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </ZoruSelect>
                  </div>
                  <div className="space-y-2">
                    <ZoruLabel>Language</ZoruLabel>
                    <ZoruSelect
                      name="language"
                      value={language}
                      onValueChange={setLanguage}
                      required
                    >
                      <ZoruSelectTrigger>
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {languages.map((l) => (
                          <ZoruSelectItem key={l.code} value={l.code}>
                            {l.name}
                          </ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </ZoruSelect>
                  </div>
                </>
              )}
            </ZoruCardContent>
          </ZoruCard>

          {/* STANDARD message editor */}
          {templateType === 'STANDARD' && (
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Message Content</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-6">
                {/* Header */}
                <div className="space-y-3">
                  <ZoruLabel>Header</ZoruLabel>
                  <ZoruRadioGroup
                    value={headerFormat}
                    onValueChange={setHeaderFormat}
                    className="flex flex-wrap gap-2"
                  >
                    {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(
                      (f) => (
                        <label
                          key={f}
                          htmlFor={`h-${f}`}
                          className={cn(
                            'flex items-center space-x-2 rounded-[var(--zoru-radius)] border p-2 cursor-pointer transition-colors',
                            headerFormat === f
                              ? 'border-zoru-ink bg-zoru-surface-2'
                              : 'border-zoru-line hover:bg-zoru-surface',
                          )}
                        >
                          <ZoruRadioGroupItem value={f} id={`h-${f}`} />
                          <span className="text-[13px] text-zoru-ink">
                            {f}
                          </span>
                        </label>
                      ),
                    )}
                  </ZoruRadioGroup>
                  <input
                    type="hidden"
                    name="headerFormat"
                    value={headerFormat}
                  />

                  {headerFormat === 'TEXT' && (
                    <div className="space-y-2">
                      <ZoruInput
                        name="headerText"
                        placeholder="Header Text (e.g. Welcome {{1}})"
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                      />
                      {headerText.match(/{{\s*(\d+)\s*}}/g) && (
                        <div className="mt-2 rounded-[var(--zoru-radius)] bg-zoru-surface p-2 text-sm">
                          <ZoruLabel className="text-xs mb-1 block">
                            Header Variable Example
                          </ZoruLabel>
                          <ZoruInput
                            name="headerExample"
                            placeholder="e.g. Discount"
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {(headerFormat === 'IMAGE' ||
                    headerFormat === 'VIDEO' ||
                    headerFormat === 'DOCUMENT') && (
                    <div className="space-y-2">
                      <ZoruInput
                        type="file"
                        name="headerSampleFile"
                        accept={
                          headerFormat === 'IMAGE'
                            ? 'image/jpeg,image/png'
                            : headerFormat === 'VIDEO'
                              ? 'video/mp4'
                              : headerFormat === 'DOCUMENT'
                                ? 'application/pdf'
                                : undefined
                        }
                      />
                      <div className="text-xs text-zoru-ink-muted">OR</div>
                      <ZoruInput
                        name="headerSampleUrl"
                        placeholder="https://..."
                        value={headerSampleUrl}
                        onChange={(e) => setHeaderSampleUrl(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="space-y-2">
                  <ZoruLabel>Body</ZoruLabel>
                  <ZoruTextarea
                    name="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Hello {{1}}..."
                    className="min-h-[120px]"
                    required
                  />
                  {/* Body variable examples */}
                  {(() => {
                    const matches = body.match(/{{\s*(\d+)\s*}}/g);
                    if (matches && matches.length > 0) {
                      const vars = [
                        ...new Set(
                          matches.map((m) => {
                            const matchResult = m.match(/\d+/);
                            return matchResult
                              ? parseInt(matchResult[0])
                              : 0;
                          }),
                        ),
                      ]
                        .sort((a, b) => a - b)
                        .filter((n) => n > 0);

                      if (vars.length > 0) {
                        return (
                          <div className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3 mt-2">
                            <ZoruLabel className="text-xs">
                              Variable Examples (Required)
                            </ZoruLabel>
                            <div className="grid gap-2">
                              {vars.map((v) => (
                                <div
                                  key={v}
                                  className="flex items-center gap-2"
                                >
                                  <span className="text-xs text-zoru-ink-muted w-8 font-mono">
                                    {`{{${v}}}`}
                                  </span>
                                  <ZoruInput
                                    name={`body_example_${v}`}
                                    placeholder="e.g. John"
                                    className="text-sm"
                                    required
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>

                {/* Footer */}
                <div className="space-y-2">
                  <ZoruLabel>Footer (Optional)</ZoruLabel>
                  <ZoruInput
                    name="footer"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                  />
                </div>
              </ZoruCardContent>

              {/* Buttons editor */}
              <ZoruCardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between">
                  <ZoruLabel className="text-base">
                    Buttons ({buttons.length})
                  </ZoruLabel>
                </div>

                {buttons.map((b, i) => (
                  <div
                    key={i}
                    className="relative space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3"
                  >
                    <div className="text-xs text-zoru-ink-muted">{b.type}</div>
                    <ZoruInput
                      placeholder="Label"
                      value={b.text}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[i] = { ...b, text: e.target.value };
                        setButtons(newBtns);
                      }}
                    />
                    <ZoruButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1 right-1"
                      onClick={() =>
                        setButtons((btns) =>
                          btns.filter((_, idx) => idx !== i),
                        )
                      }
                      aria-label="Remove button"
                    >
                      <Trash2 className="h-3 w-3" />
                    </ZoruButton>

                    {b.type === 'URL' && (
                      <ZoruInput
                        placeholder="https://website.com"
                        value={b.url || ''}
                        onChange={(e) => {
                          const newBtns = [...buttons];
                          newBtns[i] = { ...b, url: e.target.value };
                          setButtons(newBtns);
                        }}
                      />
                    )}

                    {b.type === 'PHONE_NUMBER' && (
                      <ZoruInput
                        placeholder="+1234567890"
                        value={b.phone_number || ''}
                        onChange={(e) => {
                          const newBtns = [...buttons];
                          newBtns[i] = {
                            ...b,
                            phone_number: e.target.value,
                          };
                          setButtons(newBtns);
                        }}
                      />
                    )}
                  </div>
                ))}
                {buttons.length < 3 && (
                  <div className="flex gap-2">
                    <ZoruButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setButtons([
                          ...buttons,
                          { type: 'QUICK_REPLY', text: '' },
                        ])
                      }
                    >
                      Quick Reply
                    </ZoruButton>
                    <ZoruButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setButtons([
                          ...buttons,
                          { type: 'URL', text: '', url: '' },
                        ])
                      }
                    >
                      URL
                    </ZoruButton>
                  </div>
                )}
              </ZoruCardContent>
            </ZoruCard>
          )}

          {/* MARKETING_CAROUSEL — stubbed */}
          {templateType === 'MARKETING_CAROUSEL' && (
            <ZoruAlert>
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertTitle>Marketing Carousel — TODO</ZoruAlertTitle>
              <ZoruAlertDescription>
                The carousel builder UI hasn&apos;t been ported to ZoruUI yet.
                Submitting will create an empty-card carousel — please use
                the legacy Wachat builder for now if you need card content.
              </ZoruAlertDescription>
            </ZoruAlert>
          )}

          {/* CATALOG_MESSAGE — partial */}
          {templateType === 'CATALOG_MESSAGE' && (
            <div className="space-y-6">
              <ZoruCard>
                <ZoruCardHeader>
                  <ZoruCardTitle>Catalog Configuration</ZoruCardTitle>
                  <ZoruCardDescription>
                    Select a catalog and define your sections.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                  <div className="space-y-2">
                    <ZoruLabel>Select Catalog</ZoruLabel>
                    <ZoruSelect
                      value={catalogId}
                      onValueChange={setCatalogId}
                      required
                    >
                      <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="Choose a catalog..." />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {catalogs.map((c) => (
                          <ZoruSelectItem key={c.id} value={c.id}>
                            {c.name} ({c.id})
                          </ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </ZoruSelect>
                  </div>

                  <div className="space-y-2">
                    <ZoruLabel>Header Text (Optional)</ZoruLabel>
                    <ZoruInput
                      value={catalogHeader}
                      onChange={(e) => setCatalogHeader(e.target.value)}
                      placeholder="Our Collection"
                    />
                  </div>
                  <div className="space-y-2">
                    <ZoruLabel>Body Text</ZoruLabel>
                    <ZoruTextarea
                      value={catalogBody}
                      onChange={(e) => setCatalogBody(e.target.value)}
                      placeholder="Check out these items..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <ZoruLabel>Footer Text (Optional)</ZoruLabel>
                    <ZoruInput
                      value={catalogFooter}
                      onChange={(e) => setCatalogFooter(e.target.value)}
                      placeholder="Prices incl. VAT"
                    />
                  </div>
                </ZoruCardContent>
              </ZoruCard>

              <ZoruAlert>
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Product Picker — TODO</ZoruAlertTitle>
                <ZoruAlertDescription>
                  The catalog product picker hasn&apos;t been ported to ZoruUI
                  yet. Section product IDs will be empty on submit.
                </ZoruAlertDescription>
              </ZoruAlert>

              <ZoruCard>
                <ZoruCardHeader>
                  <ZoruCardTitle>Section 1</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                  <div className="space-y-2">
                    <ZoruLabel>Section Title</ZoruLabel>
                    <ZoruInput
                      value={catalogSection1Title}
                      onChange={(e) =>
                        setCatalogSection1Title(e.target.value)
                      }
                    />
                  </div>
                </ZoruCardContent>
              </ZoruCard>

              <ZoruCard>
                <ZoruCardHeader>
                  <ZoruCardTitle>Section 2 (Optional)</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                  <div className="space-y-2">
                    <ZoruLabel>Section Title</ZoruLabel>
                    <ZoruInput
                      value={catalogSection2Title}
                      onChange={(e) =>
                        setCatalogSection2Title(e.target.value)
                      }
                    />
                  </div>
                </ZoruCardContent>
              </ZoruCard>
            </div>
          )}
        </div>

        {/* Action column */}
        <div className="lg:col-span-1 space-y-6">
          <ZoruCard className="sticky top-6">
            <ZoruCardHeader>
              <ZoruCardTitle>Publish</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <p className="text-sm text-zoru-ink-muted">
                {templateType === 'STANDARD' &&
                  'Submitting will send this template to Meta for review. Approval usually takes 1 minute.'}
                {templateType === 'MARKETING_CAROUSEL' &&
                  'Carousels are validated by Meta. Ensure all images are high quality.'}
                {templateType === 'CATALOG_MESSAGE' &&
                  'Product messages are saved locally and do NOT require Meta approval.'}
              </p>
              <SubmitButton
                templateType={templateType}
                isAdminForm={isAdminForm}
                isBulkForm={isBulkForm}
              />
            </ZoruCardContent>
          </ZoruCard>
        </div>
      </div>
    </form>
  );
}

/* ── helper ─────────────────────────────────────────────────────── */

function TypeCard({
  value,
  id,
  icon,
  title,
  description,
  active,
}: {
  value: string;
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'relative flex cursor-pointer flex-col items-center gap-2 rounded-[var(--zoru-radius)] border-2 p-4 transition-colors h-full',
        active
          ? 'border-zoru-ink bg-zoru-surface-2'
          : 'border-zoru-line bg-zoru-bg hover:bg-zoru-surface',
      )}
    >
      <ZoruRadioGroupItem value={value} id={id} className="sr-only" />
      <span className="text-zoru-ink mb-1">{icon}</span>
      <div className="text-center space-y-1">
        <div className="text-zoru-ink">{title}</div>
        <div className="text-xs text-zoru-ink-muted">{description}</div>
      </div>
    </label>
  );
}
