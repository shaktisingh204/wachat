

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmEmailTemplates } from '@/app/actions/crm-email-templates.actions';
import { sendCrmEmail } from '@/app/actions/crm-email.actions';
import type { WithId, CrmEmailTemplate } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const initialState = { success: false, message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Send Email
    </Button>
  );
}

interface ComposeEmailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTo?: string;
  initialSubject?: string;
}

export function ComposeEmailDialog({ isOpen, onOpenChange, initialTo = '', initialSubject = '' }: ComposeEmailDialogProps) {
  const [state, formAction] = useActionState(sendCrmEmail, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [templates, setTemplates] = useState<WithId<CrmEmailTemplate>[]>([]);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (isOpen) {
        getCrmEmailTemplates().then(setTemplates);
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form action={formAction} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="template">Use Template (Optional)</Label>
                <Select onValueChange={handleTemplateSelect}>
                    <SelectTrigger id="template">
                        <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                        {templates.map(template => (
                            <SelectItem key={template._id.toString()} value={template._id.toString()}>
                                {template.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="email" placeholder="recipient@example.com" defaultValue={initialTo} key={initialTo} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" placeholder="Your subject line" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" name="body" className="min-h-[250px]" placeholder="Write your email here..." value={body} onChange={(e) => setBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">You can use variables like {'{{contact.name}}'} or {'{{account.name}}'}.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
