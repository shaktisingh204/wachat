'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, CrmEmailTemplate } from '@/lib/definitions';
import { saveEmailTemplate } from '@/app/actions/email.actions';
import { ScrollArea } from '../ui/scroll-area';

const initialState = { message: null, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Template'}
        </ZoruButton>
    )
}

interface EmailTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  template?: WithId<CrmEmailTemplate> | null;
  onSuccess: () => void;
}

export function EmailTemplateDialog({ isOpen, onOpenChange, template, onSuccess }: EmailTemplateDialogProps) {
    const [state, formAction] = useActionState(saveEmailTemplate as any, initialState as any);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const isEditing = !!template;

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onSuccess();
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error Saving Template', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange, onSuccess]);
    
    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-3xl">
                <form action={formAction} ref={formRef}>
                    {isEditing && <input type="hidden" name="templateId" value={template._id.toString()} />}
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>{isEditing ? 'Edit' : 'Create'} Email Template</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Design a reusable email template. Use variables like {'{{contact.name}}'} for personalization.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid gap-4 py-4 max-h-[70vh]">
                       <ScrollArea className="h-full">
                           <div className="space-y-4 pr-6">
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="name">Template Name</ZoruLabel>
                                    <ZoruInput id="name" name="name" defaultValue={template?.name} required />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="subject">Subject</ZoruLabel>
                                    <ZoruInput id="subject" name="subject" defaultValue={template?.subject} required />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="body">Body (HTML)</ZoruLabel>
                                    <ZoruTextarea id="body" name="body" defaultValue={template?.body} required className="min-h-[300px] font-mono"/>
                                </div>
                           </div>
                       </ScrollArea>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
