"use client";

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

/**
 * <TicketForm> — Create / Edit form for tickets (§1D.3 bar).
 *
 * Sections rendered as `<Card>`:
 *   1. Basics — subject, description, requester (polymorphic), channel,
 *      product, category + sub-category.
 *   2. Workflow — priority, severity, status, SLA, due-by, agent group.
 *   3. Assignment — assignee, linked deal / invoice, parent ticket, tags.
 *   4. Custom fields (when defined).
 *
 * Polymorphic requester (§1D.3): the `requesterKind` discriminator
 * (client / lead / employee) drives which `<EntityFormField>` renders
 * for `requesterId`. The kind is persisted into `customFields.requesterKind`
 * (the wire schema doesn't yet carry a dedicated field, but the chip
 * lookup on the list page reads from there).
 *
 * Smart defaults: `?fromKind=&fromId=` query string seeds the requester
 * picker (used by Email→Ticket and Lead→Ticket conversions).
 */

import * as React from "react";

import { EntityFormField } from "@/components/crm/entity-form-field";
import { EnumFormField } from "@/components/crm/enum-form-field";
import {
  CustomFieldInput,
  type CustomFieldValue,
} from "@/components/crm/custom-field-input";
import { EntityMultiFormField } from "@/components/crm/entity-multi-form-field";
import { saveTicketAction } from "@/app/actions/crm/tickets.actions";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";
import type { WsCustomField } from "@/lib/worksuite/meta-types";
import type { EntityKey } from "@/lib/lookup-registry";

type RequesterKind = "client" | "lead" | "employee";

interface TicketFormProps {
  initial?: CrmTicketDoc | null;
  customFields: WsCustomField[];
}

const INITIAL_STATE = {
  message: undefined as string | undefined,
  error: undefined as string | undefined,
  id: undefined as string | undefined,
};

const REQUESTER_ENTITY: Record<RequesterKind, EntityKey> = {
  client: "client",
  lead: "lead",
  employee: "employee",
};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? "Save changes" : "Create ticket"}
    </Button>
  );
}

export function TicketForm({ initial, customFields }: TicketFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const sp = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveTicketAction, INITIAL_STATE);
  const editing = !!initial?._id;

  // Read initial requesterKind from customFields bag (post-§1D); fall
  // back to the URL prefill (?fromKind=) or 'client' for legacy rows.
  const initialBag = (initial?.customFields ?? {}) as Record<string, unknown>;
  const prefillKind = (sp?.get("fromKind") as RequesterKind | null) ?? null;
  const prefillId = sp?.get("fromId") ?? null;

  const [requesterKind, setRequesterKind] = useState<RequesterKind>(() => {
    const stored = String(initialBag.requesterKind ?? "").toLowerCase();
    if (stored === "lead" || stored === "employee") return stored;
    if (prefillKind === "lead" || prefillKind === "employee")
      return prefillKind;
    return "client";
  });
  const [requesterId, setRequesterId] = useState<string>(
    initial?.requesterId ?? prefillId ?? "",
  );

  const [channel, setChannel] = useState<string>(initial?.channel ?? "email");
  const [status, setStatus] = useState<string>(initial?.status ?? "open");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "");
  const [severity, setSeverity] = useState<string>(initial?.severity ?? "sev3");

  const initialTags = Array.isArray(initialBag.tags)
    ? (initialBag.tags as unknown[]).map((x) => String(x))
    : [];
  const [tagIds, setTagIds] = useState<string[]>(initialTags);

  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValue>
  >(() => {
    const seed: Record<string, CustomFieldValue> = {};
    for (const f of customFields) {
      const v = initialBag[f.name];
      if (v !== undefined) seed[f.name] = v as CustomFieldValue;
    }
    return seed;
  });

  useEffect(() => {
    if (state?.message) {
      toast({ title: "Saved", description: state.message });
      router.push(
        state.id ? `/dashboard/sabdesk/${state.id}` : "/dashboard/sabdesk",
      );
    }
    if (state?.error) {
      toast({
        title: "Error",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, router]);

  const requesterEntity = REQUESTER_ENTITY[requesterKind] ?? "client";

  // The customFields blob carries the polymorphic requesterKind + tags
  // so the list page chip lookup can resolve it. Augment whatever the
  // user typed for the worksuite custom fields with these reserved keys.
  const customFieldsForSubmit = React.useMemo(
    () => ({
      ...customFieldValues,
      requesterKind,
      tags: tagIds,
    }),
    [customFieldValues, requesterKind, tagIds],
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(customFieldsForSubmit)}
      />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="severity" value={severity} />

      {/* ─── Basics ──────────────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Basics
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="subject">
              Subject <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="subject"
              name="subject"
              required
              defaultValue={initial?.subject ?? ""}
              className="mt-1.5"
              placeholder="Login broken on mobile"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={
                (initialBag.description as string | undefined) ?? ""
              }
              className="mt-1.5"
              placeholder="What is happening? Steps to reproduce, expected vs actual…"
            />
          </div>

          <div>
            <Label>
              Requester type <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="requesterKind"
                name="requesterKindPicker"
                initialId={requesterKind}
                allowInlineCreate={false}
                placeholder="Type…"
                onChange={(next) => {
                  if (
                    next === "client" ||
                    next === "lead" ||
                    next === "employee"
                  ) {
                    setRequesterKind(next);
                    setRequesterId("");
                  }
                }}
              />
            </div>
          </div>

          <div>
            <Label>
              Requester <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                key={requesterKind}
                entity={requesterEntity}
                name="requesterId"
                initialId={requesterId || null}
                required
                onChange={(next) => setRequesterId(next ?? "")}
              />
            </div>
          </div>

          <div>
            <Label>
              Channel <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="ticketChannel"
                name="channelPicker"
                initialId={channel}
                placeholder="Select channel…"
                onChange={(next) => setChannel(next ?? "")}
              />
            </div>
          </div>

          <div>
            <Label>Product</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="item"
                name="productId"
                initialId={initial?.productId ?? null}
              />
            </div>
          </div>

          <div>
            <Label>Category</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="category"
                name="category"
                initialId={initial?.category ?? null}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="subCategory">Sub-category</Label>
            <Input
              id="subCategory"
              name="subCategory"
              defaultValue={
                (initialBag.subCategory as string | undefined) ?? ""
              }
              className="mt-1.5"
              placeholder="Optional"
            />
          </div>
        </div>
      </Card>

      {/* ─── Workflow ────────────────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Priority</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="ticketPriority"
                name="priorityPicker"
                initialId={priority}
                placeholder="Select priority…"
                onChange={(next) => setPriority(next ?? "")}
              />
            </div>
          </div>
          <div>
            <Label>
              Severity <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="ticketSeverity"
                name="severityPicker"
                initialId={severity}
                placeholder="Select severity…"
                onChange={(next) => setSeverity(next ?? "")}
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="ticketStatus"
                name="statusPicker"
                initialId={status}
                placeholder="Select status…"
                onChange={(next) => setStatus(next ?? "")}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="dueBy">Due by</Label>
            <Input
              id="dueBy"
              name="dueBy"
              type="datetime-local"
              defaultValue={
                initial?.dueBy
                  ? new Date(initial.dueBy).toISOString().slice(0, 16)
                  : ""
              }
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Agent group</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="ticketGroup"
                name="agentGroupId"
                initialId={
                  (initialBag.agentGroupId as string | undefined) ?? null
                }
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ─── Assignment & linked ─────────────────────────────────── */}
      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Assignment & links
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Assignee (agent)</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="assigneeId"
                initialId={initial?.assigneeId ?? null}
              />
            </div>
          </div>
          <div>
            <Label>Linked deal</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="deal"
                name="linkedDealId"
                initialId={initial?.linkedDealId ?? null}
              />
            </div>
          </div>
          <div>
            <Label>Linked invoice</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="invoice"
                name="linkedInvoiceId"
                initialId={initial?.linkedInvoiceId ?? null}
              />
            </div>
          </div>
          <div>
            <Label>Parent ticket</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="ticketGroup"
                name="parentTicketId"
                initialId={initial?.parentTicketId ?? null}
                placeholder="Pick a ticket group/parent"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Tags</Label>
            <div className="mt-1.5">
              <EntityMultiFormField
                entity="tag"
                name="ticketTags"
                initialIds={tagIds}
                placeholder="Pick tags…"
                onChange={setTagIds}
              />
            </div>
          </div>
        </div>
      </Card>

      {customFields.length > 0 ? (
        <Card className="p-6">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Custom fields
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => (
              <CustomFieldInput
                key={String(f._id ?? f.name)}
                field={f}
                value={customFieldValues[f.name]}
                onChange={(v) =>
                  setCustomFieldValues((prev) => ({ ...prev, [f.name]: v }))
                }
              />
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/sabdesk/${String(initial!._id)}`
                : "/dashboard/sabdesk"
            }
          >
            Cancel
          </Link>
        </Button>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}

export default TicketForm;
