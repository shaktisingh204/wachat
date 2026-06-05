import { Modal, Button } from '@/components/sabcrm/20ui';
import {
  TemplateInputRenderer } from '../template-input-renderer';
import { useEffect,
  useRef,
  useState,
  useTransition } from 'react';

import { Send } from 'lucide-react';
import { handleSendTemplateMessage } from '@/app/actions/send-template.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Contact, Template } from '@/lib/definitions';

const initialState: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
};

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
    <Modal
      open={isOpen}
      onClose={() => onOpenChange(false)}
      title={`Send Template: ${template.name}`}
      description={`Fill in the required information to send this template to ${contact.name}.`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="submit"
            form="send-template-form"
            variant="primary"
            iconLeft={Send}
            loading={isPending}
          >
            Send Template
          </Button>
        </>
      }
    >
      <form id="send-template-form" ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
        <TemplateInputRenderer template={template} variableOptions={variableOptions} />
      </form>
    </Modal>
  );
}
