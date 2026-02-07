
import { TemplateInputRenderer } from './template-input-renderer';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
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
import { LoaderCircle, Send, UploadCloud, Link as LinkIcon } from 'lucide-react';
import { handleSendTemplateMessage } from '@/app/actions/send-template.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Contact, Template } from '@/lib/definitions';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

const initialState: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};


export function SendTemplateDialog({ isOpen, onOpenChange, contact, template }: SendTemplateDialogProps) {
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);


  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message });
      onOpenChange(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange]);

  useEffect(() => {
    if (!isOpen) {
      formRef.current?.reset();
      setState(initialState);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      const data: { [key: string]: any } = {
        contactId: contact._id.toString(),
        templateId: template._id.toString(),
      };

      // Extract all form data into the data object
      const filePromises: Promise<void>[] = [];

      for (const [key, value] of formData.entries()) {
        if (value instanceof File && value.size > 0) {
          filePromises.push(
            fileToBase64(value).then(base64 => {
              data[key] = {
                content: base64.split(',')[1],
                name: value.name,
                type: value.type
              };
            })
          );
        } else {
          data[key] = value;
        }
      }

      await Promise.all(filePromises);

      try {
        const result = await handleSendTemplateMessage(null, data);
        setState(result);
      } catch (error: any) {
        toast({ title: 'Error', description: error.message || 'Failed to send template', variant: 'destructive' });
      }
    });
  };

  const variableOptions = [
    'name',
    'phone',
    ...Object.keys(contact.variables || {})
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form ref={formRef} onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Send Template: {template.name}</DialogTitle>
            <DialogDescription>
              Fill in the required information to send this template to {contact.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <TemplateInputRenderer template={template} variableOptions={variableOptions} />
          </div>

          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
