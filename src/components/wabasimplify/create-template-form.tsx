'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LoaderCircle, FileUp, Plus, Trash2, Copy } from 'lucide-react';
import { handleCreateTemplate } from '@/app/actions/template.actions';
import { saveLibraryTemplate } from '@/app/actions/plan.actions';
import { getTemplateCategories } from '@/app/actions/plan.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project, Template } from '@/lib/definitions';
import { Separator } from '../ui/separator';
import { AiSuggestions } from './ai-suggestions';

const createTemplateInitialState = {
  message: null,
  error: null,
  payload: null,
  debugInfo: null,
};

function SubmitButton({ templateType, isAdminForm }: { templateType: 'STANDARD' | 'CATALOG_MESSAGE' | 'MARKETING_CAROUSEL', isAdminForm?: boolean }) {
    const { pending } = useFormStatus();
    let buttonText = 'Submit for Approval';
    if (isAdminForm) buttonText = 'Save to Library';
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

type CarouselCardData = {
    id: number;
    headerFormat: 'IMAGE' | 'VIDEO' | 'NONE';
    headerSampleUrl: string;
    body: string;
    buttons: ButtonType[];
}

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
    { name: 'Georgian', code: 'ka' },
    { name: 'German', code: 'de' },
    { name: 'Greek', code: 'el' },
    { name: 'Gujarati', code: 'gu' },
    { name: 'Hausa', code: 'ha' },
    { name: 'Hebrew', code: 'he' },
    { name: 'Hindi', code: 'hi' },
    { name: 'Hungarian', code: 'hu' },
    { name: 'Indonesian', code: 'id' },
    { name: 'Irish', code: 'ga' },
    { name: 'Italian', code: 'it' },
    { name: 'Japanese', code: 'ja' },
    { name: 'Kannada', code: 'kn' },
    { name: 'Kazakh', code: 'kk' },
    { name: 'Kinyarwanda', code: 'rw_RW' },
    { name: 'Korean', code: 'ko' },
    { name: 'Kyrgyz (Kyrgyzstan)', code: 'ky_KG' },
    { name: 'Lao', code: 'lo' },
    { name: 'Latvian', code: 'lv' },
    { name: 'Lithuanian', code: 'lt' },
    { name: 'Macedonian', code: 'mk' },
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
    initialTemplate?: WithId<Template> | null;
    isCloning?: boolean;
    isAdminForm?: boolean;
}

export function CreateTemplateForm({ project, initialTemplate, isCloning, isAdminForm = false }: CreateTemplateFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const serverAction = isAdminForm ? saveLibraryTemplate : handleCreateTemplate;
  const [state, formAction] = useActionState(serverAction, createTemplateInitialState);
  
  const [templateType, setTemplateType] = useState<'STANDARD' | 'CATALOG_MESSAGE' | 'MARKETING_CAROUSEL'>('STANDARD');

  const cleanText = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  };

  // State for standard templates
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<Template['category'] | ''>('');
  const [language, setLanguage] = useState('en_US');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [headerFormat, setHeaderFormat] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerSampleUrl, setHeaderSampleUrl] = useState('');
  const [buttons, setButtons] = useState<ButtonType[]>([]);

  // State for categories dropdown
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);

  // State for marketing carousel
  const [carouselCards, setCarouselCards] = useState<CarouselCardData[]>([{ id: Date.now(), headerFormat: 'NONE', headerSampleUrl: '', body: '', buttons: [] }]);

  const [lastPayload, setLastPayload] = useState('');
  const [lastDebugInfo, setLastDebugInfo] = useState('');

  useEffect(() => {
    if (isAdminForm) {
      getTemplateCategories().then(data => {
        setCategories(data.map(c => ({ id: c.name, name: c.name })));
      });
    } else {
      setCategories([
        { id: 'MARKETING', name: 'Marketing' },
        { id: 'UTILITY', name: 'Utility' },
        { id: 'AUTHENTICATION', name: 'Authentication' },
      ]);
    }
  }, [isAdminForm]);
  
  useEffect(() => {
    if (initialTemplate) {
      if (initialTemplate.type === 'CATALOG_MESSAGE') {
          setTemplateType('CATALOG_MESSAGE');
      } else {
          setTemplateType('STANDARD');
      }

      if (isCloning) {
        setTemplateName(`${initialTemplate.name || ''}_clone_${Math.floor(Math.random() * 1000)}`);
      } else {
        setTemplateName(initialTemplate.name || '');
      }

      setCategory(initialTemplate.category || '');
      setLanguage(initialTemplate.language || 'en_US');
      
      const bodyComp = initialTemplate.components?.find(c => c.type === 'BODY');
      setBody(cleanText(bodyComp?.text || initialTemplate.body || ''));
      
      const footerComp = initialTemplate.components?.find(c => c.type === 'FOOTER');
      setFooter(cleanText(footerComp?.text || ''));
      
      const buttonsComp = initialTemplate.components?.find(c => c.type === 'BUTTONS');
      if (buttonsComp?.buttons) {
        setButtons(buttonsComp.buttons.map((btn: any) => ({
            ...btn,
            text: cleanText(btn.text),
        })));
      } else {
        setButtons([]);
      }

      const headerComp = initialTemplate.components?.find(c => c.type === 'HEADER');
      if (headerComp) {
        const format = headerComp.format || 'NONE';
        setHeaderFormat(format);

        if (format === 'TEXT') {
          setHeaderText(cleanText(headerComp.text));
          setHeaderSampleUrl('');
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
          setHeaderSampleUrl(initialTemplate.headerSampleUrl || '');
          setHeaderText('');
        } else {
          setHeaderText('');
          setHeaderSampleUrl('');
        }
      } else {
        setHeaderFormat('NONE');
        setHeaderText('');
        setHeaderSampleUrl('');
      }
    }
  }, [initialTemplate, isCloning]);


  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      if (isAdminForm) {
        router.push('/admin/dashboard/template-library');
      } else {
        router.push('/dashboard/templates');
      }
    }
    if (state?.error) {
      toast({ title: 'Submission Error', description: state.error, variant: 'destructive' });
    }
    if (state?.payload) {
        setLastPayload(state.payload);
    }
    if (state?.debugInfo) {
        setLastDebugInfo(state.debugInfo);
    }
  }, [state, router, toast, isAdminForm]);

  const handleAddButton = (type: ButtonType['type']) => {
    const hasQuickReply = buttons.some(b => b.type === 'QUICK_REPLY');
    const hasCta = buttons.some(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
    
    if (type === 'QUICK_REPLY' && (hasCta || buttons.length >= 10)) return;
    if ((type === 'URL' || type === 'PHONE_NUMBER') && (hasQuickReply || buttons.length >= 2)) return;
    if (type === 'URL' && buttons.some(b => b.type === 'URL')) return;
    if (type === 'PHONE_NUMBER' && buttons.some(b => b.type === 'PHONE_NUMBER')) return;

    setButtons([...buttons, { type, text: '' }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, field: 'text' | 'url' | 'phone_number' | 'payload', value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  };

  const handleButtonExampleChange = (index: number, value: string) => {
    const newButtons = [...buttons];
    newButtons[index].example = [value];
    setButtons(newButtons);
  };

  // Carousel Card Handlers
  const handleAddCarouselCard = () => {
    if (carouselCards.length < 10) {
      setCarouselCards([...carouselCards, { id: Date.now(), headerFormat: 'NONE', headerSampleUrl: '', body: '', buttons: [] }]);
    } else {
      toast({ title: "Limit Reached", description: "You can add a maximum of 10 cards to a carousel.", variant: "destructive" });
    }
  };

  const handleRemoveCarouselCard = (index: number) => {
    setCarouselCards(carouselCards.filter((_, i) => i !== index));
  };

  const handleCarouselCardChange = (index: number, field: keyof CarouselCardData, value: any) => {
    const newCards = [...carouselCards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCarouselCards(newCards);
  };
   
  const handleCarouselCardButtonChange = (cardIndex: number, buttonIndex: number, field: keyof ButtonType, value: string) => {
    const newCards = [...carouselCards];
    const newButtons = [...newCards[cardIndex].buttons];
    newButtons[buttonIndex] = { ...newButtons[buttonIndex], [field]: value };
    handleCarouselCardChange(cardIndex, 'buttons', newButtons);
  };
  
  const handleAddCarouselCardButton = (cardIndex: number, type: ButtonType['type']) => {
    const cardButtons = carouselCards[cardIndex].buttons;
    if (cardButtons.length >= 2) return;
    const newButtons = [...cardButtons, { type: type, text: '' }];
    handleCarouselCardChange(cardIndex, 'buttons', newButtons);
  };

  const handleRemoveCarouselCardButton = (cardIndex: number, buttonIndex: number) => {
    const cardButtons = carouselCards[cardIndex].buttons;
    const newButtons = cardButtons.filter((_, i) => i !== buttonIndex);
    handleCarouselCardChange(cardIndex, 'buttons', newButtons);
  };


  const handleCopyPayload = () => {
    navigator.clipboard.writeText(lastPayload);
    toast({
        title: 'Payload Copied!',
        description: 'The API payload has been copied to your clipboard.',
    });
  };

  const getTemplateComponents = () => {
      const components = [];
      if (headerFormat !== 'NONE') {
        const headerComponent: any = { type: 'HEADER', format: headerFormat };
        if (headerFormat === 'TEXT') {
            headerComponent.text = headerText;
        }
        components.push(headerComponent);
      }
      components.push({ type: 'BODY', text: body });
      if (footer) components.push({ type: 'FOOTER', text: footer });
      if (buttons.length > 0) {
        components.push({ type: 'BUTTONS', buttons: buttons });
      }
      return JSON.stringify(components);
  }


  return (
    <form action={formAction}>
      {project && <input type="hidden" name="projectId" value={project._id.toString()} />}
      <input type="hidden" name="buttons" value={JSON.stringify(buttons)} />
      <input type="hidden" name="carouselCards" value={JSON.stringify(carouselCards)} />
      <input type="hidden" name="templateType" value={templateType} />
      {isAdminForm && <input type="hidden" name="components" value={getTemplateComponents()} />}

      
      {!isAdminForm && (
        <div className="mb-8">
            <Label className="text-base">Template Type</Label>
            <RadioGroup value={templateType} onValueChange={(v) => setTemplateType(v as any)} className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div>
                    <RadioGroupItem value="STANDARD" id="type-standard" className="sr-only"/>
                    <Label htmlFor="type-standard" className={`flex flex-col items-center justify-center rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${templateType === 'STANDARD' ? 'border-primary' : 'border-muted'}`}>Standard Template</Label>
                </div>
                <div>
                    <RadioGroupItem value="MARKETING_CAROUSEL" id="type-marketing-carousel" className="sr-only"/>
                    <Label htmlFor="type-marketing-carousel" className={`flex flex-col items-center justify-center rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${templateType === 'MARKETING_CAROUSEL' ? 'border-primary' : 'border-muted'}`}>Marketing Carousel</Label>
                </div>
                <div>
                    <RadioGroupItem value="CATALOG_MESSAGE" id="type-product-carousel" className="sr-only"/>
                    <Label htmlFor="type-product-carousel" className={`flex flex-col items-center justify-center rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${templateType === 'CATALOG_MESSAGE' ? 'border-primary' : 'border-muted'}`}>Product Catalog</Label>
                </div>
            </RadioGroup>
        </div>
      )}
      
      {templateType === 'STANDARD' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
              <Card>
                  <CardHeader>
                  <CardTitle>Template Details</CardTitle>
                  <CardDescription>Define the name, language, and category of your template.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="templateName">Template Name</Label>
                      <Input id="templateName" name="name" placeholder="e.g., order_confirmation" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
                      <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only.</p>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select name="category" value={category} onValueChange={(v) => setCategory(v as Template['category'])} required>
                      <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                      <SelectContent>
                          {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                      <Label htmlFor="language">Language</Label>
                      <Select name="language" value={language} onValueChange={setLanguage} required>
                      <SelectTrigger id="language"><SelectValue placeholder="Select a language" /></SelectTrigger>
                      <SelectContent searchable>
                          {languages.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>{lang.name} ({lang.code})</SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                  </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                  <CardTitle>Template Content</CardTitle>
                  <CardDescription>Build the content of your message. Use variables like {'{{1}}'} for personalization.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div className="space-y-2">
                          <Label>Header (Optional)</Label>
                          <input type="hidden" name="headerFormat" value={headerFormat} />
                          <RadioGroup value={headerFormat} onValueChange={setHeaderFormat} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(format => (
                                  <div key={format}><RadioGroupItem value={format} id={format} className="sr-only" /><Label htmlFor={format} className={`flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground ${headerFormat === format ? 'border-primary' : ''} cursor-pointer`}><span className="text-sm font-medium">{format}</span></Label></div>
                              ))}
                          </RadioGroup>
                      </div>

                      {headerFormat === 'TEXT' && (
                          <div className="space-y-2">
                              <Label htmlFor="headerText">Header Text</Label>
                              <Input name="headerText" id="headerText" placeholder="Your header text..." maxLength={60} value={headerText} onChange={(e) => setHeaderText(e.target.value)} />
                          </div>
                      )}

                      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && !isAdminForm && (
                          <div className="space-y-4">
                              <div>
                                  <Label htmlFor="headerSampleUrl">Header Sample Media URL</Label>
                                  <Input
                                      name="headerSampleUrl"
                                      id="headerSampleUrl"
                                      type="url"
                                      placeholder="https://example.com/sample.jpg"
                                      value={headerSampleUrl}
                                      onChange={(e) => setHeaderSampleUrl(e.target.value)}
                                  />
                                  <p className="text-xs text-muted-foreground mt-2">Provide a public URL to a sample media file for submission.</p>
                              </div>
                              <div className="relative">
                                  <Separator />
                                  <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-2 text-xs text-muted-foreground">OR</span>
                              </div>
                              <div>
                                  <Label htmlFor="headerSampleFile">Upload a sample file</Label>
                                  <Input
                                      name="headerSampleFile"
                                      id="headerSampleFile"
                                      type="file"
                                      accept="image/jpeg,image/png,video/mp4,application/pdf"
                                  />
                                  <p className="text-xs text-muted-foreground mt-2">Upload a file from your device. Max 5MB for images, 16MB for video/docs.</p>
                              </div>
                          </div>
                      )}
                  
                      <div className="space-y-2">
                          <Label htmlFor="body">Body</Label>
                          <Textarea id="body" name="body" placeholder="Hi {{1}}, this is a reminder..." className="min-h-[150px]" value={body} onChange={(e) => setBody(e.target.value)} required/>
                      </div>

                      <div className="space-y-2">
                          <Label htmlFor="footer">Footer (Optional)</Label>
                          <Input name="footer" id="footer" placeholder="e.g., Not a customer? Tap to unsubscribe." maxLength={60} value={footer} onChange={(e) => setFooter(e.target.value)}/>
                      </div>
                  </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Buttons (Optional)</CardTitle>
                        <CardDescription>Add quick replies or calls to action to your message.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            {buttons.map((button, index) => (
                                <div key={index} className="p-3 border rounded-lg space-y-3 relative">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleRemoveButton(index)}><Trash2 className="h-4 w-4"/></Button>
                                    <p className="text-sm font-medium text-muted-foreground">{button.type.replace('_', ' ')}</p>
                                    <Input placeholder="Button Text (max 25 chars)" value={button.text} onChange={(e) => handleButtonChange(index, 'text', e.target.value)} maxLength={25} required/>
                                    {button.type === 'QUICK_REPLY' && <Input className="mt-2" placeholder="Payload (optional, max 1000)" value={button.payload || ''} onChange={(e) => handleButtonChange(index, 'payload', e.target.value)} maxLength={1000} />}
                                    {button.type === 'URL' && (
                                    <div className="space-y-2">
                                        <Input placeholder="https://example.com/{{1}}" value={button.url || ''} onChange={(e) => handleButtonChange(index, 'url', e.target.value)} required/>
                                        {button.url?.includes('{{1}}') && (
                                            <Input 
                                                placeholder="Example URL: https://example.com/test" 
                                                value={button.example?.[0] || ''} 
                                                onChange={(e) => handleButtonExampleChange(index, e.target.value)} 
                                                required
                                            />
                                        )}
                                    </div>
                                    )}
                                    {button.type === 'PHONE_NUMBER' && <Input placeholder="+15551234567" value={button.phone_number || ''} onChange={(e) => handleButtonChange(index, 'phone_number', e.target.value)} required/>}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 justify-center">
                            <Button type="button" variant="outline" size="sm" onClick={() => handleAddButton('QUICK_REPLY')}><Plus className="h-4 w-4 mr-1"/>Quick Reply</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => handleAddButton('URL')}><Plus className="h-4 w-4 mr-1"/>URL</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => handleAddButton('PHONE_NUMBER')}><Plus className="h-4 w-4 mr-1"/>Call</Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">You can add up to 10 Quick Replies OR 1 URL and 1 Phone button.</p>

                    </CardContent>
                </Card>
                <AiSuggestions onSuggestionSelect={setBody} />
            </div>
        </div>
      )}

      {templateType === 'MARKETING_CAROUSEL' && (
        <div className="lg:col-span-3 space-y-6">
            <Card>
                <CardHeader>
                <CardTitle>Carousel Details</CardTitle>
                <CardDescription>Define the name, language, and category for your carousel template.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input name="templateName" placeholder="e.g., weekly_promo_carousel" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="language">Language</Label>
                        <Select name="language" defaultValue="en_US" required>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent searchable>{languages.map(lang => <SelectItem key={lang.code} value={lang.code}>{lang.name} ({lang.code})</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <input type="hidden" name="category" value="MARKETING" />
                </CardContent>
            </Card>

            <Separator />
            
            <div className="space-y-4">
                {carouselCards.map((card, cardIndex) => (
                    <Card key={card.id} className="relative">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleRemoveCarouselCard(cardIndex)}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                        <CardHeader><CardTitle>Card {cardIndex + 1}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label>Card Header (IMAGE or VIDEO)</Label>
                                <RadioGroup value={card.headerFormat} onValueChange={(value) => handleCarouselCardChange(cardIndex, 'headerFormat', value)} className="grid grid-cols-3 gap-4">
                                    {['NONE', 'IMAGE', 'VIDEO'].map(format => (
                                        <div key={format}><RadioGroupItem value={format} id={`card_${cardIndex}_${format}`} className="sr-only" /><Label htmlFor={`card_${cardIndex}_${format}`} className={`flex flex-col items-center justify-center rounded-md border-2 p-4 cursor-pointer ${card.headerFormat === format ? 'border-primary' : 'border-muted'}`}><span className="text-sm font-medium">{format}</span></Label></div>
                                    ))}
                                </RadioGroup>
                            </div>
                            {(card.headerFormat === 'IMAGE' || card.headerFormat === 'VIDEO') && (
                                <div className="p-3 border rounded-md space-y-2">
                                    <Label htmlFor={`card_${cardIndex}_headerSampleFile`}>Sample Media File</Label>
                                    <Input name={`card_${cardIndex}_headerSampleFile`} id={`card_${cardIndex}_headerSampleFile`} type="file" required/>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor={`card_${cardIndex}_body`}>Card Body</Label>
                                <Textarea id={`card_${cardIndex}_body`} value={card.body} onChange={e => handleCarouselCardChange(cardIndex, 'body', e.target.value)} placeholder="Text for this card..." required/>
                            </div>
                             <div className="space-y-2">
                                <Label>Card Buttons (Optional, max 2)</Label>
                                {card.buttons.map((btn, btnIndex) => (
                                    <div key={btnIndex} className="p-2 border rounded-lg space-y-2 relative">
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleRemoveCarouselCardButton(cardIndex, btnIndex)}><Trash2 className="h-3 w-3"/></Button>
                                        <RadioGroup value={btn.type} onValueChange={(val) => handleCarouselCardButtonChange(cardIndex, btnIndex, 'type', val)} className="flex gap-4">
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="URL" id={`btn-type-url-${cardIndex}-${btnIndex}`} /><Label htmlFor={`btn-type-url-${cardIndex}-${btnIndex}`} className="font-normal">URL</Label></div>
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="QUICK_REPLY" id={`btn-type-postback-${cardIndex}-${btnIndex}`} /><Label htmlFor={`btn-type-postback-${cardIndex}-${btnIndex}`} className="font-normal">Quick Reply</Label></div>
                                        </RadioGroup>
                                        <Input placeholder="Button Text" value={btn.text} onChange={e => handleCarouselCardButtonChange(cardIndex, btnIndex, 'text', e.target.value)} required/>
                                        {btn.type === 'URL' ? (
                                             <Input placeholder="https://example.com" value={btn.url || ''} onChange={e => handleCarouselCardButtonChange(cardIndex, btnIndex, 'url', e.target.value)} required/>
                                        ) : (
                                             <Input placeholder="Payload_for_webhook" value={btn.payload || ''} onChange={e => handleCarouselCardButtonChange(cardIndex, btnIndex, 'payload', e.target.value)} required/>
                                        )}
                                    </div>
                                ))}
                                {card.buttons.length < 2 && (
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="outline" onClick={() => handleAddCarouselCardButton(cardIndex, 'URL')}>+ URL Button</Button>
                                        <Button type="button" size="sm" variant="outline" onClick={() => handleAddCarouselCardButton(cardIndex, 'QUICK_REPLY')}>+ Quick Reply</Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {carouselCards.length < 10 && <Button type="button" variant="outline" className="w-full" onClick={handleAddCarouselCard}><Plus className="mr-2 h-4 w-4"/>Add Card</Button>}
            </div>
        </div>
      )}

      {templateType === 'CATALOG_MESSAGE' && (
        <div className="lg:col-span-3 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Product Carousel Builder</CardTitle>
                    <CardDescription>
                        Configure your interactive product carousel. These templates are saved locally and do not require Meta approval.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="templateName">Template Name</Label>
                            <Input name="templateName" placeholder="e.g., summer_collection_carousel" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="catalogId">Meta Catalog ID</Label>
                            <Input name="catalogId" placeholder="Your Meta Commerce catalog ID" required />
                            <p className="text-xs text-muted-foreground">This template type requires a Meta Commerce Catalog.</p>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="carouselHeader">Header Text (Optional)</Label>
                        <Input name="carouselHeader" placeholder="Our Top Items" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="carouselBody">Body Text</Label>
                        <Textarea name="carouselBody" placeholder="Check out these amazing items from our new collection." required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="carouselFooter">Footer Text (Optional)</Label>
                        <Input name="carouselFooter" placeholder="Sale ends this Friday!" />
                    </div>
                    
                    <Separator />
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h4 className="font-semibold">Section 1</h4>
                             <div className="space-y-2">
                                <Label htmlFor="section1Title">Section Title</Label>
                                <Input name="section1Title" placeholder="Popular Items" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="section1ProductIDs">Item/Product IDs</Label>
                                <Textarea name="section1ProductIDs" placeholder="item_id_1&#x0a;item_id_2&#x0a;item_id_3" className="font-mono text-xs" required />
                                <p className="text-xs text-muted-foreground">Enter one Item/Product ID from your catalog per line.</p>
                            </div>
                        </div>
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h4 className="font-semibold">Section 2</h4>
                            <div className="space-y-2">
                                <Label htmlFor="section2Title">Section Title</Label>
                                <Input name="section2Title" placeholder="New Arrivals" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="section2ProductIDs">Item/Product IDs</Label>
                                <Textarea name="section2ProductIDs" placeholder="item_id_4&#x0a;item_id_5&#x0a;item_id_6" className="font-mono text-xs" required />
                                <p className="text-xs text-muted-foreground">Enter one Item/Product ID from your catalog per line.</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}


      <Separator className="my-8" />
      
      {lastDebugInfo && templateType === 'STANDARD' && (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Media Upload Debugging</CardTitle>
                <CardDescription>Details of the request to upload media and get a handle from Meta.</CardDescription>
            </CardHeader>
            <CardContent>
                <pre className="p-4 bg-muted/50 rounded-md whitespace-pre-wrap text-xs font-code max-h-96 overflow-y-auto">
                    {lastDebugInfo}
                </pre>
            </CardContent>
        </Card>
      )}

      {lastPayload && templateType === 'STANDARD' && (
        <Card className="mb-8">
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Last API Payload</CardTitle>
                    <CardDescription>This is the JSON payload that was sent (or attempted to be sent) to Meta.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={handleCopyPayload}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy Payload</span>
                </Button>
            </CardHeader>
            <CardContent>
                <pre className="p-4 bg-muted/50 rounded-md whitespace-pre-wrap text-xs font-code max-h-96 overflow-y-auto">
                    {lastPayload}
                </pre>
            </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <SubmitButton templateType={templateType} isAdminForm={isAdminForm} />
      </div>
    </form>
  );
}
