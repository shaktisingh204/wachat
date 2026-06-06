'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, CrmEmailTemplate } from '@/lib/definitions';
import { saveCrmEmailTemplate } from '@/app/actions/crm-email-templates.actions';
import { ScrollArea } from '../ui/scroll-area';

const initialState = { message: undefined, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
            {isEditing ? 'Save Changes' : 'Create Template'}
        </Button>
    )
}

interface CrmEmailTemplateDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    template?: WithId<CrmEmailTemplate> | null;
    onSuccess: () => void;
}

export function CrmEmailTemplateDialog({ isOpen, onOpenChange, template, onSuccess }: CrmEmailTemplateDialogProps) {
    const [state, formAction] = useActionState(saveCrmEmailTemplate, initialState);
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
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    {isEditing && <input type="hidden" name="templateId" value={template._id.toString()} />}
                    <ZoruDialogHeader className="px-6 pt-6 pb-2">
                        <ZoruDialogTitle className="text-zoru-ink">{isEditing ? 'Edit' : 'Create'} Email Template</ZoruDialogTitle>
                        <ZoruDialogDescription className="text-zoru-ink-muted">
                            Design a reusable email template. Use variables like {'{{contact.name}}'} for personalization.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-zoru-ink">Template Name</Label>
                                <Input id="name" name="name" defaultValue={template?.name} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="subject" className="text-zoru-ink">Subject</Label>
                                <Input id="subject" name="subject" defaultValue={template?.subject} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="body" className="text-zoru-ink">Body (HTML)</Label>
                                <Textarea id="body" name="body" defaultValue={template?.body} required className="min-h-[300px] font-mono" />
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter className="px-6 pb-6 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
