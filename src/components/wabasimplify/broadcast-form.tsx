
'use client';

import { useFormStatus } from 'react-dom';
import { useActionState, useEffect, useRef, useState } from 'react';
import { handleStartBroadcast } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { LoaderCircle, Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import type { Project, Template } from '@/app/dashboard/page';
import { Separator } from '@/components/ui/separator';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" />
          Start Broadcast
        </>
      )}
    </Button>
  );
}

export function BroadcastForm({ templates, project }: { templates: WithId<Template>[]; project: WithId<Project> | null }) {
  const [state, formAction] = useActionState(handleStartBroadcast, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<WithId<Template> | null>(null);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [fileName, setFileName] = useState('');
  const [jsonPayload, setJsonPayload] = useState('');

  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      formRef.current?.reset();
      setFileName('');
      setSelectedTemplate(null);
      setSelectedPhoneNumber('');
    }
    if (state?.error) {
      toast({
        title: 'Broadcast Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  useEffect(() => {
    if (selectedPhoneNumber && selectedTemplate && fileName) {
      const getVars = (text: string): number[] => {
        if (!text) return [];
        const variableMatches = text.match(/{{(\d+)}}/g);
        return variableMatches ? [...new Set(variableMatches.map(v => parseInt(v.match(/(\d+)/)![1])))] : [];
      };

      const payloadComponents: any[] = [];
      
      const headerComponent = selectedTemplate.components.find(c => c.type === 'HEADER');
      if (headerComponent) {
        const parameters: any[] = [];
        if (headerComponent.format === 'TEXT' && headerComponent.text) {
            const headerVars = getVars(headerComponent.text);
            if (headerVars.length > 0) {
                headerVars.sort((a,b) => a-b).forEach(varNum => {
                    parameters.push({
                        type: 'text',
                        text: `[Sample Variable ${varNum}]`,
                    });
                });
            }
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerComponent.format)) {
             const type = headerComponent.format.toLowerCase();
             const mediaObject: any = { link: "[MEDIA_URL_FROM_TEMPLATE_OR_OVERRIDE]" };
             if (type === 'document') {
                mediaObject.filename = "sample_file.pdf"; 
             }
             parameters.push({ type, [type]: mediaObject });
        }
        if (parameters.length > 0) {
            payloadComponents.push({ type: 'header', parameters });
        }
      }

      const bodyComponent = selectedTemplate.components.find(c => c.type === 'BODY');
      if (bodyComponent?.text) {
          const bodyVars = getVars(bodyComponent.text);
          if (bodyVars.length > 0) {
              const parameters = bodyVars.sort((a,b) => a-b).map(varNum => ({
                  type: 'text',
                  text: `[Sample Variable ${varNum}]`,
              }));
              payloadComponents.push({ type: 'body', parameters });
          }
      }

      const buttonsComponent = selectedTemplate.components.find(c => c.type === 'BUTTONS');
      if (buttonsComponent) {
          payloadComponents.push(buttonsComponent);
      }

      const messageData = {
        messaging_product: 'whatsapp',
        to: 'RECIPIENT_PHONE_NUMBER_FROM_FILE',
        recipient_type: 'individual',
        type: 'template',
        template: {
          name: selectedTemplate.name,
          language: { code: selectedTemplate.language || 'en_US' },
          ...(payloadComponents.length > 0 && { components: payloadComponents }),
        },
      };

      setJsonPayload(JSON.stringify(messageData, null, 2));

    } else {
      setJsonPayload('');
    }
  }, [selectedPhoneNumber, selectedTemplate, fileName]);


  if (!project) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>No Project Selected</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Action Required</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard page before sending a broadcast.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t._id.toString() === templateId);
    setSelectedTemplate(template || null);
  };

  const showImageUpload = selectedTemplate?.components?.some(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(c.format));

  return (
    <>
        <Card>
        <form ref={formRef} action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <CardHeader>
            <CardTitle>New Broadcast Campaign</CardTitle>
            <CardDescription>Select a phone number, template, and upload your contacts file.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
                <Label htmlFor="phoneNumberId">1. Select Phone Number</Label>
                <Select name="phoneNumberId" required onValueChange={setSelectedPhoneNumber}>
                <SelectTrigger id="phoneNumberId">
                    <SelectValue placeholder="Choose a number..." />
                </SelectTrigger>
                <SelectContent>
                    {project.phoneNumbers?.map((phone) => (
                    <SelectItem key={phone.id} value={phone.id}>
                        {phone.display_phone_number}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="templateId">2. Select Message Template</Label>
                <Select name="templateId" required onValueChange={handleTemplateChange}>
                <SelectTrigger id="templateId">
                    <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                    {templates.map((template) => (
                    <SelectItem key={template._id.toString()} value={template._id.toString()}>
                        {template.name} ({template.category})
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="csvFile">3. Upload Contacts</Label>
                <Input
                id="csvFile"
                name="csvFile"
                type="file"
                accept=".csv,.xlsx"
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                className="file:text-primary file:font-medium"
                />
                <p className="text-xs text-muted-foreground">
                First column must be phone numbers. For variables like {'{{1}}'}, use 'variable1' columns.
                </p>
            </div>

            {showImageUpload && (
                <>
                    <div className="md:col-span-3">
                        <Separator className="my-2" />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                    <Label htmlFor="headerImageFile">4. Header Media Override (Optional)</Label>
                    <Input
                        id="headerImageFile"
                        name="headerImageFile"
                        type="file"
                        accept="image/*,video/*,audio/*,application/pdf"
                        className="file:text-primary file:font-medium"
                    />
                    <p className="text-xs text-muted-foreground">
                        Upload a new media file to override the template's default header for this broadcast only.
                    </p>
                    </div>
                </>
            )}

            </CardContent>
            <CardFooter className="flex justify-end">
            <SubmitButton />
            </CardFooter>
        </form>
        </Card>
        {jsonPayload && (
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Sample API Request Body</CardTitle>
                    <CardDescription>This is an example of the JSON that will be sent to the Meta API for each contact.</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="p-4 bg-muted/50 rounded-md whitespace-pre-wrap font-code text-sm overflow-x-auto">
                        <code>{jsonPayload}</code>
                    </pre>
                </CardContent>
            </Card>
        )}
    </>
  );
}
