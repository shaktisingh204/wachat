'use client';

import { useActionState, useEffect, useRef, useMemo } from 'react';
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
import { LoaderCircle, Send } from 'lucide-react';
import { handleSendTemplateMessage } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Contact, Template } from '@/lib/definitions';
import { ScrollArea } from '../ui/scroll-area';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Send Template
    </Button>
  );
}

interface SendTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contact: WithId<Contact>;
  template: WithId<Template>;
}

export function SendTemplateDialog({ isOpen, onOpenChange, contact, template }: SendTemplateDialogProps) {
  const [state, formAction] = useActionState(handleSendTemplateMessage, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const hasMediaHeader = useMemo(() => 
    template.components?.some(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format)), 
    [template.components]
  );
  
  const bodyVariables = useMemo(() => {
    const bodyText = template.components?.find(c => c.type === 'BODY')?.text || template.body || '';
    const matches = bodyText.match(/{{\s*(\d+)\s*}}/g) || [];
    const uniqueVars = [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))];
    return uniqueVars.sort((a, b) => a - b);
  }, [template.components, template.body]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message });
      onOpenChange(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="contactId" value={contact._id.toString()} />
          <input type="hidden" name="templateId" value={template._id.toString()} />
          
          <DialogHeader>
            <DialogTitle>Send Template: {template.name}</DialogTitle>
            <DialogDescription>
              Fill in the required information to send this template to {contact.name}.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] -mx-6 my-4 px-6">
            <div className="space-y-4">
              {hasMediaHeader && (
                <div className="space-y-2">
                  <Label htmlFor="headerMediaUrl">Header Media URL</Label>
                  <Input 
                    id="headerMediaUrl" 
                    name="headerMediaUrl" 
                    type="url" 
                    placeholder="https://example.com/image.png"
                    required 
                  />
                  <p className="text-xs text-muted-foreground">
                    A public URL to the media is required for this template.
                  </p>
                </div>
              )}

              {bodyVariables.length > 0 && bodyVariables.map(varNum => (
                <div key={varNum} className="space-y-2">
                  <Label htmlFor={`variable_${varNum}`}>Variable {'{{'}{varNum}{'}}'}</Label>
                  <Input 
                    id={`variable_${varNum}`}
                    name={`variable_${varNum}`}
                    placeholder={`Enter value for variable ${varNum}`}
                    required 
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}