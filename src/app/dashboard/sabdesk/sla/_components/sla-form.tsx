"use client";

import { Button, Card, Input, Label, Switch, Textarea, useToast } from '@/components/sabcrm/20ui';
import { EnumFormField } from "@/components/crm/enum-form-field";
import { EntityFormField } from "@/components/crm/entity-form-field";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";

/**
 * <SlaForm /> — create + edit form for a CRM SLA policy.
 *
 * Sections: basics (name, priority, status), targets (first-response,
 * resolution, business-hours-only), escalation (escalateTo, after
 * minutes), notes (description + internal notes).
 */

import * as React from "react";

import { saveSla, type SaveSlaState } from "@/app/actions/crm-sla.actions";
import type {
  CrmSlaDoc,
  CrmSlaPriority,
  CrmSlaStatus,
} from "@/lib/rust-client/crm-slas";

const BASE = "/dashboard/sabdesk/sla";

const initialState: SaveSlaState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      {isEditing ? "Save changes" : "Create SLA"}
    </Button>
  );
}

interface SlaFormProps {
  initialData?: CrmSlaDoc | null;
}

export function SlaForm({ initialData }: SlaFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!initialData?._id;

  const [state, formAction] = useActionState(saveSla, initialState);

  const [priority, setPriority] = useState<CrmSlaPriority>(
    (initialData?.priority as CrmSlaPriority) ?? "medium",
  );
  const [status, setStatus] = useState<CrmSlaStatus>(
    initialData?.status ?? "active",
  );
  const [businessHoursOnly, setBusinessHoursOnly] = useState<boolean>(
    initialData?.businessHoursOnly ?? false,
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: "Saved", description: state.message });
      const id = state.id ?? initialData?._id;
      router.push(id ? `${BASE}/${id}` : BASE);
    }
    if (state?.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, router, initialData?._id]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {isEditing ? (
        <input type="hidden" name="slaId" value={initialData!._id} />
      ) : null}
      <input type="hidden" name="priority" value={priority} />
      <input
        type="hidden"
        name="businessHoursOnly"
        value={businessHoursOnly ? "true" : "false"}
      />
      {isEditing ? <input type="hidden" name="status" value={status} /> : null}

      <Card className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-[var(--st-text)]">Basics</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">
              Name <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g. Critical 1-hour SLA"
              defaultValue={initialData?.name ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Applies to priority</Label>
            <EnumFormField
              enumName="ticketPriority"
              initialId={priority}
              onChange={(v) => setPriority((v ?? "medium") as CrmSlaPriority)}
            />
          </div>
          {isEditing ? (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <EnumFormField
                enumName="replyTemplateStatus"
                initialId={status}
                onChange={(v) => setStatus((v ?? "active") as CrmSlaStatus)}
              />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
          Response targets
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstResponseMinutes">
              First response (minutes) *
            </Label>
            <Input
              id="firstResponseMinutes"
              name="firstResponseMinutes"
              type="number"
              min={1}
              required
              placeholder="e.g. 60"
              defaultValue={initialData?.firstResponseMinutes ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resolutionMinutes">Resolution (minutes) *</Label>
            <Input
              id="resolutionMinutes"
              name="resolutionMinutes"
              type="number"
              min={1}
              required
              placeholder="e.g. 480"
              defaultValue={initialData?.resolutionMinutes ?? ""}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2 sm:col-span-2">
            <div className="flex flex-col">
              <Label htmlFor="bh-toggle">Business hours only</Label>
              <span className="text-xs text-[var(--st-text-secondary)]">
                Pause the SLA clock outside of configured business hours.
              </span>
            </div>
            <Switch
              id="bh-toggle"
              checked={businessHoursOnly}
              onCheckedChange={setBusinessHoursOnly}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
          Escalation
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="escalateAfterMinutes">
              Escalate after (minutes)
            </Label>
            <Input
              id="escalateAfterMinutes"
              name="escalateAfterMinutes"
              type="number"
              min={1}
              placeholder="Optional"
              defaultValue={initialData?.escalateAfterMinutes ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Escalate to</Label>
            <EntityFormField
              entity="user"
              name="escalateTo"
              initialId={initialData?.escalateTo ?? null}
              placeholder="Pick an agent or manager…"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-[var(--st-text)]">Notes</h2>
        <div className="grid grid-cols-1 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional — describe when this SLA applies."
              defaultValue={initialData?.description ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Optional — only visible to your team."
              defaultValue={initialData?.notes ?? ""}
            />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Button variant="ghost" asChild>
          <Link
            href={
              isEditing && initialData?._id
                ? `${BASE}/${initialData._id}`
                : BASE
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Link>
        </Button>
        <SubmitButton isEditing={isEditing} />
      </div>
    </form>
  );
}
