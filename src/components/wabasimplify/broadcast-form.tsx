
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

export function BroadcastForm({ templates, project }: { templates: WithId<Template>[]; project: Pick<WithId<Project>, '_id' | 'phoneNumbers'> | null }) {
  const [state, formAction] = useActionState(handleStartBroadcast, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<WithId<Template> | null>(null);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [headerImageUrl, setHeaderImageUrl] = useState('');

  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      // Instead of resetting the whole form, just reset the file input and header image url
      setFileInputKey(Date.now());
      setHeaderImageUrl('');
    }
    if (state?.error) {
      toast({
        title: 'Broadcast Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);


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

  const showImageUpload = selectedTemplate?.components?.some(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));

  const approvedTemplates = templates.filter(t => t.status?.toUpperCase() === 'APPROVED');

  return (
    <Card>
      <form ref={formRef} action={formAction}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <CardHeader>
          <CardTitle>New Broadcast Campaign</CardTitle>
          <CardDescription>Select a phone number, an approved template, and upload your contacts file.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
              <Label htmlFor="phoneNumberId">1. Select Phone Number</Label>
              <Select name="phoneNumberId" required value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
              <SelectTrigger id="phoneNumberId">
                  <SelectValue placeholder="Choose a number..." />
              </SelectTrigger>
              <SelectContent>
                  {(project?.phoneNumbers || []).map((phone) => (
                  <SelectItem key={phone.id} value={phone.id}>
                      {phone.display_phone_number}
                  </SelectItem>
                  ))}
              </SelectContent>
              </Select>
          </div>
          <div className="space-y-2">
              <Label htmlFor="templateId">2. Select Message Template</Label>
              <Select name="templateId" required value={selectedTemplate?._id.toString() || ''} onValueChange={handleTemplateChange}>
              <SelectTrigger id="templateId">
                  <SelectValue placeholder="Choose an approved template..." />
              </SelectTrigger>
              <SelectContent searchable>
                {approvedTemplates.length > 0 ? (
                  approvedTemplates.map((template) => (
                    <SelectItem key={template._id.toString()} value={template._id.toString()}>
                      {template.name} (<span className="capitalize">{template.status ? template.status.replace(/_/g, " ").toLowerCase() : 'N/A'}</span>)
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No approved templates found. <br/> Please sync with Meta or create a new one.
                  </div>
                )}
              </SelectContent>
              </Select>
          </div>
          <div className="space-y-2">
              <Label htmlFor="csvFile">3. Upload Contacts</Label>
              <Input
              key={fileInputKey}
              id="csvFile"
              name="csvFile"
              type="file"
              accept=".csv,.xlsx"
              required
              className="file:text-primary file:font-medium"
              />
              <p className="text-xs text-muted-foreground">
                For variables like {'{{1}}'}, use 'variable1'. For dynamic URL buttons, use a column named 'button_url_param_0'.
              </p>
          </div>

          {showImageUpload && (
              <>
                  <div className="md:col-span-3">
                      <Separator className="my-2" />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                      <Label htmlFor="headerImageUrl">4. Header Media URL (Required)</Label>
                      <Input
                          id="headerImageUrl"
                          name="headerImageUrl"
                          type="url"
                          placeholder="https://example.com/image.png"
                          value={headerImageUrl}
                          onChange={(e) => setHeaderImageUrl(e.target.value)}
                          required
                      />
                      <p className="text-xs text-muted-foreground">
                          A public media URL is required to send a broadcast with this template.
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
  );
}
