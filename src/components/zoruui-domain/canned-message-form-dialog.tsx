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
} from '@/components/sabcrm/20ui/compat';
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <ZoruDialogContent className="max-w-[540px] border border-[var(--st-border)] bg-[var(--st-bg)] p-0 shadow-lg">
        <form action={action} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          {existingMessage && (
            <input
              type="hidden"
              name="_id"
              value={existingMessage._id.toString()}
            />
          )}

          <ZoruDialogHeader className="flex flex-row items-start gap-3 border-b border-[var(--st-border)] px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <Bookmark className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <ZoruDialogTitle className="text-[16px] font-semibold text-[var(--st-text)] leading-tight">
                {existingMessage ? 'Edit canned message' : 'Create canned message'}
              </ZoruDialogTitle>
              <ZoruDialogDescription className="mt-0.5 text-[12px] text-[var(--st-text-secondary)] leading-snug">
                Save a message for quick use in live chat conversations.
              </ZoruDialogDescription>
            </div>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="name"
                className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
              >
                Name <span className="ml-1 text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Welcome Message"
                defaultValue={existingMessage?.name}
                required
              />
              <p className="text-[11px] text-[var(--st-text-secondary)]">
                A unique name to identify this message.
              </p>
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="type"
                className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
              >
                Type <span className="ml-1 text-[var(--st-danger)]">*</span>
              </Label>
              <Select
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
              </Select>
            </div>

            {/* Type-conditional fields */}
            {messageType === 'text' ? (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="text"
                  className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
                >
                  Content <span className="ml-1 text-[var(--st-danger)]">*</span>
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
                    className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
                  >
                    Media URL <span className="ml-1 text-[var(--st-danger)]">*</span>
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
                    className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
                  >
                    Caption{' '}
                    <span className="ml-1 text-[var(--st-text-secondary)]/70 font-normal">
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
                      className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
                    >
                      File name{' '}
                      <span className="ml-1 text-[var(--st-text-secondary)]/70 font-normal">
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
            <div className="flex items-center justify-between rounded-[12px] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3">
              <div>
                <Label
                  htmlFor="isFavourite"
                  className="text-[13px] font-medium text-[var(--st-text)]"
                >
                  Mark as favourite
                </Label>
                <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
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

          <ZoruDialogFooter className="border-t border-[var(--st-border)] px-6 py-4 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={isPending}>
              {isPending ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {isPending ? 'Saving…' : 'Save message'}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
