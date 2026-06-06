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
  Textarea,
} from '@/components/sabcrm/20ui/compat';
/**
 * Contract create/edit dialog — extracted out of the contracts list
 * page to keep page.tsx under 600 lines.
 *
 * Preserves every FormData key the original `saveContract` server
 * action reads (`_id`, `title`, `clientId`, `clientName`, `status`,
 * `value`, `currency`, `startDate`, `endDate`, `body`).
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import type { HrContract } from '@/lib/hr-types';
import { getContractTemplates } from '@/app/actions/worksuite/contracts-ext.actions';

type ContractInput = HrContract & { _id?: string };

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ContractInput | null;
  isSaving: boolean;
  action:
    | string
    | ((formData: FormData) => void | Promise<void>)
    | undefined;
}

export function ContractFormDialog({
  open,
  onOpenChange,
  editing,
  isSaving,
  action,
}: ContractFormDialogProps) {
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [bodyText, setBodyText] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setBodyText(editing?.body || '');
      getContractTemplates().then((data) => {
        setTemplates(data as any[] || []);
      });
    }
  }, [open, editing]);

  const handleTemplateChange = (templateId: string) => {
    const t = templates.find((x) => x._id === templateId);
    if (t) {
      setBodyText(t.body || '');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="text-[var(--st-text)]">
            {editing ? 'Edit Contract' : 'Add Contract'}
          </ZoruDialogTitle>
          <ZoruDialogDescription className="text-[var(--st-text-secondary)]">
            Fill in the details below.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <form action={action} className="space-y-4">
          {editing?._id ? (
            <input type="hidden" name="_id" value={editing._id} />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-[var(--st-text)]">
                Title <span className="text-[var(--st-text)]">*</span>
              </Label>
              <Input
                name="title"
                required
                defaultValue={editing?.title || ''}
                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[var(--st-text)]">Client</Label>
              <div className="mt-1.5">
                <EntityFormField
                  entity="client"
                  name="clientId"
                  dualWriteName="clientName"
                  initialId={(editing as { clientId?: string } | null)?.clientId ?? null}
                  initialLabel={editing?.clientName || ''}
                  placeholder="Select client…"
                />
              </div>
            </div>
            <div>
              <Label className="text-[var(--st-text)]">
                Status <span className="text-[var(--st-text)]">*</span>
              </Label>
              <Select
                name="status"
                defaultValue={editing?.status || 'draft'}
              >
                <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                  <ZoruSelectItem value="sent">Sent</ZoruSelectItem>
                  <ZoruSelectItem value="signed">Signed</ZoruSelectItem>
                  <ZoruSelectItem value="expired">Expired</ZoruSelectItem>
                  <ZoruSelectItem value="terminated">Terminated</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--st-text)]">E-Signature Provider</Label>
              <Select
                name="esignProvider"
                defaultValue={(editing as any)?.esignProvider || 'internal'}
              >
                <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="internal">Internal (SabNode)</ZoruSelectItem>
                  <ZoruSelectItem value="docusign">DocuSign</ZoruSelectItem>
                  <ZoruSelectItem value="hellosign">HelloSign</ZoruSelectItem>
                  <ZoruSelectItem value="adobe_sign">Adobe Sign</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--st-text)]">Value</Label>
              <Input
                type="number"
                name="value"
                defaultValue={editing?.value ?? ''}
                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[var(--st-text)]">Currency</Label>
              <div className="mt-1.5">
                <EntityFormField
                  entity="currency"
                  name="currency"
                  initialId={editing?.currency || 'INR'}
                  placeholder="Select currency…"
                />
              </div>
            </div>
            <div>
              <Label className="text-[var(--st-text)]">Start Date</Label>
              <Input
                type="date"
                name="startDate"
                defaultValue={
                  editing?.startDate
                    ? new Date(editing.startDate as Date | string)
                        .toISOString()
                        .slice(0, 10)
                    : ''
                }
                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[var(--st-text)]">End Date</Label>
              <Input
                type="date"
                name="endDate"
                defaultValue={
                  editing?.endDate
                    ? new Date(editing.endDate as Date | string)
                        .toISOString()
                        .slice(0, 10)
                    : ''
                }
                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-1.5">
                <Label className="text-[var(--st-text)]">Body</Label>
                {templates.length > 0 && (
                  <Select onValueChange={handleTemplateChange}>
                    <ZoruSelectTrigger className="h-8 w-[200px] text-[12px]">
                      <ZoruSelectValue placeholder="Apply template..." />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {templates.map((t) => (
                        <ZoruSelectItem key={t._id} value={t._id}>
                          {t.name}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                )}
              </div>
              <Textarea
                name="body"
                rows={6}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
              />
            </div>
          </div>

          <ZoruDialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              Save
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
