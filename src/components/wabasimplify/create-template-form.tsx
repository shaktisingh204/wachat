'use client';

import { useEffect, useState, useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LoaderCircle, FileUp, Plus, Trash2, Copy, Save, ShoppingBag, LayoutGrid, MessageSquare } from 'lucide-react';
import { handleCreateTemplate, saveLibraryTemplate, handleBulkCreateTemplate } from '@/app/actions/template.actions';
import { getTemplateCategories } from '@/app/actions/plan.actions';
import { getCatalogs, type Catalog } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project, Template, CreateTemplateState } from '@/lib/definitions';
import { Separator } from '../ui/separator';
import { createTemplateSchema } from '@/lib/template-schema';

// New Components
import { CarouselBuilder, type CarouselCardData } from './templates/CarouselBuilder';
import { ProductPicker } from './templates/ProductPicker';

import { FlowsEncryptionDialog } from '@/components/dashboard/numbers/flows-encryption-dialog';

const MAX_FILE_SIZE_IMAGE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE_VIDEO = 16 * 1024 * 1024; // 16MB
const MAX_FILE_SIZE_DOC = 16 * 1024 * 1024; // 16MB

const createTemplateInitialState: CreateTemplateState = {
  message: null,
  error: null,
  payload: null,
  debugInfo: null,
};

function SubmitButton({ templateType, isAdminForm, isBulkForm }: { templateType: string, isAdminForm?: boolean, isBulkForm?: boolean }) {
  const { pending } = useFormStatus();
  let buttonText = 'Submit for Approval';
  if (isAdminForm) buttonText = 'Save to Library';
  else if (isBulkForm) buttonText = 'Save to All Selected Projects';
  else if (templateType === 'CATALOG_MESSAGE') buttonText = 'Save Product Carousel';
  else if (templateType === 'MARKETING_CAROUSEL') buttonText = 'Submit Carousel for Approval';

  return (
    <Button size="lg" type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Submitting...
        </>
      ) : (
        <>
          <FileUp className="mr-2 h-4 w-4" />
          {buttonText}
        </>
      )}
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
  { name: 'Zulu', code: 'zu' }
];

interface CreateTemplateFormProps {
  project?: WithId<Project>;
  bulkProjectIds?: string[];
  initialTemplate?: WithId<Template> | null;
  isCloning?: boolean;
  isAdminForm?: boolean;
  isBulkForm?: boolean;
}

export function CreateTemplateForm({ project, bulkProjectIds = [], initialTemplate, isCloning, isAdminForm = false, isBulkForm = false }: CreateTemplateFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  let serverAction: any = handleCreateTemplate;
  if (isAdminForm) serverAction = saveLibraryTemplate;
  if (isBulkForm) serverAction = handleBulkCreateTemplate;

  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(createTemplateInitialState);
  const [showFlowsDialog, setShowFlowsDialog] = useState(false);

  const [templateType, setTemplateType] = useState<'STANDARD' | 'CATALOG_MESSAGE' | 'MARKETING_CAROUSEL'>('STANDARD');

  // Standard Fields
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<Template['category'] | ''>('');
  const [language, setLanguage] = useState('en_US');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [headerFormat, setHeaderFormat] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerSampleUrl, setHeaderSampleUrl] = useState('');
  const [buttons, setButtons] = useState<ButtonType[]>([]);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);

  // Carousel State
  const [carouselCards, setCarouselCards] = useState<CarouselCardData[]>([
    { id: '1', headerFormat: 'IMAGE', headerSampleUrl: '', body: '', buttons: [] }
  ]);

  // Catalog State
  const [catalogId, setCatalogId] = useState('');
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [catalogSection1Title, setCatalogSection1Title] = useState('Featured Items');
  const [catalogSection1Ids, setCatalogSection1Ids] = useState<string[]>([]);
  const [catalogSection2Title, setCatalogSection2Title] = useState('More Products');
  const [catalogSection2Ids, setCatalogSection2Ids] = useState<string[]>([]);

  const [catalogHeader, setCatalogHeader] = useState('');
  const [catalogBody, setCatalogBody] = useState('Check out our catalog!');
  const [catalogFooter, setCatalogFooter] = useState('');

  // Initial Load Effects
  useEffect(() => {
    if (isAdminForm) {
      getTemplateCategories().then(data => setCategories(data.map(c => ({ id: c.name, name: c.name }))));
    } else {
      setCategories([
        { id: 'MARKETING', name: 'Marketing' },
        { id: 'UTILITY', name: 'Utility' },
        { id: 'AUTHENTICATION', name: 'Authentication' },
      ]);
    }

    if (project && !isAdminForm && !isBulkForm) {
      // Load catalogs for product picker
      getCatalogs(project._id.toString()).then(res => {
        if (res.catalogs) setCatalogs(res.catalogs);
      });
    }
  }, [isAdminForm, project]);

  // Restore State from Initial Template
  useEffect(() => {
    if (initialTemplate) {
      setTemplateName(isCloning ? `${initialTemplate.name}_copy` : initialTemplate.name);
      setLanguage(initialTemplate.language);
      setCategory(initialTemplate.category || '');

      if (initialTemplate.type === 'MARKETING_CAROUSEL') {
        setTemplateType('MARKETING_CAROUSEL');
        // TODO: Parse components back to cards if possible. 
        // This is complex as Meta returns components in a specific way.
        // For now, we start fresh or support basic clone if implemented.
      } else if (initialTemplate.type === 'CATALOG_MESSAGE') {
        setTemplateType('CATALOG_MESSAGE');
        const catalogAction = initialTemplate.components.find(c => c.type === 'CATALOG_MESSAGE_ACTION' || c.type === 'mpm'); // legacy check
        // TODO: Restore catalog state
      } else {
        setTemplateType('STANDARD');
        const bodyComp = initialTemplate.components?.find(c => c.type === 'BODY');
        setBody(bodyComp?.text || '');
        // ... other standard restore logic (same as before) ...
      }
    }
  }, [initialTemplate, isCloning]);


  const formAction = (formData: FormData) => {
    // 1. Prepare JSON Data for Complex Types
    if (templateType === 'MARKETING_CAROUSEL') {
      const cleanCards = carouselCards.map(c => ({
        ...c,
        // Header File is handled via FormData, but we need to map indices
        buttons: c.buttons.map(b => ({ ...b, text: b.text.trim() }))
      }));
      formData.set('carouselCards', JSON.stringify(cleanCards));

      // Append Files Manually with proper naming convention expected by server action
      carouselCards.forEach((card, index) => {
        if (card.headerFile) {
          formData.set(`card_${index}_headerSampleFile`, card.headerFile);
        }
      });

    } else if (templateType === 'CATALOG_MESSAGE') {
      formData.set('catalogId', catalogId);
      formData.set('carouselHeader', catalogHeader);
      formData.set('carouselBody', catalogBody);
      formData.set('carouselFooter', catalogFooter);

      formData.set('section1Title', catalogSection1Title);
      formData.set('section1ProductIDs', catalogSection1Ids.join('\n'));

      // Only set Section 2 if it has content
      if (catalogSection2Title && catalogSection2Ids.length > 0) {
        formData.set('section2Title', catalogSection2Title);
        formData.set('section2ProductIDs', catalogSection2Ids.join('\n'));
      }
    } else {
      // Standard Template
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
      // Check for WhatsApp Flows Encryption Error (139002)
      if (state.error.includes('139002') || (state.error.includes('flows') && state.error.includes('public key'))) {
        // Do not show error toast immediately, instead show the configuration dialog
        setShowFlowsDialog(true);
      } else {
        toast({ title: 'Error', description: state.error, variant: 'destructive' });
      }
    }
  }, [state, router, toast]);

  const activePhoneNumber = project?.phoneNumbers?.find(p => p.id === project.phoneNumbers?.[0]?.id); // Assuming first number or logic to pick active

  return (
    <form action={formAction}>
      {project && activePhoneNumber && (
        <FlowsEncryptionDialog
          project={project}
          phone={activePhoneNumber}
          open={showFlowsDialog}
          onOpenChange={setShowFlowsDialog}
          trigger={<></>} // Hidden trigger
        />
      )}
      {project && <input type="hidden" name="projectId" value={project._id.toString()} />}
      {isBulkForm && <input type="hidden" name="projectIds" value={bulkProjectIds.join(',')} />}
      <input type="hidden" name="templateType" value={templateType} />

      {/* Header / Type Selector */}
      <div className="mb-8">
        <Label className="text-base mb-2 block">Choose Template Type</Label>
        <RadioGroup
          value={templateType}
          onValueChange={(v) => {
            const newType = v as any;
            setTemplateType(newType);
            // Reset content state on type switch to prevent cross-contamination
            setTemplateName('');
            setBody('');
            setFooter('');
            setHeaderFormat('NONE');
            setHeaderText('');
            setHeaderSampleUrl('');
            setButtons([]);
            setCarouselCards([{ id: '1', headerFormat: 'IMAGE', headerSampleUrl: '', body: '', buttons: [] }]);
            // Catalog state
            setCatalogId('');
            setCatalogHeader('');
            setCatalogBody('Check out our catalog!');
            setCatalogFooter('');
            setCatalogSection1Title('Featured Items');
            setCatalogSection1Ids([]);
            setCatalogSection2Title('More Products');
            setCatalogSection2Ids([]);
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="relative">
            <RadioGroupItem value="STANDARD" id="t-standard" className="peer sr-only" />
            <Label htmlFor="t-standard" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer h-full">
              <MessageSquare className="mb-3 h-6 w-6" />
              <div className="text-center space-y-1">
                <div className="font-semibold">Standard Message</div>
                <div className="text-xs text-muted-foreground">Text, Media, Buttons</div>
              </div>
            </Label>
          </div>
          <div className="relative">
            <RadioGroupItem value="MARKETING_CAROUSEL" id="t-carousel" className="peer sr-only" />
            <Label htmlFor="t-carousel" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer h-full">
              <LayoutGrid className="mb-3 h-6 w-6" />
              <div className="text-center space-y-1">
                <div className="font-semibold">Marketing Carousel</div>
                <div className="text-xs text-muted-foreground">Scrollable cards with media</div>
              </div>
            </Label>
          </div>
          <div className="relative">
            <RadioGroupItem value="CATALOG_MESSAGE" id="t-catalog" className="peer sr-only" />
            <Label htmlFor="t-catalog" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer h-full">
              <ShoppingBag className="mb-3 h-6 w-6" />
              <div className="text-center space-y-1">
                <div className="font-semibold">Product Catalog</div>
                <div className="text-xs text-muted-foreground">Interactive product list</div>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main Editor Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Common Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g., summer_promo" required />
              </div>
              {templateType !== 'CATALOG_MESSAGE' && (
                <>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select name="category" value={category} onValueChange={(v) => setCategory(v as any)} required>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select name="language" value={language} onValueChange={setLanguage} required>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{languages.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* --- EDITOR CONTENT BY TYPE --- */}

          {(templateType === 'STANDARD' || templateType === 'MARKETING_CAROUSEL') && (
            <Card>
              <CardHeader><CardTitle>{templateType === 'MARKETING_CAROUSEL' ? 'Carousel Introduction' : 'Message Content'}</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {/* Header - Only for Standard */}
                {templateType === 'STANDARD' && (
                  <div className="space-y-3">
                    <Label>Header</Label>
                    <RadioGroup value={headerFormat} onValueChange={setHeaderFormat} className="flex flex-wrap gap-2">
                      {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(f => (
                        <div key={f} className="flex items-center space-x-2 border p-2 rounded cursor-pointer hover:bg-accent">
                          <RadioGroupItem value={f} id={`h-${f}`} />
                          <Label htmlFor={`h-${f}`} className="cursor-pointer">{f}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                    <input type="hidden" name="headerFormat" value={headerFormat} />

                    {headerFormat === 'TEXT' && (
                      <div className="space-y-2">
                        <Input name="headerText" placeholder="Header Text (e.g. Welcome {{1}})" value={headerText} onChange={e => setHeaderText(e.target.value)} />
                        {headerText.match(/{{\s*(\d+)\s*}}/g) && (
                          <div className="mt-2 text-sm bg-muted/30 p-2 rounded">
                            <Label className="text-xs font-semibold mb-1 block">Header Variable Example</Label>
                            <Input name="headerExample" placeholder="e.g. Discount" className="h-8" required />
                          </div>
                        )}
                      </div>
                    )}
                    {(headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
                      <div className="space-y-2">
                        <Input
                          type="file"
                          name="headerSampleFile"
                          accept={
                            headerFormat === 'IMAGE' ? "image/jpeg,image/png" :
                              headerFormat === 'VIDEO' ? "video/mp4" :
                                headerFormat === 'DOCUMENT' ? "application/pdf" : undefined
                          }
                        />
                        <div className="text-xs text-muted-foreground">OR</div>
                        <Input name="headerSampleUrl" placeholder="https://..." value={headerSampleUrl} onChange={e => setHeaderSampleUrl(e.target.value)} />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{templateType === 'MARKETING_CAROUSEL' ? 'Carousel Intro Body' : 'Body'}</Label>
                  <Textarea name="body" value={body} onChange={e => setBody(e.target.value)} placeholder={templateType === 'MARKETING_CAROUSEL' ? "Check out our latest collection..." : "Hello {{1}}..."} className="min-h-[120px]" required />

                  {/* Variable Examples for Body */}
                  {(() => {
                    const matches = body.match(/{{\s*(\d+)\s*}}/g);
                    if (matches && matches.length > 0) {
                      const vars = [...new Set(matches.map(m => {
                        const matchResult = m.match(/\d+/);
                        return matchResult ? parseInt(matchResult[0]) : 0;
                      }))].sort((a, b) => a - b).filter(n => n > 0);

                      if (vars.length > 0) {
                        return (
                          <div className="space-y-2 p-3 bg-muted/30 rounded border mt-2">
                            <Label className="text-xs font-semibold">Variable Examples (Required)</Label>
                            <div className="grid gap-2">
                              {vars.map(v => (
                                <div key={v} className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-8 font-mono">{`{{${v}}}`}</span>
                                  <Input
                                    name={`body_example_${v}`}
                                    placeholder={`e.g. John`}
                                    className="h-8 text-sm"
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
                  <Label>Footer (Optional)</Label>
                  <Input name="footer" value={footer} onChange={e => setFooter(e.target.value)} />
                </div>
              </CardContent>

              {/* Buttons Editor for Standard - Moved inside main card to avoid overlap issues */}
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Buttons ({buttons.length})</Label>
                </div>

                {buttons.map((b, i) => (
                  <div key={i} className="p-3 border rounded relative bg-muted/20">
                    <div className="font-semibold text-xs mb-1">{b.type}</div>
                    <Input
                      placeholder="Label"
                      value={b.text}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[i] = { ...b, text: e.target.value };
                        setButtons(newBtns);
                      }}
                      className="mb-2"
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={() => setButtons(btns => btns.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>

                    {b.type === 'URL' && (
                      <Input
                        placeholder="https://website.com"
                        value={b.url || ''}
                        onChange={(e) => {
                          const newBtns = [...buttons];
                          newBtns[i] = { ...b, url: e.target.value };
                          setButtons(newBtns);
                        }}
                        className="mb-2"
                      />
                    )}

                    {b.type === 'PHONE_NUMBER' && (
                      <Input
                        placeholder="+1234567890"
                        value={b.phone_number || ''}
                        onChange={(e) => {
                          const newBtns = [...buttons];
                          newBtns[i] = { ...b, phone_number: e.target.value };
                          setButtons(newBtns);
                        }}
                        className="mb-2"
                      />
                    )}
                  </div>
                ))}
                {buttons.length < 3 && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }])}>Quick Reply</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setButtons([...buttons, { type: 'URL', text: '', url: '' }])}>URL</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {templateType === 'MARKETING_CAROUSEL' && (
            <CarouselBuilder cards={carouselCards} onChange={setCarouselCards} />
          )}

          {templateType === 'CATALOG_MESSAGE' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Catalog Configuration</CardTitle>
                  <CardDescription>Select a catalog and define your sections.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Catalog</Label>
                    <Select value={catalogId} onValueChange={setCatalogId} required>
                      <SelectTrigger><SelectValue placeholder="Choose a catalog..." /></SelectTrigger>
                      <SelectContent>
                        {catalogs.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.id})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Header Text (Optional)</Label>
                    <Input value={catalogHeader} onChange={e => setCatalogHeader(e.target.value)} placeholder="Our Collection" />
                  </div>
                  <div className="space-y-2">
                    <Label>Body Text</Label>
                    <Textarea value={catalogBody} onChange={e => setCatalogBody(e.target.value)} placeholder="Check out these items..." required />
                  </div>
                  <div className="space-y-2">
                    <Label>Footer Text (Optional)</Label>
                    <Input value={catalogFooter} onChange={e => setCatalogFooter(e.target.value)} placeholder="Prices incl. VAT" />
                  </div>
                </CardContent>
              </Card>

              {/* Section 1 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Section 1</CardTitle>
                  <ProductPicker
                    projectId={project?._id.toString() || ''}
                    catalogId={catalogId}
                    selectedIds={catalogSection1Ids}
                    onSelectionChange={setCatalogSection1Ids}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Section Title</Label>
                    <Input value={catalogSection1Title} onChange={e => setCatalogSection1Title(e.target.value)} />
                  </div>
                  <div className="p-4 border rounded-md bg-muted/20 text-sm">
                    {catalogSection1Ids.length === 0 ? (
                      <span className="text-muted-foreground">No products selected. Click "Select Products" above.</span>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {catalogSection1Ids.map(id => (
                          <div key={id} className="bg-background border p-2 rounded flex justify-between items-center">
                            <span className="truncate flex-1" title={id}>{id}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-4 w-4 ml-2" onClick={() => setCatalogSection1Ids(ids => ids.filter(x => x !== id))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Section 2 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Section 2 (Optional)</CardTitle>
                  <ProductPicker
                    projectId={project?._id.toString() || ''}
                    catalogId={catalogId}
                    selectedIds={catalogSection2Ids}
                    onSelectionChange={setCatalogSection2Ids}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Section Title</Label>
                    <Input value={catalogSection2Title} onChange={e => setCatalogSection2Title(e.target.value)} />
                  </div>
                  {catalogSection2Ids.length > 0 && (
                    <div className="p-4 border rounded-md bg-muted/20 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        {catalogSection2Ids.map(id => (
                          <div key={id} className="bg-background border p-2 rounded flex justify-between items-center">
                            <span className="truncate flex-1" title={id}>{id}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-4 w-4 ml-2" onClick={() => setCatalogSection2Ids(ids => ids.filter(x => x !== id))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Action Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {templateType === 'STANDARD' && "Submitting will send this template to Meta for review. Approval usually takes 1 minute."}
                {templateType === 'MARKETING_CAROUSEL' && "Carousels are validated by Meta. Ensure all images are high quality."}
                {templateType === 'CATALOG_MESSAGE' && "Product messages are saved locally and do NOT require Meta approval."}
              </p>
              <SubmitButton templateType={templateType} isAdminForm={isAdminForm} isBulkForm={isBulkForm} />
            </CardContent>
          </Card>

        </div>
      </div>
    </form >
  );
}
