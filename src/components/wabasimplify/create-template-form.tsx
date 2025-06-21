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
import { LoaderCircle, FileUp, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import { handleCreateTemplate, handleUploadMedia } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project } from '@/app/dashboard/page';

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

type Button = {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
};

export function CreateTemplateForm({ project }: { project: WithId<Project> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction] = useActionState(handleCreateTemplate, createTemplateInitialState);

  const [headerFormat, setHeaderFormat] = useState('NONE');
  const [headerHandle, setHeaderHandle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phoneNumberId, setPhoneNumberId] = useState('');

  const [buttons, setButtons] = useState<Button[]>([]);

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

  const handleAddButton = (type: Button['type']) => {
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

  const handleButtonChange = (index: number, field: keyof Button, value: string) => {
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
                <Input id="templateName" name="templateName" placeholder="e.g., order_confirmation" required />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select name="category" required>
                  <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select name="language" defaultValue="en_US" required>
                  <SelectTrigger id="language"><SelectValue placeholder="Select a language" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en_US">English (US)</SelectItem>
                    <SelectItem value="en_GB">English (UK)</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="pt_BR">Portuguese (Brazil)</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
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
                        <Input name="headerText" id="headerText" placeholder="Your header text..." maxLength={60} />
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
                    <Textarea id="body" name="body" placeholder="Hi {{1}}, this is a reminder..." className="min-h-[150px]" required/>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="footer">Footer (Optional)</Label>
                    <Input name="footer" id="footer" placeholder="e.g., Not a customer? Tap to unsubscribe." maxLength={60} />
                </div>
            </CardContent>
          </Card>
          <div className="flex justify-end pt-4">
            <SubmitButton />
          </div>
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
                                {button.type === 'URL' && <Input placeholder="https://example.com/..." value={button.url} onChange={(e) => handleButtonChange(index, 'url', e.target.value)} required/>}
                                {button.type === 'PHONE_NUMBER' && <Input placeholder="+15551234567" value={button.phone_number} onChange={(e) => handleButtonChange(index, 'phone_number', e.target.value)} required/>}
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
        </div>
      </div>
    </form>
  );
}
