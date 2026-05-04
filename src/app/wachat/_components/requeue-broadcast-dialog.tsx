'use client';

/**
 * RequeueBroadcastDialog (wachat-local, ZoruUI)
 *
 * Confirmation + composer for re-sending a previously-completed broadcast,
 * either to ALL original contacts or only the FAILED ones. Visual layer is
 * pure Zoru — neutral palette, bold-by-default. Server action call
 * (handleRequeueBroadcast) and form-state behavior preserved 1:1.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, RotateCw } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleRequeueBroadcast } from '@/app/actions/broadcast.actions';
import type { Project, Template } from '@/lib/definitions';

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
  useZoruToast,
} from '@/components/zoruui';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCw className="h-3.5 w-3.5" />
      )}
      {pending ? 'Requeueing…' : 'Requeue broadcast'}
    </ZoruButton>
  );
}

interface RequeueBroadcastDialogProps {
  broadcastId: string;
  originalTemplateId: string;
  project: Pick<WithId<Project>, '_id' | 'phoneNumbers'> | null;
  templates: WithId<Template>[];
}

export function RequeueBroadcastDialog({
  broadcastId,
  originalTemplateId,
  project: _project,
  templates,
}: RequeueBroadcastDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    handleRequeueBroadcast as any,
    initialState as any,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>(originalTemplateId);
  const [requeueScope, setRequeueScope] = useState<'ALL' | 'FAILED'>('ALL');

  const selectedTemplate = templates.find(
    (t) => t._id.toString() === selectedTemplateId,
  );
  const showImageUpload = selectedTemplate?.components?.some(
    (c: any) =>
      c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format),
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success', description: state.message });
      setOpen(false);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      formRef.current?.reset();
      setSelectedTemplateId(originalTemplateId);
      setRequeueScope('ALL');
    }
    setOpen(isOpen);
  };

  const approvedTemplates = templates.filter(
    (t) => t.status?.toUpperCase() === 'APPROVED',
  );

  return (
    <ZoruDialog open={open} onOpenChange={handleOpenChange}>
      <ZoruDialogTrigger asChild>
        <ZoruButton
          variant="ghost"
          size="icon-sm"
          aria-label="Requeue broadcast"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="max-w-[540px] p-0">
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="broadcastId" value={broadcastId} />
          <input type="hidden" name="templateId" value={selectedTemplateId} />
          <input type="hidden" name="requeueScope" value={requeueScope} />

          <ZoruDialogHeader className="flex flex-row items-start gap-3 border-b border-zoru-line px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
              <RotateCw className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <ZoruDialogTitle className="text-[16px] text-zoru-ink leading-tight">
                Requeue broadcast
              </ZoruDialogTitle>
              <ZoruDialogDescription className="mt-0.5 text-[12px] text-zoru-ink-muted leading-snug">
                Send this campaign again to the same audience — all contacts
                or only the ones that failed the first time.
              </ZoruDialogDescription>
            </div>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Template select */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                Message template{' '}
                <span className="ml-1 text-zoru-danger">*</span>
              </ZoruLabel>
              <ZoruSelect
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Choose an approved template…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {approvedTemplates.length > 0 ? (
                    approvedTemplates.map((template) => (
                      <ZoruSelectItem
                        key={template._id.toString()}
                        value={template._id.toString()}
                      >
                        {template.name}
                        <span className="ml-2 text-[11px] capitalize text-zoru-ink-muted">
                          {template.status
                            ? template.status.replace(/_/g, ' ').toLowerCase()
                            : 'n/a'}
                        </span>
                      </ZoruSelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-center text-[12px] text-zoru-ink-muted">
                      No approved templates found.
                    </div>
                  )}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {/* Header media (optional) */}
            {showImageUpload ? (
              <div className="flex flex-col gap-1.5">
                <ZoruLabel
                  htmlFor="headerImageUrl"
                  className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted"
                >
                  Header media URL
                  <span className="ml-1 text-zoru-ink-subtle">(optional)</span>
                </ZoruLabel>
                <ZoruInput
                  id="headerImageUrl"
                  name="headerImageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                />
                <div className="text-[11px] text-zoru-ink-muted">
                  Provide a new public media URL to override the
                  template&apos;s header image.
                </div>
              </div>
            ) : null}

            {/* Scope radio group */}
            <div className="flex flex-col gap-2">
              <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                Target contacts
              </ZoruLabel>
              <ZoruRadioGroup
                value={requeueScope}
                onValueChange={(v) =>
                  setRequeueScope(v as 'ALL' | 'FAILED')
                }
                className="flex flex-col gap-2"
              >
                <ScopeOption
                  id="scope-all"
                  value="ALL"
                  active={requeueScope === 'ALL'}
                  title="All original contacts"
                  description="Resend to every contact in the original audience."
                />
                <ScopeOption
                  id="scope-failed"
                  value="FAILED"
                  active={requeueScope === 'FAILED'}
                  title="Only failed contacts"
                  description="Retry delivery only to the ones that failed last time."
                />
              </ZoruRadioGroup>
            </div>
          </div>

          <ZoruDialogFooter className="border-t border-zoru-line px-6 py-4 sm:justify-end gap-2">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

/* ── local helper ───────────────────────────────────────────────── */

function ScopeOption({
  id,
  value,
  active,
  title,
  description,
}: {
  id: string;
  value: 'ALL' | 'FAILED';
  active: boolean;
  title: string;
  description: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-[var(--zoru-radius)] border px-3 py-2.5 transition-colors',
        active
          ? 'border-zoru-ink bg-zoru-surface-2'
          : 'border-zoru-line bg-zoru-bg hover:bg-zoru-surface',
      )}
    >
      <ZoruRadioGroupItem value={value} id={id} />
      <div className="flex flex-col">
        <span className="text-[13px] text-zoru-ink">{title}</span>
        <span className="text-[11px] text-zoru-ink-muted">{description}</span>
      </div>
    </label>
  );
}
