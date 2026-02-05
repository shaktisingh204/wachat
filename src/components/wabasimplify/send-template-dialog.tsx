'use client';

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
  const [mediaSource, setMediaSource] = useState<'url' | 'file'>('url');

  const hasMediaHeader = template.components?.some(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));

  const bodyVariables: number[] = (template.components?.find(c => c.type === 'BODY')?.text || template.body || '').match(/{{\s*(\d+)\s*}}/g)?.map((v: string) => parseInt(v.replace(/{{\s*|\s*}}/g, ''))) || [];
  const uniqueBodyVars: number[] = Array.from(new Set(bodyVariables)).sort((a: number, b: number) => a - b);

  const defaultUrl = template.headerSampleUrl && !template.headerSampleUrl.includes('graph.facebook.com') ? template.headerSampleUrl : '';

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
      setMediaSource('url');
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

      if (hasMediaHeader) {
        data.mediaSource = mediaSource;
        if (data.mediaSource === 'url') {
          data.headerMediaUrl = formData.get('headerMediaUrl');
        } else {
          const file = formData.get('headerMediaFile') as File;
          if (file && file.size > 0) {
            const base64String = await fileToBase64(file);
            data.headerMediaFile = {
              content: base64String.split(',')[1],
              name: file.name,
              type: file.type,
            };
          }
        }
      }

      uniqueBodyVars.forEach(varNum => {
        data[`variable_body_${varNum}`] = formData.get(`variable_body_${varNum}`);
      });

      try {
        const result = await handleSendTemplateMessage(null, data);
        setState(result);
      } catch (error: any) {
        toast({ title: 'Error', description: error.message || 'Failed to send template', variant: 'destructive' });
      }
    });
  };

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
            <div className="space-y-4">
              {hasMediaHeader && (
                <div className="space-y-3 p-3 border rounded-md">
                  <Label>Header Media</Label>
                  <RadioGroup name="mediaSource" value={mediaSource} onValueChange={(v) => setMediaSource(v as any)} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="url" id="source-url" /><Label htmlFor="source-url" className="font-normal flex items-center gap-1"><LinkIcon className="h-4 w-4" />Use URL</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="file" id="source-file" /><Label htmlFor="source-file" className="font-normal flex items-center gap-1"><UploadCloud className="h-4 w-4" />Upload File</Label></div>
                  </RadioGroup>
                  {mediaSource === 'url' ? (
                    <Input
                      id="headerMediaUrl"
                      name="headerMediaUrl"
                      type="url"
                      placeholder="https://example.com/image.png"
                      defaultValue={defaultUrl}
                      required
                    />
                  ) : (
                    <Input
                      id="headerMediaFile"
                      name="headerMediaFile"
                      type="file"
                      accept="image/*,video/*,application/pdf"
                      required
                    />
                  )}
                </div>
              )}

              {uniqueBodyVars.length > 0 && uniqueBodyVars.map((varNum: number) => (
                <div key={varNum} className="space-y-2">
                  <Label htmlFor={`variable_body_${varNum}`}>Variable {'{{'}{varNum}{'}}'}</Label>
                  <Input
                    id={`variable_body_${varNum}`}
                    name={`variable_body_${varNum}`}
                    placeholder={`Enter value for variable ${varNum}`}
                    required
                  />
                </div>
              ))}
            </div>
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
