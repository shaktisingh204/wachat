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
import { Wand2, LoaderCircle, AlertCircle, Info, FileUp } from 'lucide-react';
import { handleSuggestContent, handleCreateTemplate } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

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

  const [body, setBody] = useState('');
  const [headerType, setHeaderType] = useState<HeaderType>('NONE');

  // AI Assistant State
  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

  const insertSuggestion = (suggestion: string) => {
    setBody((prevBody) => (prevBody ? `${prevBody}\n\n${suggestion}` : suggestion));
    toast({
        title: "Suggestion Inserted!",
        description: "The AI suggestion has been added to your template body."
    })
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <form action={formAction} className="lg:col-span-2 space-y-6">
        <input type="hidden" name="projectId" value={projectId} />

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
                    <div className="space-y-2">
                        <Label htmlFor="headerMediaHandle">Media Handle</Label>
                        <Input name="headerMediaHandle" id="headerMediaHandle" placeholder="Paste your media handle here" />
                        <Alert variant="default" className="bg-muted/50">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Media Handle Required</AlertTitle>
                            <AlertDescription className="text-xs">
                                You must first upload your media to the Meta API to get a handle. This handle is then used to create the template.
                            </AlertDescription>
                        </Alert>
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
            <CardFooter className="flex justify-end">
                <SubmitButton />
            </CardFooter>
        </Card>
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
