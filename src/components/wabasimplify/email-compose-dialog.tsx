
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getEmailTemplates } from '@/app/actions/email.actions';
import { sendCrmEmail } from '@/app/actions/crm-email.actions';
import type { WithId, CrmEmailTemplate } from '@/lib/definitions';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '../ui/select';

const initialState = { success: false, message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Send Email
    </ZoruButton>
  );
}

interface EmailComposeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTo?: string;
  initialSubject?: string;
}

export function EmailComposeDialog({ isOpen, onOpenChange, initialTo = '', initialSubject = '' }: EmailComposeDialogProps) {
  const [state, formAction] = useActionState(sendCrmEmail, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [templates, setTemplates] = useState<WithId<CrmEmailTemplate>[]>([]);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (isOpen) {
      getEmailTemplates().then(setTemplates);
      setSubject(initialSubject);
      setBody(''); // Reset body when opening
    }
  }, [isOpen, initialSubject]);


  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: state.message || '' });
      formRef.current?.reset();
      onOpenChange(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange]);

  const handleTemplateSelect = (templateId: string) => {
    const selectedTemplate = templates.find(t => t._id.toString() === templateId);
    if (selectedTemplate) {
      setSubject(selectedTemplate.subject);
      setBody(selectedTemplate.body);
    }
  };

  return (
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Compose Email</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="template">Use Template (Optional)</ZoruLabel>
                <ZoruSelect onValueChange={handleTemplateSelect}>
                  <ZoruSelectTrigger id="template">
                    <ZoruSelectValue placeholder="ZoruSelect a template..." />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {templates.map(template => (
                      <ZoruSelectItem key={template._id.toString()} value={template._id.toString()}>
                        {template.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="to">To</ZoruLabel>
                <ZoruInput id="to" name="to" type="email" placeholder="recipient@example.com" defaultValue={initialTo} key={initialTo} required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="subject">Subject</ZoruLabel>
                <ZoruInput id="subject" name="subject" placeholder="Your subject line" value={subject} onChange={(e) => setSubject(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="body">Message</ZoruLabel>
                <ZoruTextarea id="body" name="body" className="min-h-[250px]" placeholder="Write your email here..." value={body} onChange={(e) => setBody(e.target.value)} />
                <p className="text-xs text-muted-foreground">You can use variables like {'{{contact.name}}'} or {'{{account.name}}'}.</p>
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
