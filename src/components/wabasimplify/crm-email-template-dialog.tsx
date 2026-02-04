
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
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, CrmEmailTemplate } from '@/lib/definitions';
import { saveCrmEmailTemplate } from '@/app/actions/crm-email-templates.actions';
import { ScrollArea } from '../ui/scroll-area';

const initialState = { message: undefined, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
            <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    {isEditing && <input type="hidden" name="templateId" value={template._id.toString()} />}
                    <DialogHeader className="px-6 pt-6 pb-2">
                        <DialogTitle>{isEditing ? 'Edit' : 'Create'} Email Template</DialogTitle>
                        <DialogDescription>
                            Design a reusable email template. Use variables like {'{{contact.name}}'} for personalization.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Template Name</Label>
                                <Input id="name" name="name" defaultValue={template?.name} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="subject">Subject</Label>
                                <Input id="subject" name="subject" defaultValue={template?.subject} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="body">Body (HTML)</Label>
                                <Textarea id="body" name="body" defaultValue={template?.body} required className="min-h-[300px] font-mono" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="px-6 pb-6 pt-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
