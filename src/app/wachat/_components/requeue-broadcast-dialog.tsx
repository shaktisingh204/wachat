'use client';

import {
  Button,
  IconButton,
  Modal,
  Field,
  Input,
  SelectField as Select,
  RadioCardGroup,
  RadioCard,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2,
  RotateCw } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleRequeueBroadcast } from '@/app/actions/broadcast.actions';
import type { Project,
  Template } from '@/lib/definitions';

/**
 * RequeueBroadcastDialog (wachat-local, 20ui)
 *
 * Confirmation + composer for re-sending a previously-completed broadcast,
 * either to ALL original contacts or only the FAILED ones. Visual layer is
 * pure 20ui — neutral palette, bold-by-default. Server action call
 * (handleRequeueBroadcast) and form-state behavior preserved 1:1.
 */

const FORM_ID = 'requeue-broadcast-form';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" form={FORM_ID} disabled={pending} variant="primary">
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCw className="h-3.5 w-3.5" />
      )}
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
      toast({ title: 'Success', description: state.message, tone: 'success' });
      setOpen(false);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        tone: 'danger',
      });
    }
  }, [state, toast]);

  const resetForm = () => {
    formRef.current?.reset();
    setSelectedTemplateId(originalTemplateId);
    setRequeueScope('ALL');
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
  };

  const approvedTemplates = templates.filter(
    (t) => t.status?.toUpperCase() === 'APPROVED',
  );

  const templateOptions = approvedTemplates.map((template) => {
    const status = template.status
      ? template.status.replace(/_/g, ' ').toLowerCase()
      : 'n/a';
    return {
      value: template._id.toString(),
      label: `${template.name} · ${status}`,
    };
  });

  return (
    <>
      <IconButton
        label="Requeue broadcast"
        icon={RotateCw}
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      />

      <Modal
        open={open}
        onClose={handleClose}
        title="Requeue broadcast"
        description="Send this campaign again to the same audience — all contacts or only the ones that failed the first time."
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <SubmitButton />
          </>
        }
      >
        <form id={FORM_ID} ref={formRef} action={formAction}>
          <input type="hidden" name="broadcastId" value={broadcastId} />
          <input type="hidden" name="templateId" value={selectedTemplateId} />
          <input type="hidden" name="requeueScope" value={requeueScope} />

          <div className="flex flex-col gap-5">
            {/* Template select */}
            <Field
              label="Message template"
              required
              help={
                approvedTemplates.length === 0
                  ? 'No approved templates found.'
                  : undefined
              }
            >
              <Select
                value={selectedTemplateId}
                onChange={(v) => setSelectedTemplateId(v ?? '')}
                options={templateOptions}
                placeholder="Choose an approved template…"
                aria-label="Message template"
              />
            </Field>

            {/* Header media (optional) */}
            {showImageUpload ? (
              <Field
                label="Header media URL"
                help="Provide a new public media URL to override the template's header image."
              >
                <Input
                  id="headerImageUrl"
                  name="headerImageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                />
              </Field>
            ) : null}

            {/* Scope radio group */}
            <Field label="Target contacts">
              <RadioCardGroup
                value={requeueScope}
                onValueChange={(v) => setRequeueScope(v as 'ALL' | 'FAILED')}
                aria-label="Target contacts"
              >
                <RadioCard
                  value="ALL"
                  label="All original contacts"
                  description="Resend to every contact in the original audience."
                />
                <RadioCard
                  value="FAILED"
                  label="Only failed contacts"
                  description="Retry delivery only to the ones that failed last time."
                />
              </RadioCardGroup>
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}

