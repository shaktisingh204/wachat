"use client";

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Switch,
  Textarea,
  useZoruToast,
} from "@/components/sabcrm/20ui/zoru";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";

/**
 * <ReplyTemplateForm /> — create + edit form for ticket reply templates.
 *
 * The body is a tall textarea; we extract `{{variable}}` placeholders
 * live and surface them as chips so authors can sanity-check their
 * macros before saving. The server action re-derives this list on
 * save.
 */

import * as React from "react";

import { EnumFormField } from "@/components/crm/enum-form-field";

import {
  saveReplyTemplate,
  type SaveReplyTemplateState,
} from "@/app/actions/crm-reply-templates.actions";
import type {
  CrmReplyTemplateDoc,
  CrmReplyTemplateStatus,
} from "@/lib/rust-client/crm-reply-templates";

const BASE = "/dashboard/sabdesk/reply-templates";

const initialState: SaveReplyTemplateState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      {isEditing ? "Save changes" : "Create template"}
    </Button>
  );
}

function extractVariables(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const v = m[1];
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

interface ReplyTemplateFormProps {
  initialData?: CrmReplyTemplateDoc | null;
}

export function ReplyTemplateForm({ initialData }: ReplyTemplateFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const isEditing = !!initialData?._id;
  const [state, formAction] = useActionState(saveReplyTemplate, initialState);

  const [body, setBody] = useState<string>(initialData?.body ?? "");
  const [category, setCategory] = useState<string>(
    initialData?.category ?? "general",
  );
  const [language, setLanguage] = useState<string>(
    initialData?.language ?? "en",
  );
  const [status, setStatus] = useState<CrmReplyTemplateStatus>(
    initialData?.status ?? "active",
  );
  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true,
  );

  const detectedVars = React.useMemo(() => extractVariables(body), [body]);

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
    <Card className="p-6">
      <form action={formAction} className="flex flex-col gap-6">
        {isEditing ? (
          <input type="hidden" name="templateId" value={initialData!._id} />
        ) : null}
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="language" value={language} />
        <input
          type="hidden"
          name="isActive"
          value={isActive ? "true" : "false"}
        />
        {isEditing ? (
          <input type="hidden" name="status" value={status} />
        ) : null}

        {/* Row 1: Name + Shortcut */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g. Refund acknowledged"
              defaultValue={initialData?.name ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shortcut">Shortcut</Label>
            <Input
              id="shortcut"
              name="shortcut"
              placeholder="e.g. /refund"
              defaultValue={initialData?.shortcut ?? ""}
              className="font-mono"
            />
          </div>
        </div>

        {/* Row 2: Category + Language */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <EnumFormField
              enumName="replyTemplateCategory"
              name="categoryPicker"
              initialId={category}
              placeholder="Pick a category…"
              onChange={(next) => setCategory(next ?? "")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <EnumFormField
              enumName="languageShort"
              name="languagePicker"
              initialId={language}
              placeholder="Pick a language…"
              onChange={(next) => setLanguage(next ?? "")}
            />
          </div>
        </div>

        {/* Row 3: Body (multi-line, the main field) */}
        <div className="space-y-1.5">
          <Label htmlFor="body">
            Template body *{" "}
            <span className="text-xs text-[var(--st-text-secondary)]">
              Use {"{{variable}}"} placeholders
            </span>
          </Label>
          <Textarea
            id="body"
            name="body"
            rows={12}
            required
            placeholder={
              "Hi {{customer.name}},\n\nThanks for reaching out about {{ticket.subject}}. We're looking into this and will get back to you within {{sla.minutes}} minutes.\n\nBest,\n{{agent.name}}"
            }
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-sm"
          />
        </div>

        {/* Detected variables chip strip */}
        {detectedVars.length > 0 ? (
          <div className="space-y-1.5">
            <Label>Detected variables</Label>
            <div className="flex flex-wrap gap-1.5">
              {detectedVars.map((v) => (
                <Badge key={v} variant="ghost">
                  <code className="font-mono text-xs">{`{{${v}}}`}</code>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-[var(--st-text-secondary)]">
              These will be saved alongside the body as the template&apos;s
              variable list.
            </p>
          </div>
        ) : null}

        {/* Row 4: Active + Status (status only when editing) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] px-3 py-2">
            <div className="flex flex-col">
              <Label htmlFor="isActiveToggle">Active</Label>
              <span className="text-xs text-[var(--st-text-secondary)]">
                Inactive templates won&apos;t show in agent picker.
              </span>
            </div>
            <Switch
              id="isActiveToggle"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          {isEditing ? (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <EnumFormField
                enumName="replyTemplateStatus"
                name="statusPicker"
                initialId={status}
                allowInlineCreate={false}
                onChange={(next) =>
                  setStatus((next ?? "active") as CrmReplyTemplateStatus)
                }
              />
            </div>
          ) : null}
        </div>

        {/* Footer */}
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
    </Card>
  );
}
