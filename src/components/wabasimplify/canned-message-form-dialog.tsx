'use client';

/**
 * CannedMessageFormDialog — Clay-styled create/edit canned message.
 */

import * as React from 'react';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { LuBookmark, LuLoader, LuSave } from 'react-icons/lu';

import { saveCannedMessageAction } from '@/app/actions/project.actions';
import type { CannedMessage } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';

import { ClayButton } from '@/components/clay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const initialState = {
  message: null,
  error: null,
};

interface CannedMessageFormDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectId: string;
  existingMessage: WithId<CannedMessage> | null;
  onSubmitted: () => void;
}

export function CannedMessageFormDialog({
  isOpen,
  setIsOpen,
  projectId,
  existingMessage,
  onSubmitted,
}: CannedMessageFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [messageType, setMessageType] = useState<CannedMessage['type'] | ''>(
    existingMessage?.type || 'text',
  );

  const action = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveCannedMessageAction(null, formData);
      setState(result);
    });
  };

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success', description: state.message });
      onSubmitted();
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, onSubmitted]);

  useEffect(() => {
    if (isOpen) {
      setMessageType(existingMessage?.type || 'text');
    } else {
      formRef.current?.reset();
    }
  }, [isOpen, existingMessage]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-[540px] rounded-[18px] border border-clay-border bg-clay-surface p-0 shadow-clay-pop">
        <form action={action} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          {existingMessage && (
            <input
              type="hidden"
              name="_id"
              value={existingMessage._id.toString()}
            />
          )}

          <DialogHeader className="flex flex-row items-start gap-3 border-b border-clay-border px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-clay-rose-soft text-clay-rose-ink">
              <LuBookmark className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[16px] font-semibold text-clay-ink leading-tight">
                {existingMessage ? 'Edit canned message' : 'Create canned message'}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12px] text-clay-ink-muted leading-snug">
                Save a message for quick use in live chat conversations.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="name"
                className="text-[11.5px] font-semibold text-clay-ink-muted"
              >
                Name <span className="ml-1 text-clay-red">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Welcome Message"
                defaultValue={existingMessage?.name}
                required
              />
              <p className="text-[11px] text-clay-ink-soft">
                A unique name to identify this message.
              </p>
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="type"
                className="text-[11.5px] font-semibold text-clay-ink-muted"
              >
                Type <span className="ml-1 text-clay-red">*</span>
              </Label>
              <Select
                name="type"
                value={messageType}
                onValueChange={(val) =>
                  setMessageType(val as CannedMessage['type'])
                }
                required
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select message type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type-conditional fields */}
            {messageType === 'text' ? (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="text"
                  className="text-[11.5px] font-semibold text-clay-ink-muted"
                >
                  Content <span className="ml-1 text-clay-red">*</span>
                </Label>
                <Textarea
                  id="text"
                  name="text"
                  placeholder="Enter your message…"
                  className="min-h-32"
                  defaultValue={existingMessage?.content.text}
                  required
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="mediaUrl"
                    className="text-[11.5px] font-semibold text-clay-ink-muted"
                  >
                    Media URL <span className="ml-1 text-clay-red">*</span>
                  </Label>
                  <Input
                    id="mediaUrl"
                    name="mediaUrl"
                    placeholder="https://example.com/image.png"
                    defaultValue={existingMessage?.content.mediaUrl}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="caption"
                    className="text-[11.5px] font-semibold text-clay-ink-muted"
                  >
                    Caption{' '}
                    <span className="ml-1 text-clay-ink-fade font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="caption"
                    name="caption"
                    placeholder="A caption for your media…"
                    defaultValue={existingMessage?.content.caption}
                  />
                </div>
                {messageType === 'document' && (
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="fileName"
                      className="text-[11.5px] font-semibold text-clay-ink-muted"
                    >
                      File name{' '}
                      <span className="ml-1 text-clay-ink-fade font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="fileName"
                      name="fileName"
                      placeholder="e.g., product_catalog.pdf"
                      defaultValue={existingMessage?.content.fileName}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Favourite toggle */}
            <div className="flex items-center justify-between rounded-[12px] border border-clay-border bg-clay-surface-2 px-4 py-3">
              <div>
                <Label
                  htmlFor="isFavourite"
                  className="text-[13px] font-medium text-clay-ink"
                >
                  Mark as favourite
                </Label>
                <div className="mt-0.5 text-[11px] text-clay-ink-muted">
                  Pins this message to the top of the canned list.
                </div>
              </div>
              <Switch
                id="isFavourite"
                name="isFavourite"
                defaultChecked={existingMessage?.isFavourite}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-clay-border px-6 py-4 sm:justify-end gap-2">
            <ClayButton
              type="button"
              variant="pill"
              size="md"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </ClayButton>
            <ClayButton
              type="submit"
              variant="rose"
              size="md"
              disabled={isPending}
              leading={
                isPending ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuSave className="h-3.5 w-3.5" strokeWidth={2} />
                )
              }
            >
              {isPending ? 'Saving…' : 'Save message'}
            </ClayButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
