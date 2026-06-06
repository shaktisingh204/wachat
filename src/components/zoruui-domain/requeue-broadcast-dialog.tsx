'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  RadioGroup,
  ZoruRadioGroupItem,
  Button,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LuRotateCw,
  LuLoader } from 'react-icons/lu';
import type { WithId } from 'mongodb';

import { handleRequeueBroadcast } from '@/app/actions/broadcast.actions';
import { useToast } from '@/hooks/use-toast';
import type { Project,
  Template } from '@/lib/definitions';

/**
 * RequeueBroadcastDialog — Clay-styled requeue composer.
 */

import * as React from 'react';

import { cn } from '@/lib/utils';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="rose"
      size="md"
      disabled={pending}
      leading={
        pending ? (
          <LuLoader className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LuRotateCw className="h-3.5 w-3.5" strokeWidth={2} />
        )
      }
    >
      {pending ? 'Requeueing…' : 'Requeue broadcast'}
    </Button>
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
  const { toast } = useToast();
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ZoruDialogTrigger asChild>
        <button
          type="button"
          aria-label="Requeue broadcast"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] transition-colors"
        >
          <LuRotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="max-w-[540px] rounded-[18px] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0 shadow-lg">
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="broadcastId" value={broadcastId} />
          <input type="hidden" name="templateId" value={selectedTemplateId} />
          <input type="hidden" name="requeueScope" value={requeueScope} />

          <ZoruDialogHeader className="flex flex-row items-start gap-3 border-b border-[var(--st-border)] px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <LuRotateCw className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <ZoruDialogTitle className="text-[16px] font-semibold text-[var(--st-text)] leading-tight">
                Requeue broadcast
              </ZoruDialogTitle>
              <ZoruDialogDescription className="mt-0.5 text-[12px] text-[var(--st-text-secondary)] leading-snug">
                Send this campaign again to the same audience — all contacts
                or only the ones that failed the first time.
              </ZoruDialogDescription>
            </div>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Template select */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]">
                Message template <span className="ml-1 text-[var(--st-text)]">*</span>
              </Label>
              <Select
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
                        <span className="ml-2 text-[11px] capitalize text-[var(--st-text-secondary)]">
                          {template.status
                            ? template.status.replace(/_/g, ' ').toLowerCase()
                            : 'n/a'}
                        </span>
                      </ZoruSelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-center text-[12px] text-[var(--st-text-secondary)]">
                      No approved templates found.
                    </div>
                  )}
                </ZoruSelectContent>
              </Select>
            </div>

            {/* Header media (optional) */}
            {showImageUpload ? (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="headerImageUrl"
                  className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
                >
                  Header media URL
                  <span className="ml-1 text-[var(--st-text-secondary)]/70 font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="headerImageUrl"
                  name="headerImageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                />
                <div className="text-[11px] text-[var(--st-text-secondary)]">
                  Provide a new public media URL to override the template&apos;s
                  header image.
                </div>
              </div>
            ) : null}

            {/* Scope radio group */}
            <div className="flex flex-col gap-2">
              <Label className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]">
                Target contacts
              </Label>
              <RadioGroup
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
              </RadioGroup>
            </div>
          </div>

          <ZoruDialogFooter className="border-t border-[var(--st-border)] px-6 py-4 sm:justify-end gap-2">
            <Button
              type="button"
              variant="pill"
              size="md"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
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
        'flex cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 py-2.5 transition-colors',
        active
          ? 'border-primary bg-[var(--st-bg-muted)]/50'
          : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] hover:bg-[var(--st-bg-muted)]',
      )}
    >
      <ZoruRadioGroupItem value={value} id={id} />
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-[var(--st-text)]">{title}</span>
        <span className="text-[11px] text-[var(--st-text-secondary)]">{description}</span>
      </div>
    </label>
  );
}
