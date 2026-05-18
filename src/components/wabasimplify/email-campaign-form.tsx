
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
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
import { LoaderCircle, FileUp, Send, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, CrmEmailTemplate, EmailCampaign } from '@/lib/definitions';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { handleSendBulkEmail } from '@/app/actions/email.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../ui/card';
import { ZoruSeparator } from '../ui/separator';
import { Switch } from '../ui/switch';

const initialState = { message: null, error: null };

function SubmitButton({ isScheduled }: { isScheduled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isScheduled ? 'Schedule Campaign' : 'Send Campaign'}
    </ZoruButton>
  );
}

interface EmailCampaignFormProps {
    templates: WithId<CrmEmailTemplate>[];
    onSuccess: () => void;
}

export function EmailCampaignForm({ templates, onSuccess }: EmailCampaignFormProps) {
  const [state, formAction] = useActionState(handleSendBulkEmail as any, initialState as any);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [isScheduled, setIsScheduled] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setSubject('');
      setBody('');
      setFile(null);
      setScheduledAt(undefined);
      setIsScheduled(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  const handleTemplateSelect = (templateId: string) => {
    const selectedTemplate = templates.find(t => t._id.toString() === templateId);
    if (selectedTemplate) {
        setSubject(selectedTemplate.subject);
        setBody(selectedTemplate.body);
    }
  };

  return (
    <form action={formAction} ref={formRef}>
        <input type="hidden" name="scheduledAt" value={isScheduled && scheduledAt ? scheduledAt.toISOString() : ''} />
        <Card className="flex-1">
            <CardHeader>
                <CardTitle>New Email Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="template">Use Template (Optional)</ZoruLabel>
                    <ZoruSelect onValueChange={handleTemplateSelect}>
                        <ZoruSelectTrigger id="template"><ZoruSelectValue placeholder="ZoruSelect a template..." /></ZoruSelectTrigger>
                        <ZoruSelectContent>{templates.map(t => <ZoruSelectItem key={t._id.toString()} value={t._id.toString()}>{t.name}</ZoruSelectItem>)}</ZoruSelectContent>
                    </ZoruSelect>
                </div>
                 <div className="space-y-2">
                    <ZoruLabel htmlFor="fromName">From Name</ZoruLabel>
                    <ZoruInput id="fromName" name="fromName" required />
                </div>
                 <div className="space-y-2">
                    <ZoruLabel htmlFor="fromEmail">From Email</ZoruLabel>
                    <ZoruInput id="fromEmail" name="fromEmail" type="email" required />
                </div>
                 <div className="space-y-2">
                    <ZoruLabel htmlFor="subject">Subject</ZoruLabel>
                    <ZoruInput id="subject" name="subject" value={subject} onChange={e => setSubject(e.target.value)} required />
                </div>
                 <div className="space-y-2">
                    <ZoruLabel htmlFor="body">Message Body (HTML)</ZoruLabel>
                    <ZoruTextarea id="body" name="body" value={body} onChange={e => setBody(e.target.value)} className="min-h-48 font-mono" required />
                </div>
                <ZoruSeparator />
                <div className="space-y-2">
                    <ZoruLabel htmlFor="contactFile">Contact File (CSV/XLSX)</ZoruLabel>
                    <ZoruInput id="contactFile" name="contactFile" type="file" accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required onChange={e => setFile(e.target.files?.[0] || null)} />
                    <p className="text-xs text-muted-foreground">First column must be 'email'. Other columns can be used as variables, e.g., {'{{name}}'}.</p>
                </div>
                <ZoruSeparator />
                 <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <Switch id="schedule-switch" checked={isScheduled} onCheckedChange={setIsScheduled} />
                        <ZoruLabel htmlFor="schedule-switch">Schedule for later</ZoruLabel>
                    </div>
                    {isScheduled && (
                        <div className="pt-2">
                            <DatePicker date={scheduledAt} setDate={setScheduledAt} />
                        </div>
                    )}
                 </div>
            </CardContent>
            <CardFooter>
                <SubmitButton isScheduled={isScheduled} />
            </CardFooter>
        </Card>
    </form>
  );
}
