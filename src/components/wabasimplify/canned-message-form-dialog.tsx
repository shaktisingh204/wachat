'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import type { WithId } from 'mongodb';
import { Bookmark,
  Loader,
  Save } from 'lucide-react';

import { saveCannedMessageAction } from '@/app/actions/project.actions';
import type { CannedMessage } from '@/lib/definitions';

/**
 * CannedMessageFormDialog — ZoruUI create/edit canned message.
 */

import * as React from 'react';

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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={isOpen} onOpenChange={setIsOpen}>
      <ZoruDialogContent className="max-w-[540px] border border-zoru-line bg-zoru-bg p-0 shadow-lg">
        <form action={action} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          {existingMessage && (
            <input
              type="hidden"
              name="_id"
              value={existingMessage._id.toString()}
            />
          )}

          <ZoruDialogHeader className="flex flex-row items-start gap-3 border-b border-zoru-line px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-zoru-surface-2 text-zoru-ink">
              <Bookmark className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <ZoruDialogTitle className="text-[16px] font-semibold text-zoru-ink leading-tight">
                {existingMessage ? 'Edit canned message' : 'Create canned message'}
              </ZoruDialogTitle>
              <ZoruDialogDescription className="mt-0.5 text-[12px] text-zoru-ink-muted leading-snug">
                Save a message for quick use in live chat conversations.
              </ZoruDialogDescription>
            </div>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel
                htmlFor="name"
                className="text-[11.5px] font-semibold text-zoru-ink-muted"
              >
                Name <span className="ml-1 text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                placeholder="e.g., Welcome Message"
                defaultValue={existingMessage?.name}
                required
              />
              <p className="text-[11px] text-zoru-ink-muted">
                A unique name to identify this message.
              </p>
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel
                htmlFor="type"
                className="text-[11.5px] font-semibold text-zoru-ink-muted"
              >
                Type <span className="ml-1 text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruSelect
                name="type"
                value={messageType}
                onValueChange={(val) =>
                  setMessageType(val as CannedMessage['type'])
                }
                required
              >
                <ZoruSelectTrigger id="type">
                  <ZoruSelectValue placeholder="Select message type" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="text">Text</ZoruSelectItem>
                  <ZoruSelectItem value="image">Image</ZoruSelectItem>
                  <ZoruSelectItem value="video">Video</ZoruSelectItem>
                  <ZoruSelectItem value="audio">Audio</ZoruSelectItem>
                  <ZoruSelectItem value="document">Document</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {/* Type-conditional fields */}
            {messageType === 'text' ? (
              <div className="flex flex-col gap-1.5">
                <ZoruLabel
                  htmlFor="text"
                  className="text-[11.5px] font-semibold text-zoru-ink-muted"
                >
                  Content <span className="ml-1 text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruTextarea
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
                  <ZoruLabel
                    htmlFor="mediaUrl"
                    className="text-[11.5px] font-semibold text-zoru-ink-muted"
                  >
                    Media URL <span className="ml-1 text-zoru-danger-ink">*</span>
                  </ZoruLabel>
                  <ZoruInput
                    id="mediaUrl"
                    name="mediaUrl"
                    placeholder="https://example.com/image.png"
                    defaultValue={existingMessage?.content.mediaUrl}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel
                    htmlFor="caption"
                    className="text-[11.5px] font-semibold text-zoru-ink-muted"
                  >
                    Caption{' '}
                    <span className="ml-1 text-zoru-ink-muted/70 font-normal">
                      (optional)
                    </span>
                  </ZoruLabel>
                  <ZoruTextarea
                    id="caption"
                    name="caption"
                    placeholder="A caption for your media…"
                    defaultValue={existingMessage?.content.caption}
                  />
                </div>
                {messageType === 'document' && (
                  <div className="flex flex-col gap-1.5">
                    <ZoruLabel
                      htmlFor="fileName"
                      className="text-[11.5px] font-semibold text-zoru-ink-muted"
                    >
                      File name{' '}
                      <span className="ml-1 text-zoru-ink-muted/70 font-normal">
                        (optional)
                      </span>
                    </ZoruLabel>
                    <ZoruInput
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
            <div className="flex items-center justify-between rounded-[12px] border border-zoru-line bg-zoru-surface-2 px-4 py-3">
              <div>
                <ZoruLabel
                  htmlFor="isFavourite"
                  className="text-[13px] font-medium text-zoru-ink"
                >
                  Mark as favourite
                </ZoruLabel>
                <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
                  Pins this message to the top of the canned list.
                </div>
              </div>
              <ZoruSwitch
                id="isFavourite"
                name="isFavourite"
                defaultChecked={existingMessage?.isFavourite}
              />
            </div>
          </div>

          <ZoruDialogFooter className="border-t border-zoru-line px-6 py-4 sm:justify-end gap-2">
            <ZoruButton
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" size="md" disabled={isPending}>
              {isPending ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {isPending ? 'Saving…' : 'Save message'}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
