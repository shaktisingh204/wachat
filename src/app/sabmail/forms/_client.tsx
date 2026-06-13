"use client";

import * as React from "react";
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import { CreatingOverlay } from "@/components/sabmail/motion";

import {
  createSabmailForm,
  deleteSabmailForm,
  type SabmailFormField,
  type SabmailFormFieldType,
  type SabmailFormRow,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

/* ── helpers ─────────────────────────────────────────────────────────── */

interface DraftField {
  uid: string;
  label: string;
  type: SabmailFormFieldType;
}

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `f${uidCounter}-${Date.now()}`;
}

function defaultDraftFields(): DraftField[] {
  return [
    { uid: nextUid(), label: "Email", type: "email" },
    { uid: nextUid(), label: "Name", type: "text" },
  ];
}

/** Absolute public submit URL for a form (client-only — uses window.origin). */
function submitUrlFor(id: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/sabmail/forms/${id}/submit`;
}

/** A copyable, framework-free HTML <form> embed snippet posting to the form. */
function embedSnippetFor(form: SabmailFormRow): string {
  const url = submitUrlFor(form.id);
  const inputs = form.fields
    .map((f) => {
      const required = f.type === "email" ? " required" : "";
      const type = f.type === "email" ? "email" : "text";
      return [
        `  <label style="display:block;margin:0 0 12px">`,
        `    <span style="display:block;margin:0 0 4px;font:14px/1.4 sans-serif">${escapeHtml(f.label)}</span>`,
        `    <input name="${escapeHtml(f.key)}" type="${type}"${required} style="width:100%;padding:8px 10px;font:14px/1.4 sans-serif;border:1px solid #d4d4d8;border-radius:6px" />`,
        `  </label>`,
      ].join("\n");
    })
    .join("\n");

  return [
    `<form action="${url}" method="POST">`,
    inputs,
    `  <button type="submit" style="padding:9px 16px;font:14px/1.4 sans-serif;border:0;border-radius:6px;background:#111827;color:#fff;cursor:pointer">Subscribe</button>`,
    `</form>`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── per-form copy button ────────────────────────────────────────────── */

function CopyButton({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  }, [value, toast]);

  return (
    <Button
      variant="outline"
      size="sm"
      iconLeft={copied ? Check : Icon}
      onClick={() => void copy()}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/* ── form card ───────────────────────────────────────────────────────── */

function FormCard({
  form,
  index,
  onDelete,
}: {
  form: SabmailFormRow;
  index: number;
  onDelete: (id: string) => void;
}) {
  const submitUrl = submitUrlFor(form.id);
  const snippet = embedSnippetFor(form);
  const [showEmbed, setShowEmbed] = React.useState(false);

  return (
    <Card
      className="sabmail-stagger-item"
      style={{ ["--i" as string]: index } as React.CSSProperties}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{form.name}</CardTitle>
            <CardDescription>
              {form.fields.length} field{form.fields.length === 1 ? "" : "s"}
              {form.tag ? " · tags new contacts" : ""}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            onClick={() => onDelete(form.id)}
          >
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-4">
          {/* fields summary */}
          <div className="flex flex-wrap gap-1.5">
            {form.fields.map((f) => (
              <Badge key={f.key} variant={f.type === "email" ? "secondary" : "outline"}>
                {f.label}
              </Badge>
            ))}
            {form.tag ? <Badge variant="default">tag: {form.tag}</Badge> : null}
          </div>

          {form.redirectUrl ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="truncate">Redirects to {form.redirectUrl}</span>
            </div>
          ) : null}

          {/* public submit URL */}
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--st-text-secondary)]">
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Public submit URL
            </span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 font-mono text-xs text-[var(--st-text)]">
                {submitUrl}
              </code>
              <CopyButton value={submitUrl} label="Copy URL" icon={Copy} />
            </div>
          </div>

          {/* embed snippet */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--st-text-secondary)]">
                <Code2 className="h-3.5 w-3.5" aria-hidden />
                HTML embed
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEmbed((v) => !v)}
                >
                  {showEmbed ? "Hide" : "Show"}
                </Button>
                <CopyButton value={snippet} label="Copy embed" icon={Copy} />
              </div>
            </div>
            {showEmbed ? (
              <pre className="overflow-x-auto rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 font-mono text-[11px] leading-relaxed text-[var(--st-text)]">
                <code>{snippet}</code>
              </pre>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── page client ─────────────────────────────────────────────────────── */

export function SabmailFormsClient({
  initialForms,
}: {
  initialForms: SabmailFormRow[];
}) {
  const { toast } = useToast();
  const [forms, setForms] = React.useState<SabmailFormRow[]>(initialForms);

  // Create dialog state.
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [fields, setFields] = React.useState<DraftField[]>(defaultDraftFields);
  const [tag, setTag] = React.useState("");
  const [redirectUrl, setRedirectUrl] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const reset = React.useCallback(() => {
    setName("");
    setFields(defaultDraftFields());
    setTag("");
    setRedirectUrl("");
    setErr(null);
  }, []);

  const addField = React.useCallback(() => {
    setFields((prev) =>
      prev.length >= 30
        ? prev
        : [...prev, { uid: nextUid(), label: "", type: "text" }],
    );
  }, []);

  const removeField = React.useCallback((uid: string) => {
    setFields((prev) => prev.filter((f) => f.uid !== uid));
  }, []);

  const updateField = React.useCallback(
    (uid: string, patch: Partial<Omit<DraftField, "uid">>) => {
      setFields((prev) => prev.map((f) => (f.uid === uid ? { ...f, ...patch } : f)));
    },
    [],
  );

  const handleCreate = React.useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErr("Give your form a name.");
      return;
    }
    const cleanFields: SabmailFormField[] = fields
      .map((f) => ({ key: "", label: f.label.trim(), type: f.type }))
      .filter((f) => f.label);
    if (cleanFields.length === 0) {
      setErr("Add at least one field with a label.");
      return;
    }
    if (!cleanFields.some((f) => f.type === "email")) {
      setErr("Add an email field so submissions become contacts.");
      return;
    }

    setCreating(true);
    setErr(null);
    const res = await createSabmailForm({
      name: trimmedName,
      fields: cleanFields,
      tag: tag.trim() || undefined,
      redirectUrl: redirectUrl.trim() || undefined,
    });
    if (!res.ok) {
      setErr(res.error);
      setCreating(false);
      return;
    }
    setForms((prev) => [res.form, ...prev]);
    toast({ title: "Form created" });
    setCreating(false);
    setOpen(false);
    reset();
  }, [name, fields, tag, redirectUrl, toast, reset]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      const res = await deleteSabmailForm(id);
      if (!res.ok) {
        toast({ title: "Could not delete form", description: res.error, variant: "destructive" });
        return;
      }
      setForms((prev) => prev.filter((f) => f.id !== id));
      toast({ title: "Form deleted" });
    },
    [toast],
  );

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <CreatingOverlay
        show={creating}
        variant="process"
        title="Creating form…"
        subtitle="Publishing its public submit endpoint"
      />

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Forms</PageTitle>
          <PageDescription>
            Signup &amp; lead-capture forms. Each one publishes a public submit
            URL — drop the embed on any site and every submission becomes a
            contact in this workspace.
          </PageDescription>
        </PageHeaderHeading>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            New form
          </Button>
        </div>
      </PageHeader>

      <div className="mt-6">
        {forms.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<FileText aria-hidden />}
                title="No forms yet"
                description="Create a signup form to capture leads from your site and grow your audience."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => {
                      reset();
                      setOpen(true);
                    }}
                  >
                    New form
                  </Button>
                }
              />
            </CardBody>
          </Card>
        ) : (
          <div className="sabmail-motion flex flex-col gap-4">
            {forms.map((form, idx) => (
              <FormCard key={form.id} form={form} index={idx} onDelete={(id) => void handleDelete(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Create form dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New form</DialogTitle>
            <DialogDescription>
              Name your form and choose its fields. An email field is required —
              it&rsquo;s what turns a submission into a contact.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field label="Form name" error={err ?? undefined}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Newsletter signup"
                autoFocus
              />
            </Field>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--st-text-secondary)]">Fields</span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Plus}
                  onClick={addField}
                  disabled={fields.length >= 30}
                >
                  Add field
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {fields.map((f) => (
                  <div key={f.uid} className="flex items-center gap-2">
                    <Input
                      value={f.label}
                      onChange={(e) => updateField(f.uid, { label: e.target.value })}
                      placeholder="Field label"
                      className="flex-1"
                    />
                    <Select
                      value={f.type}
                      onValueChange={(v) => updateField(f.uid, { type: v as SabmailFormFieldType })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={X}
                      onClick={() => removeField(f.uid)}
                      disabled={fields.length <= 1}
                      aria-label="Remove field"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Field label="Tag new contacts (optional)">
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="newsletter"
              />
            </Field>

            <Field label="Redirect after submit (optional)">
              <Input
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://example.com/thank-you"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={creating}
              disabled={creating || !name.trim()}
              onClick={() => void handleCreate()}
            >
              Create form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
