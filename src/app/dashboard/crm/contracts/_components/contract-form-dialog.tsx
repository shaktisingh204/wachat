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
} from '@/components/zoruui';
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
  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="text-foreground">
            {editing ? 'Edit Contract' : 'Add Contract'}
          </ZoruDialogTitle>
          <ZoruDialogDescription className="text-muted-foreground">
            Fill in the details below.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <form action={action} className="space-y-4">
          {editing?._id ? (
            <input type="hidden" name="_id" value={editing._id} />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ZoruLabel className="text-foreground">
                Title <span className="text-destructive">*</span>
              </ZoruLabel>
              <ZoruInput
                name="title"
                required
                defaultValue={editing?.title || ''}
                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel className="text-foreground">Client</ZoruLabel>
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
              <ZoruLabel className="text-foreground">
                Status <span className="text-destructive">*</span>
              </ZoruLabel>
              <ZoruSelect
                name="status"
                defaultValue={editing?.status || 'draft'}
              >
                <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                  <ZoruSelectItem value="sent">Sent</ZoruSelectItem>
                  <ZoruSelectItem value="signed">Signed</ZoruSelectItem>
                  <ZoruSelectItem value="expired">Expired</ZoruSelectItem>
                  <ZoruSelectItem value="terminated">Terminated</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div>
              <ZoruLabel className="text-foreground">Value</ZoruLabel>
              <ZoruInput
                type="number"
                name="value"
                defaultValue={editing?.value ?? ''}
                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel className="text-foreground">Currency</ZoruLabel>
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
              <ZoruLabel className="text-foreground">Start Date</ZoruLabel>
              <ZoruInput
                type="date"
                name="startDate"
                defaultValue={
                  editing?.startDate
                    ? new Date(editing.startDate as Date | string)
                        .toISOString()
                        .slice(0, 10)
                    : ''
                }
                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel className="text-foreground">End Date</ZoruLabel>
              <ZoruInput
                type="date"
                name="endDate"
                defaultValue={
                  editing?.endDate
                    ? new Date(editing.endDate as Date | string)
                        .toISOString()
                        .slice(0, 10)
                    : ''
                }
                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div className="md:col-span-2">
              <ZoruLabel className="text-foreground">Body</ZoruLabel>
              <ZoruTextarea
                name="body"
                rows={6}
                defaultValue={editing?.body || ''}
                className="mt-1.5 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
          </div>

          <ZoruDialogFooter className="gap-2">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={isSaving}>
              Save
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
