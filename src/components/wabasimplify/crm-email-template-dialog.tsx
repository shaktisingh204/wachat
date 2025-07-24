
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

const initialState = { message: null, error: undefined };

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
            <DialogContent className="sm:max-w-3xl">
                <form action={formAction} ref={formRef}>
                    {isEditing && <input type="hidden" name="templateId" value={template._id.toString()} />}
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit' : 'Create'} Email Template</DialogTitle>
                        <DialogDescription>
                            Design a reusable email template. Use variables like {'{{contact.name}}'} for personalization.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[70vh]">
                       <ScrollArea className="h-full">
                           <div className="space-y-4 pr-6">
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
                                    <Textarea id="body" name="body" defaultValue={template?.body} required className="min-h-[300px] font-mono"/>
                                </div>
                           </div>
                       </ScrollArea>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
