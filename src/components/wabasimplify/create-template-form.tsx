
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, LoaderCircle, AlertCircle, Info, FileUp, Loader2, PlusCircle, Trash2, Phone, Link as LinkIcon, MessageSquareQuote } from 'lucide-react';
import { handleSuggestContent, handleCreateTemplate, getProjectById, handleUploadMedia } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { WithId } from 'mongodb';
import type { Project } from '@/app/dashboard/page';

type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
type ButtonState = {
  id: number;
  type: ButtonType;
  text: string;
  phoneNumber?: string;
  url?: string;
  urlExample?: string;
};


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


export function CreateTemplateForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction] = useActionState(handleCreateTemplate, createTemplateInitialState);

  // Form State
  const [body, setBody] = useState('');
  const [headerType, setHeaderType] = useState<HeaderType>('NONE');
  const [buttons, setButtons] = useState<ButtonState[]>([]);
  
  // Project and Media Upload State
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mediaHandle, setMediaHandle] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // AI Assistant State
  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Derived state for button limits
  const hasCtaButton = buttons.some(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
  const hasQuickReplyButton = buttons.some(b => b.type === 'QUICK_REPLY');
  const urlButtonCount = buttons.filter(b => b.type === 'URL').length;
  const phoneButtonCount = buttons.filter(b => b.type === 'PHONE_NUMBER').length;
  const quickReplyButtonCount = buttons.filter(b => b.type === 'QUICK_REPLY').length;

  useEffect(() => {
    async function fetchProject() {
      setIsProjectLoading(true);
      try {
        if (projectId) {
          const projectData = await getProjectById(projectId);
          if (projectData) {
            setProject(projectData as WithId<Project>);
          } else {
            toast({
              title: "Project Not Found",
              description: "Could not find project details. You may need to select a project again.",
              variant: "destructive",
            });
          }
        }
      } catch (error: any) {
        toast({
          title: "Error Loading Project",
          description: "An error occurred while loading project details. Please check the console and try again.",
          variant: "destructive",
        });
      } finally {
        setIsProjectLoading(false);
      }
    }
    fetchProject();
  }, [projectId, toast]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      router.push('/dashboard/templates');
    }
    if (state?.error) {
      toast({ title: 'Submission Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);
  
  const onGenerateSuggestions = async () => {
    if (!topic) {
        toast({
            title: "Topic required",
            description: "Please enter a topic to generate suggestions.",
            variant: "destructive"
        })
        return;
    }
    setIsGenerating(true);
    setAiError(null);
    setSuggestions([]);
    
    const result = await handleSuggestContent(topic);
    
    setIsGenerating(false);
    if (result.error) {
      setAiError(result.error);
    } else if (result.suggestions) {
      setSuggestions(result.suggestions);
    }
  };
  
  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!selectedPhoneNumberId) {
        toast({ title: 'Phone Number Required', description: 'Please select a phone number to upload media for.', variant: 'destructive' });
        return;
    }

    setIsUploading(true);
    setUploadError(null);
    setMediaHandle('');
    setUploadedFileName('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('phoneNumberId', selectedPhoneNumberId);
    
    const result = await handleUploadMedia(formData);

    if (result.error) {
        setUploadError(result.error);
        toast({ title: 'Upload Failed', description: result.error, variant: 'destructive' });
    } else if (result.handle) {
        setMediaHandle(result.handle);
        setUploadedFileName(file.name);
        toast({ title: 'Upload Successful', description: `Media "${file.name}" uploaded.` });
    }
    setIsUploading(false);
  };

  const insertSuggestion = (suggestion: string) => {
    setBody((prevBody) => (prevBody ? `${prevBody}\n\n${suggestion}` : suggestion));
    toast({
        title: "Suggestion Inserted!",
        description: "The AI suggestion has been added to your template body."
    })
  };

  const handleAddButton = (type: ButtonType) => {
    setButtons(prev => [...prev, { id: Date.now(), type, text: '' }]);
  };
  
  const handleUpdateButton = (id: number, field: keyof ButtonState, value: string) => {
    setButtons(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleRemoveButton = (id: number) => {
    setButtons(prev => prev.filter(b => b.id !== id));
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <form action={formAction} className="lg:col-span-2 space-y-6">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="buttons" value={JSON.stringify(buttons)} />

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
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
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
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
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
                <CardTitle>Template Components</CardTitle>
                <CardDescription>Build the content of your message. Use variables like {'{{1}}'} for personalization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="headerType">Header (Optional)</Label>
                    <Select name="headerType" value={headerType} onValueChange={(v) => setHeaderType(v as HeaderType)}>
                        <SelectTrigger id="headerType">
                            <SelectValue placeholder="Select a header type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NONE">None</SelectItem>
                            <SelectItem value="TEXT">Text</SelectItem>
                            <SelectItem value="IMAGE">Image</SelectItem>
                            <SelectItem value="VIDEO">Video</SelectItem>
                            <SelectItem value="DOCUMENT">Document</SelectItem>
                            <SelectItem value="AUDIO">Audio</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {headerType === 'TEXT' && (
                    <div className="space-y-2">
                        <Label htmlFor="headerText">Header Text</Label>
                        <Input name="headerText" id="headerText" placeholder="Your engaging header text" maxLength={60} />
                        <p className="text-xs text-muted-foreground">Max 60 characters. One variable allowed for Marketing/Utility.</p>
                    </div>
                )}
                {['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerType) && (
                  <div className="space-y-4 rounded-md border p-4 bg-muted/50">
                      <div className="space-y-2">
                          <Label htmlFor="phone-number">Phone Number for Upload</Label>
                          <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId} required>
                              <SelectTrigger id="phone-number">
                                  <SelectValue placeholder="Select a number..."/>
                              </SelectTrigger>
                              <SelectContent>
                                  {isProjectLoading ? (
                                      <SelectItem value="loading" disabled>Loading numbers...</SelectItem>
                                  ) : (
                                      project?.phoneNumbers?.map(phone => (
                                          <SelectItem key={phone.id} value={phone.id}>{phone.display_phone_number}</SelectItem>
                                      ))
                                  )}
                              </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Media uploads are associated with a specific phone number.</p>
                      </div>

                      <div className="space-y-2">
                          <Label htmlFor="headerMediaFile">Upload Media File</Label>
                          <Input 
                              id="headerMediaFile" 
                              type="file" 
                              onChange={onFileChange} 
                              disabled={isUploading || !selectedPhoneNumberId}
                              className="file:text-primary file:font-medium"
                          />
                          {isUploading && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Uploading...
                              </div>
                          )}
                          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                      </div>

                      <div className="space-y-2">
                          <Label htmlFor="headerMediaHandle">Media Handle</Label>
                          <Input name="headerMediaHandle" id="headerMediaHandle" value={mediaHandle} readOnly placeholder="Upload a file to generate a handle" />
                          {uploadedFileName && <p className="text-sm text-muted-foreground">Uploaded: {uploadedFileName}</p>}
                          <Alert variant="default" className="bg-background">
                              <Info className="h-4 w-4" />
                              <AlertTitle>Media Upload</AlertTitle>
                              <AlertDescription className="text-xs">
                                  Select a phone number and upload your media. A handle will be automatically generated and used to create the template.
                              </AlertDescription>
                          </Alert>
                      </div>
                  </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="body">Body</Label>
                    <Textarea
                        id="body"
                        name="body"
                        placeholder="Hi {{1}}, this is a reminder for your appointment tomorrow at {{2}}."
                        className="min-h-[150px]"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        required
                    />
                     <p className="text-xs text-muted-foreground">The main content of your message. Use variables for personalization.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="footerText">Footer (Optional)</Label>
                    <Input name="footerText" id="footerText" placeholder="e.g., Thank you for your business." maxLength={60} />
                    <p className="text-xs text-muted-foreground">Max 60 characters. Variables are not allowed.</p>
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Buttons (Optional)</CardTitle>
                <CardDescription>Add call-to-action or quick reply buttons. You cannot mix button types.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {buttons.map((button, index) => (
              <div key={button.id} className="p-4 border rounded-lg bg-muted/50 space-y-4 relative">
                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleRemoveButton(button.id)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove Button</span>
                </Button>

                <div className="flex items-center gap-2 font-medium text-foreground">
                    {button.type === 'QUICK_REPLY' && <><MessageSquareQuote className="h-4 w-4 text-primary" />Quick Reply</>}
                    {button.type === 'URL' && <><LinkIcon className="h-4 w-4 text-primary" />URL Button</>}
                    {button.type === 'PHONE_NUMBER' && <><Phone className="h-4 w-4 text-primary" />Phone Button</>}
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor={`btn-text-${button.id}`}>Button Text</Label>
                    <Input id={`btn-text-${button.id}`} value={button.text} onChange={(e) => handleUpdateButton(button.id, 'text', e.target.value)} placeholder="e.g., View Details" maxLength={25} required/>
                </div>
                
                {button.type === 'URL' && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor={`btn-url-${button.id}`}>URL</Label>
                            <Input id={`btn-url-${button.id}`} value={button.url} onChange={(e) => handleUpdateButton(button.id, 'url', e.target.value)} placeholder="https://example.com/promo={{1}}" required />
                            <p className="text-xs text-muted-foreground">Use {{1}} for one variable.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`btn-url-example-${button.id}`}>URL Example</Label>
                            <Input id={`btn-url-example-${button.id}`} value={button.urlExample} onChange={(e) => handleUpdateButton(button.id, 'urlExample', e.target.value)} placeholder="https://example.com/promo/summer-sale" />
                             <p className="text-xs text-muted-foreground">Required if URL contains a variable.</p>
                        </div>
                    </>
                )}
                {button.type === 'PHONE_NUMBER' && (
                    <div className="space-y-2">
                        <Label htmlFor={`btn-phone-${button.id}`}>Phone Number</Label>
                        <Input id={`btn-phone-${button.id}`} value={button.phoneNumber} onChange={(e) => handleUpdateButton(button.id, 'phoneNumber', e.target.value)} placeholder="+1234567890" required/>
                    </div>
                )}
              </div>
            ))}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => handleAddButton('QUICK_REPLY')} disabled={hasCtaButton || quickReplyButtonCount >= 3}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Quick Reply
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddButton('URL')} disabled={hasQuickReplyButton || urlButtonCount >= 1}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add URL Button
                </Button>
                <Button type="button" variant="outline" onClick={() => handleAddButton('PHONE_NUMBER')} disabled={hasQuickReplyButton || phoneButtonCount >= 1}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Phone Button
                </Button>
            </CardFooter>
        </Card>

        <div className="flex justify-end pt-4">
            <SubmitButton />
        </div>
      </form>

      <div className="lg:col-span-1 space-y-6">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="text-primary" />
              AI Content Assistant
            </CardTitle>
            <CardDescription>
              Get help writing your message body. Enter a topic and we'll generate suggestions for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ai-topic">Topic</Label>
              <Input
                id="ai-topic"
                placeholder="e.g., Order shipped confirmation"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
              />
            </div>
            <Button onClick={onGenerateSuggestions} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generate Suggestions
            </Button>
            <div className="space-y-4 pt-4">
              {aiError && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{aiError}</AlertDescription>
                </Alert>
              )}
              {suggestions.length > 0 && <h4 className="font-semibold text-foreground">Suggestions</h4>}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {suggestions.map((suggestion, index) => (
                   <Card key={index} className="bg-background/80 hover:border-primary transition-colors cursor-pointer" onClick={() => insertSuggestion(suggestion)}>
                     <CardContent className="p-3 text-sm text-foreground/90">
                        {suggestion}
                     </CardContent>
                   </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
