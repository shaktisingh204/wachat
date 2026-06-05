'use client';

import {
  Alert,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  Input,
  RadioGroup,
  Radio,
  Select,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
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
import { getCatalogs,
  type Catalog } from '@/app/actions/catalog.actions';
import type {
  CreateTemplateState,
  Project,
  Template,
  } from '@/lib/definitions';

/**
 * CreateTemplateForm (wachat-local, 20ui)
 *
 * The WhatsApp template builder. Three top-level template types:
 *   - STANDARD            (text/media + buttons)            — full parity
 *   - MARKETING_CAROUSEL  (scrollable cards)                — STUBBED
 *   - CATALOG_MESSAGE     (catalog product picker)          — STUBBED
 *
 * The 80% case (STANDARD) is fully reproduced on 20ui primitives.
 * Carousel and Catalog modes show a TODO placeholder pending 20ui-port
 * of CarouselBuilder + ProductPicker (currently wabasimplify-only).
 *
 * Server-action calls preserved 1:1:
 *   handleCreateTemplate (default)
 *   saveLibraryTemplate  (isAdminForm)
 *   handleBulkCreateTemplate (isBulkForm)
 *
 * NOTE: FlowsEncryptionDialog (Meta error 139002 fallback) is also
 * stubbed — error surfaces via toast instead. TODO: 20ui-local port.
 *
 * 20ui note: the 20ui `Select` is a button-based listbox widget (not a
 * native <select name>), so each select value is mirrored into a hidden
 * <input name> below to preserve the exact FormData contract.
 */

import * as React from 'react';

import { SabFileToFileButton, SabFileUrlInput } from '@/components/sabfiles';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

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
    <Button
      variant="primary"
      size="lg"
      type="submit"
      disabled={pending}
      iconLeft={pending ? Loader2 : FileUp}
      block
    >
      {pending ? 'Submitting…' : buttonText}
    </Button>
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
  const { toast } = useToast();

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
  const [pickedHeaderFileName, setPickedHeaderFileName] = useState<
    string | null
  >(null);
  const headerSampleFileRef = React.useRef<HTMLInputElement>(null);
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
      // TODO: 20ui-port CarouselBuilder. Until then we send empty cards.
      formData.set('carouselCards', JSON.stringify([]));
    } else if (templateType === 'CATALOG_MESSAGE') {
      formData.set('catalogId', catalogId);
      formData.set('carouselHeader', catalogHeader);
      formData.set('carouselBody', catalogBody);
      formData.set('carouselFooter', catalogFooter);
      formData.set('section1Title', catalogSection1Title);
      // TODO: 20ui-port ProductPicker — section IDs currently unset.
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
      toast({ title: 'Success!', description: state.message, tone: 'success' });
      if (isAdminForm) router.push('/admin/dashboard/template-library');
      else if (isBulkForm) router.push('/wachat');
      else router.push('/wachat/templates');
    }
    if (state?.error) {
      // TODO: 20ui-port FlowsEncryptionDialog (Meta 139002 fallback).
      toast({
        title: 'Error',
        description: state.error,
        tone: 'danger',
      });
    }
  }, [state, router, toast, isAdminForm, isBulkForm]);

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const languageOptions = languages.map((l) => ({
    value: l.code,
    label: l.name,
  }));
  const catalogOptions = catalogs.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.id})`,
  }));

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
        <span
          id="template-type-label"
          className="mb-2 block"
          style={{
            fontSize: 'var(--st-font-size)',
            fontWeight: 'var(--st-fw-semibold)',
            color: 'var(--st-text)',
          }}
        >
          Choose Template Type
        </span>
        <RadioGroup
          value={templateType}
          aria-label="Choose Template Type"
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
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editor column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Common details */}
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardBody className="grid md:grid-cols-2 gap-4">
              <Field label="Name">
                <Input
                  name="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., summer_promo"
                  required
                />
              </Field>
              {templateType !== 'CATALOG_MESSAGE' && (
                <>
                  {/* 20ui Select is a button widget — mirror its value into a
                      hidden input to preserve the `category` FormData key. */}
                  <input type="hidden" name="category" value={category} />
                  <Field label="Category">
                    <Select
                      value={category || null}
                      onChange={(v) => setCategory((v ?? '') as any)}
                      options={categoryOptions}
                      placeholder="Select category"
                      aria-label="Category"
                    />
                  </Field>
                  <input type="hidden" name="language" value={language} />
                  <Field label="Language">
                    <Select
                      value={language}
                      onChange={(v) => setLanguage(v ?? '')}
                      options={languageOptions}
                      placeholder="Select language"
                      searchable
                      aria-label="Language"
                    />
                  </Field>
                </>
              )}
            </CardBody>
          </Card>

          {/* STANDARD message editor */}
          {templateType === 'STANDARD' && (
            <Card>
              <CardHeader>
                <CardTitle>Message Content</CardTitle>
              </CardHeader>
              <CardBody className="space-y-6">
                {/* Header */}
                <div className="space-y-3">
                  <span
                    id="header-format-label"
                    className="block"
                    style={{
                      fontSize: 'var(--st-font-size)',
                      fontWeight: 'var(--st-fw-medium)',
                      color: 'var(--st-text)',
                    }}
                  >
                    Header
                  </span>
                  <RadioGroup
                    value={headerFormat}
                    onValueChange={setHeaderFormat}
                    orientation="horizontal"
                    aria-label="Header format"
                    className="flex flex-wrap gap-2"
                  >
                    {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(
                      (f) => (
                        <label
                          key={f}
                          htmlFor={`h-${f}`}
                          className="flex items-center space-x-2 p-2 cursor-pointer"
                          style={{
                            borderRadius: 'var(--st-radius)',
                            border: '1px solid',
                            borderColor:
                              headerFormat === f
                                ? 'var(--st-text)'
                                : 'var(--st-border)',
                            background:
                              headerFormat === f
                                ? 'var(--st-bg-secondary)'
                                : 'transparent',
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                        >
                          <Radio value={f} id={`h-${f}`} />
                          <span
                            style={{
                              fontSize: '13px',
                              color: 'var(--st-text)',
                            }}
                          >
                            {f}
                          </span>
                        </label>
                      ),
                    )}
                  </RadioGroup>
                  <input
                    type="hidden"
                    name="headerFormat"
                    value={headerFormat}
                  />

                  {headerFormat === 'TEXT' && (
                    <div className="space-y-2">
                      <Input
                        name="headerText"
                        placeholder="Header Text (e.g. Welcome {{1}})"
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                      />
                      {headerText.match(/{{\s*(\d+)\s*}}/g) && (
                        <div
                          className="mt-2 p-2"
                          style={{
                            borderRadius: 'var(--st-radius)',
                            background: 'var(--st-bg-secondary)',
                            fontSize: 'var(--st-font-size-sm)',
                          }}
                        >
                          <Field label="Header Variable Example">
                            <Input
                              name="headerExample"
                              placeholder="e.g. Discount"
                              required
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  )}
                  {(headerFormat === 'IMAGE' ||
                    headerFormat === 'VIDEO' ||
                    headerFormat === 'DOCUMENT') && (
                    <div className="space-y-2">
                      <Input
                        ref={headerSampleFileRef}
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
                      <div className="flex items-center justify-between gap-2">
                        <div
                          style={{
                            fontSize: 'var(--st-font-size-xs)',
                            color: 'var(--st-text-muted)',
                          }}
                        >
                          {pickedHeaderFileName
                            ? `Picked from SabFiles: ${pickedHeaderFileName}`
                            : 'Pick from SabFiles instead of uploading'}
                        </div>
                        <SabFileToFileButton
                          accept={
                            headerFormat === 'IMAGE'
                              ? 'image'
                              : headerFormat === 'VIDEO'
                                ? 'video'
                                : 'document'
                          }
                          onPickFile={(file) => {
                            const input = headerSampleFileRef.current;
                            if (input) {
                              const dt = new DataTransfer();
                              dt.items.add(file);
                              input.files = dt.files;
                            }
                            setPickedHeaderFileName(file.name);
                          }}
                          onError={(err) =>
                            toast({
                              title: 'Pick failed',
                              description: err.message,
                              tone: 'danger',
                            })
                          }
                        >
                          Pick from SabFiles
                        </SabFileToFileButton>
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--st-font-size-xs)',
                          color: 'var(--st-text-muted)',
                        }}
                      >
                        OR
                      </div>
                      <SabFileUrlInput
                        name="headerSampleUrl"
                        placeholder="https://..."
                        value={headerSampleUrl}
                        onChange={(v) => setHeaderSampleUrl(v)}
                        accept={
                          headerFormat === 'IMAGE'
                            ? 'image'
                            : headerFormat === 'VIDEO'
                              ? 'video'
                              : headerFormat === 'DOCUMENT'
                                ? 'document'
                                : 'all'
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Body */}
                <Field label="Body">
                  <Textarea
                    name="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Hello {{1}}..."
                    className="min-h-[120px]"
                    required
                  />
                </Field>
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
                        <div
                          className="space-y-2 p-3 mt-2"
                          style={{
                            borderRadius: 'var(--st-radius)',
                            border: '1px solid var(--st-border)',
                            background: 'var(--st-bg-secondary)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 'var(--st-font-size-xs)',
                              fontWeight: 'var(--st-fw-medium)',
                              color: 'var(--st-text)',
                            }}
                          >
                            Variable Examples (Required)
                          </span>
                          <div className="grid gap-2">
                            {vars.map((v) => (
                              <div
                                key={v}
                                className="flex items-center gap-2"
                              >
                                <span
                                  className="w-8"
                                  style={{
                                    fontSize: 'var(--st-font-size-xs)',
                                    color: 'var(--st-text-muted)',
                                    fontFamily: 'var(--st-font-mono)',
                                  }}
                                >
                                  {`{{${v}}}`}
                                </span>
                                <Input
                                  name={`body_example_${v}`}
                                  placeholder="e.g. John"
                                  inputSize="sm"
                                  aria-label={`Example for variable {{${v}}}`}
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

                {/* Footer */}
                <Field label="Footer (Optional)">
                  <Input
                    name="footer"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                  />
                </Field>
              </CardBody>

              {/* Buttons editor */}
              <CardBody className="space-y-3 pt-0">
                <div className="flex items-center justify-between">
                  <span
                    style={{
                      fontSize: 'var(--st-font-size)',
                      fontWeight: 'var(--st-fw-medium)',
                      color: 'var(--st-text)',
                    }}
                  >
                    Buttons ({buttons.length})
                  </span>
                </div>

                {buttons.map((b, i) => (
                  <div
                    key={i}
                    className="relative space-y-2 p-3"
                    style={{
                      borderRadius: 'var(--st-radius)',
                      border: '1px solid var(--st-border)',
                      background: 'var(--st-bg-secondary)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--st-font-size-xs)',
                        color: 'var(--st-text-muted)',
                      }}
                    >
                      {b.type}
                    </div>
                    <Input
                      placeholder="Label"
                      aria-label={`${b.type} button label`}
                      value={b.text}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[i] = { ...b, text: e.target.value };
                        setButtons(newBtns);
                      }}
                    />
                    <IconButton
                      label="Remove button"
                      icon={Trash2}
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() =>
                        setButtons((btns) =>
                          btns.filter((_, idx) => idx !== i),
                        )
                      }
                    />

                    {b.type === 'URL' && (
                      <Input
                        placeholder="https://website.com"
                        aria-label="Button URL"
                        value={b.url || ''}
                        onChange={(e) => {
                          const newBtns = [...buttons];
                          newBtns[i] = { ...b, url: e.target.value };
                          setButtons(newBtns);
                        }}
                      />
                    )}

                    {b.type === 'PHONE_NUMBER' && (
                      <Input
                        placeholder="+1234567890"
                        aria-label="Button phone number"
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
                    <Button
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
                    </Button>
                    <Button
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
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* MARKETING_CAROUSEL — stubbed */}
          {templateType === 'MARKETING_CAROUSEL' && (
            <Alert
              tone="warning"
              icon={AlertCircle}
              title="Marketing Carousel — TODO"
            >
              The carousel builder UI hasn&apos;t been ported to 20ui yet.
              Submitting will create an empty-card carousel — please use
              the legacy Wachat builder for now if you need card content.
            </Alert>
          )}

          {/* CATALOG_MESSAGE — partial */}
          {templateType === 'CATALOG_MESSAGE' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Catalog Configuration</CardTitle>
                  <CardDescription>
                    Select a catalog and define your sections.
                  </CardDescription>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Field label="Select Catalog">
                    <Select
                      value={catalogId || null}
                      onChange={(v) => setCatalogId(v ?? '')}
                      options={catalogOptions}
                      placeholder="Choose a catalog..."
                      searchable
                      aria-label="Select Catalog"
                    />
                  </Field>

                  <Field label="Header Text (Optional)">
                    <Input
                      value={catalogHeader}
                      onChange={(e) => setCatalogHeader(e.target.value)}
                      placeholder="Our Collection"
                    />
                  </Field>
                  <Field label="Body Text">
                    <Textarea
                      value={catalogBody}
                      onChange={(e) => setCatalogBody(e.target.value)}
                      placeholder="Check out these items..."
                      required
                    />
                  </Field>
                  <Field label="Footer Text (Optional)">
                    <Input
                      value={catalogFooter}
                      onChange={(e) => setCatalogFooter(e.target.value)}
                      placeholder="Prices incl. VAT"
                    />
                  </Field>
                </CardBody>
              </Card>

              <Alert
                tone="warning"
                icon={AlertCircle}
                title="Product Picker — TODO"
              >
                The catalog product picker hasn&apos;t been ported to 20ui
                yet. Section product IDs will be empty on submit.
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>Section 1</CardTitle>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Field label="Section Title">
                    <Input
                      value={catalogSection1Title}
                      onChange={(e) =>
                        setCatalogSection1Title(e.target.value)
                      }
                    />
                  </Field>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Section 2 (Optional)</CardTitle>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Field label="Section Title">
                    <Input
                      value={catalogSection2Title}
                      onChange={(e) =>
                        setCatalogSection2Title(e.target.value)
                      }
                    />
                  </Field>
                </CardBody>
              </Card>
            </div>
          )}
        </div>

        {/* Action column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Publish</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <p
                style={{
                  fontSize: 'var(--st-font-size-sm)',
                  color: 'var(--st-text-muted)',
                }}
              >
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
            </CardBody>
          </Card>
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
      className="relative flex cursor-pointer flex-col items-center gap-2 p-4 h-full"
      style={{
        borderRadius: 'var(--st-radius)',
        border: '2px solid',
        borderColor: active ? 'var(--st-text)' : 'var(--st-border)',
        background: active ? 'var(--st-bg-secondary)' : 'var(--st-bg)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <Radio value={value} id={id} className="sr-only" />
      <span style={{ color: 'var(--st-text)', marginBottom: 4 }}>{icon}</span>
      <div className="text-center space-y-1">
        <div style={{ color: 'var(--st-text)' }}>{title}</div>
        <div
          style={{
            fontSize: 'var(--st-font-size-xs)',
            color: 'var(--st-text-muted)',
          }}
        >
          {description}
        </div>
      </div>
    </label>
  );
}
