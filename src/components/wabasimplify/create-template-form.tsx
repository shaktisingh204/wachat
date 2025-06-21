'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LoaderCircle, FileUp, Plus, Trash2, UploadCloud } from 'lucide-react';
import { handleCreateTemplate, handleUploadMedia } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project, Template } from '@/app/dashboard/page';
import { Separator } from '../ui/separator';

const createTemplateInitialState = {
  message: null,
  error: null,
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
  example?: string[];
};

const languages = [
    { code: 'af', name: 'Afrikaans' }, { code: 'sq', name: 'Albanian' }, { code: 'ar', name: 'Arabic' },
    { code: 'az', name: 'Azerbaijani' }, { code: 'bn', name: 'Bengali' }, { code: 'bg', name: 'Bulgarian' },
    { code: 'ca', name: 'Catalan' }, { code: 'zh_CN', name: 'Chinese (CHN)' }, { code: 'zh_HK', name: 'Chinese (HKG)' },
    { code: 'zh_TW', name: 'Chinese (TAI)' }, { code: 'hr', name: 'Croatian' }, { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' }, { code: 'nl', name: 'Dutch' }, { code: 'en', name: 'English' },
    { code: 'en_US', name: 'English (US)' }, { code: 'et', name: 'Estonian' }, { code: 'fil', name: 'Filipino' },
    { code: 'fi', name: 'Finnish' }, { code: 'fr', name: 'French' }, { code: 'ka', name: 'Georgian' },
    { code: 'de', name: 'German' }, { code: 'el', name: 'Greek' }, { code: 'gu', name: 'Gujarati' },
    { code: 'ha', name: 'Hausa' }, { code: 'he', name: 'Hebrew' }, { code: 'hi', name: 'Hindi' },
    { code: 'hu', name: 'Hungarian' }, { code: 'id', name: 'Indonesian' }, { code: 'ga', name: 'Irish' },
    { code: 'it', name: 'Italian' }, { code: 'ja', name: 'Japanese' }, { code: 'kn', name: 'Kannada' },
    { code: 'kk', name: 'Kazakh' }, { code: 'rw_RW', name: 'Kinyarwanda' }, { code: 'ko', name: 'Korean' },
    { code: 'ky_KG', name: 'Kyrgyz (Kyrgyzstan)' }, { code: 'lo', name: 'Lao' }, { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' }, { code: 'mk', name: 'Macedonian' }, { code: 'ms', name: 'Malay' },
    { code: 'ml', name: 'Malayalam' }, { code: 'mr', name: 'Marathi' }, { code: 'nb', name: 'Norwegian' },
    { code: 'fa', name: 'Persian' }, { code: 'pl', name: 'Polish' }, { code: 'pt_BR', name: 'Portuguese (BR)' },
    { code: 'pt_PT', name: 'Portuguese (POR)' }, { code: 'pa', name: 'Punjabi' }, { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' }, { code: 'sr', name: 'Serbian' }, { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' }, { code: 'es', name: 'Spanish' }, { code: 'es_AR', name: 'Spanish (ARG)' },
    { code: 'es_MX', name: 'Spanish (MEX)' }, { code: 'es_ES', name: 'Spanish (SPA)' }, { code: 'sw', name: 'Swahili' },
    { code: 'sv', name: 'Swedish' }, { code: 'ta', name: 'Tamil' }, { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' }, { code: 'tr', name: 'Turkish' }, { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' }, { code: 'uz', name: 'Uzbek' }, { code: 'vi', name: 'Vietnamese' }, { code: 'zu', name: 'Zulu' }
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
  const [headerHandle, setHeaderHandle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [buttons, setButtons] = useState<ButtonType[]>([]);
  
  useEffect(() => {
    if (initialTemplate) {
      let name = initialTemplate.name;
      if (isCloning) {
        name = `${name}_clone_${Math.floor(Math.random() * 100)}`;
      }
      setTemplateName(name);
      setCategory(initialTemplate.category);
      setLanguage(initialTemplate.language);

      const bodyComp = initialTemplate.components?.find(c => c.type === 'BODY');
      setBody(bodyComp?.text || initialTemplate.body || '');

      const headerComp = initialTemplate.components?.find(c => c.type === 'HEADER');
      if (headerComp) {
        setHeaderFormat(headerComp.format || 'NONE');
        if(headerComp.format === 'TEXT') {
            setHeaderText(headerComp.text || '');
        } else if (headerComp.example?.header_handle?.[0]) {
            setHeaderHandle(headerComp.example.header_handle[0]);
        }
      } else {
        setHeaderFormat('NONE');
      }
      
      const footerComp = initialTemplate.components?.find(c => c.type === 'FOOTER');
      setFooter(footerComp?.text || '');

      const buttonsComp = initialTemplate.components?.find(c => c.type === 'BUTTONS');
      setButtons(buttonsComp?.buttons || []);

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
  }, [state, toast, router]);
  
  const handleUpload = async (file: File) => {
    if (!phoneNumberId) {
        setUploadError('Please select a phone number to upload media from.');
        return;
    }
    setIsUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', project._id.toString());
    formData.append('phoneNumberId', phoneNumberId);

    const result = await handleUploadMedia(formData);
    if (result.error) {
        setUploadError(result.error);
        setHeaderHandle('');
    } else {
        setHeaderHandle(result.handle!);
    }
    setIsUploading(false);
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

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

  const handleButtonChange = (index: number, field: keyof ButtonType, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
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
                  <SelectContent>
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
                    <RadioGroup value={headerFormat} onValueChange={setHeaderFormat} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].map(format => (
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

                {['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerFormat) && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Phone Number for Upload</Label>
                            <Select onValueChange={setPhoneNumberId} value={phoneNumberId}>
                                <SelectTrigger><SelectValue placeholder="Select a number..." /></SelectTrigger>
                                <SelectContent>
                                {project.phoneNumbers?.map((phone) => (
                                    <SelectItem key={phone.id} value={phone.id}>{phone.display_phone_number}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mediaFile">Upload Media for Handle</Label>
                            <div className="flex gap-2">
                                <Input id="mediaFile" type="file" ref={fileInputRef} className="flex-grow" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={isUploading || !phoneNumberId} />
                                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading || !phoneNumberId}>{isUploading ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <UploadCloud className="h-4 w-4"/>}</Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Upload your media to get a handle required by Meta.</p>
                            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                        </div>
                        <div className="space-y-2">
                           <Label htmlFor="headerHandle">Media Handle</Label>
                           <Input name="headerHandle" id="headerHandle" value={headerHandle} readOnly placeholder="Upload a file to generate a handle..."/>
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
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        {buttons.map((button, index) => (
                            <div key={index} className="p-3 border rounded-lg space-y-3 relative">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleRemoveButton(index)}><Trash2 className="h-4 w-4"/></Button>
                                <p className="text-sm font-medium text-muted-foreground">{button.type.replace('_', ' ')}</p>
                                <Input placeholder="Button Text (max 25 chars)" value={button.text} onChange={(e) => handleButtonChange(index, 'text', e.target.value)} maxLength={25} required/>
                                {button.type === 'URL' && <Input placeholder="https://example.com/..." value={button.url || ''} onChange={(e) => handleButtonChange(index, 'url', e.target.value)} required/>}
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
             <Card>
                <CardHeader>
                    <CardTitle>Submit</CardTitle>
                    <CardDescription>When you're ready, submit your template for review by Meta.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </div>
      </div>
    </form>
  );
}
