'use client';

/**
 * RequeueBroadcastDialog - 20ui requeue composer.
 *
 * Resend a campaign to the same audience (all contacts, or only the ones that
 * failed) with an optional template + header-media override. Pure 20ui: compound
 * Dialog, compound Select, RadioGroup, Field/Input, Button/IconButton, and a
 * SabFiles picker for the header media (no free-text URL paste).
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  IconButton,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, RotateCw } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleRequeueBroadcast } from '@/app/actions/broadcast.actions';
import { useToast } from '@/hooks/use-toast';
import type { Project, Template } from '@/lib/definitions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="danger"
      size="md"
      disabled={pending}
      iconLeft={pending ? Loader2 : RotateCw}
    >
      {pending ? 'Requeueing...' : 'Requeue broadcast'}
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
  const [headerImageUrl, setHeaderImageUrl] = useState<string>('');

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
      setHeaderImageUrl('');
    }
    setOpen(isOpen);
  };

  const approvedTemplates = templates.filter(
    (t) => t.status?.toUpperCase() === 'APPROVED',
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <IconButton label="Requeue broadcast" icon={RotateCw} variant="ghost" size="sm" />
      </DialogTrigger>
      <DialogContent className="max-w-[540px] p-0">
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="broadcastId" value={broadcastId} />
          <input type="hidden" name="templateId" value={selectedTemplateId} />
          <input type="hidden" name="requeueScope" value={requeueScope} />

          <DialogHeader className="flex flex-row items-start gap-3 border-b border-[var(--st-border)] px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <RotateCw className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[16px] font-semibold leading-tight text-[var(--st-text)]">
                Requeue broadcast
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12px] leading-snug text-[var(--st-text-secondary)]">
                Send this campaign again to the same audience, all contacts or
                only the ones that failed the first time.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Template select */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]">
                Message template{' '}
                <span className="ml-1 text-[var(--st-text)]">*</span>
              </Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger aria-label="Message template">
                  <SelectValue placeholder="Choose an approved template..." />
                </SelectTrigger>
                <SelectContent>
                  {approvedTemplates.length > 0 ? (
                    approvedTemplates.map((template) => (
                      <SelectItem
                        key={template._id.toString()}
                        value={template._id.toString()}
                      >
                        {template.name}
                        <span className="ml-2 text-[11px] capitalize text-[var(--st-text-secondary)]">
                          {template.status
                            ? template.status.replace(/_/g, ' ').toLowerCase()
                            : 'n/a'}
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-center text-[12px] text-[var(--st-text-secondary)]">
                      No approved templates found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Header media (optional) */}
            {showImageUpload ? (
              <Field
                label="Header media (optional)"
                help="Pick a new media file to override the template's header image."
              >
                <SabFileUrlInput
                  name="headerImageUrl"
                  value={headerImageUrl}
                  onChange={setHeaderImageUrl}
                  accept="all"
                  pickerTitle="Choose header media"
                  placeholder="No file chosen"
                />
              </Field>
            ) : null}

            {/* Scope radio group */}
            <div className="flex flex-col gap-2">
              <Label className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]">
                Target contacts
              </Label>
              <RadioGroup
                value={requeueScope}
                onValueChange={(v) => setRequeueScope(v as 'ALL' | 'FAILED')}
                className="flex flex-col gap-2"
                aria-label="Target contacts"
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

          <DialogFooter className="gap-2 border-t border-[var(--st-border)] px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -- local helper -- */

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
        'flex cursor-pointer items-center gap-2.5 rounded-[var(--st-radius)] border px-3 py-2.5 transition-colors',
        active
          ? 'border-[var(--st-accent)] bg-[var(--st-bg-muted)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] hover:bg-[var(--st-bg-muted)]',
      )}
    >
      <RadioGroupItem value={value} id={id} />
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-[var(--st-text)]">
          {title}
        </span>
        <span className="text-[11px] text-[var(--st-text-secondary)]">
          {description}
        </span>
      </div>
    </label>
  );
}
