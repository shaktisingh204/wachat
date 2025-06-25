
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
import { handleCreateTemplate } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project, Template } from '@/app/dashboard/page';
import { Separator } from '../ui/separator';
import { AiSuggestions } from './ai-suggestions';

const createTemplateInitialState = {
  message: null,
  error: null,
  payload: null,
  debugInfo: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <Button size="lg" type="submit" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Submitting for Approval...
          </>
        ) : (
          <>
            <FileUp className="mr-2 h-4 w-4" />
            Submit for Approval
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

export function CreateTemplateForm({ project, initialTemplate, isCloning }: { project: WithId<Project>, initialTemplate?: WithId<Template> | null, isCloning?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction] = useActionState(handleCreateTemplate, createTemplateInitialState);

  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<Template['category'] | ''>('');
  const [language, setLanguage] = useState('en_US');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [headerFormat, setHeaderFormat] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerSampleUrl, setHeaderSampleUrl] = useState('');
  const [buttons, setButtons] = useState<ButtonType[]>([]);
  const [lastPayload, setLastPayload] = useState('');
  const [lastDebugInfo, setLastDebugInfo] = useState('');
  
  useEffect(() => {
    if (initialTemplate) {
      if (isCloning) {
        setTemplateName(`${initialTemplate.name || ''}_clone_${Math.floor(Math.random() * 1000)}`);
      } else {
        setTemplateName(initialTemplate.name || '');
      }

      setCategory(initialTemplate.category || '');
      setLanguage(initialTemplate.language || 'en_US');
      
      const bodyComp = initialTemplate.components?.find(c => c.type === 'BODY');
      setBody(bodyComp?.text || initialTemplate.body || '');
      
      const footerComp = initialTemplate.components?.find(c => c.type === 'FOOTER');
      setFooter(footerComp?.text || '');
      
      const buttonsComp = initialTemplate.components?.find(c => c.type === 'BUTTONS');
      setButtons(buttonsComp?.buttons || []);

      const headerComp = initialTemplate.components?.find(c => c.type === 'HEADER');
      if (headerComp) {
        const format = headerComp.format || 'NONE';
        setHeaderFormat(format);

        if (format === 'TEXT') {
          setHeaderText(headerComp.text || '');
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
      router.push('/dashboard/templates');
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
  }, [state, toast, router]);

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

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(lastPayload);
    toast({
        title: 'Payload Copied!',
        description: 'The API payload has been copied to your clipboard.',
    });
  };


  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={project._id.toString()} />
      <input type="hidden" name="buttons" value={JSON.stringify(buttons)} />
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
                <Input id="templateName" name="templateName" placeholder="e.g., order_confirmation" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select name="category" value={category} onValueChange={(v) => setCategory(v as Template['category'])} required>
                  <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
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
                    <RadioGroup value={headerFormat} onValueChange={setHeaderFormat} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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

                {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
                    <div className="space-y-2">
                        <Label htmlFor="headerSampleUrl">Header Sample Media URL</Label>
                         <Input
                            name="headerSampleUrl"
                            id="headerSampleUrl"
                            type="url"
                            placeholder="https://example.com/sample.jpg"
                            value={headerSampleUrl}
                            onChange={(e) => setHeaderSampleUrl(e.target.value)}
                            required
                         />
                        <p className="text-xs text-muted-foreground">Provide a public URL to a sample media file for submission.</p>
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
      <Separator className="my-8" />
      
      {lastDebugInfo && (
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

      {lastPayload && (
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
        <SubmitButton />
      </div>
    </form>
  );
}
