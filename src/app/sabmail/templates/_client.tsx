"use client";

import * as React from "react";
import { FileText, Pencil, Plus, Save, Trash2 } from "lucide-react";

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import { SuccessCheck } from "@/components/sabmail/motion";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/app/sabmail/_components/rich-text-editor";
import {
  createSabmailTemplate,
  deleteSabmailTemplate,
  updateSabmailTemplate,
  type SabmailTemplateRow,
} from "./actions";
import { VisualBuilder } from "./_components/visual-builder";

import "@/components/sabmail/motion/sabmail-motion.css";

/** Strip tags for a short preview line on the card. */
function previewText(html: string): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; template: SabmailTemplateRow };

export function SabmailTemplatesClient({
  initialTemplates,
}: {
  initialTemplates: SabmailTemplateRow[];
}) {
  const { toast } = useToast();
  const [templates, setTemplates] =
    React.useState<SabmailTemplateRow[]>(initialTemplates);

  const [editor, setEditor] = React.useState<EditorState | null>(null);
  const [name, setName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const bodyRef = React.useRef<string>("");
  const richRef = React.useRef<RichTextEditorHandle>(null);
  const [visualMode, setVisualMode] = React.useState(false);

  const [formErr, setFormErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const openCreate = React.useCallback(() => {
    setEditor({ mode: "create" });
    setName("");
    setSubject("");
    bodyRef.current = "";
    setFormErr(null);
  }, []);

  const openEdit = React.useCallback((template: SabmailTemplateRow) => {
    setEditor({ mode: "edit", template });
    setName(template.name);
    setSubject(template.subject);
    bodyRef.current = template.bodyHtml;
    setFormErr(null);
  }, []);

  const closeEditor = React.useCallback(() => {
    if (saving) return;
    setEditor(null);
    setJustSaved(false);
  }, [saving]);

  const handleSave = React.useCallback(async () => {
    if (!editor) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setFormErr("Template name is required.");
      return;
    }
    setSaving(true);
    setFormErr(null);

    const payload = { name: trimmed, subject: subject.trim(), bodyHtml: bodyRef.current };
    const res =
      editor.mode === "create"
        ? await createSabmailTemplate(payload)
        : await updateSabmailTemplate(editor.template.id, payload);

    if (!res.ok) {
      setFormErr(res.error);
      setSaving(false);
      return;
    }

    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== res.template.id);
      return [res.template, ...next].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      );
    });
    setJustSaved(true);
    toast({
      title: editor.mode === "create" ? "Template created" : "Template saved",
    });
    // Brief success affordance, then close.
    window.setTimeout(() => {
      setSaving(false);
      setEditor(null);
      setJustSaved(false);
    }, 750);
  }, [editor, name, subject, toast]);

  const handleDelete = React.useCallback(
    async (template: SabmailTemplateRow) => {
      const confirmed = window.confirm(
        `Delete the template “${template.name}”? This cannot be undone.`,
      );
      if (!confirmed) return;
      setDeletingId(template.id);
      const res = await deleteSabmailTemplate(template.id);
      if (!res.ok) {
        toast({
          title: "Could not delete template",
          description: res.error,
          variant: "destructive",
        });
        setDeletingId(null);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      setDeletingId(null);
      toast({ title: "Template deleted" });
    },
    [toast],
  );

  const dialogOpen = editor !== null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Templates</PageTitle>
          <PageDescription>
            Reusable subject lines and rich-HTML bodies for this workspace.
            Save the emails you send again and again, then drop them into the
            composer in one click.
          </PageDescription>
        </PageHeaderHeading>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
          New template
        </Button>
      </PageHeader>

      <div className="mt-6">
        {templates.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<FileText aria-hidden />}
              title="No templates yet"
              description="Create your first template to reuse a subject and body across messages and campaigns."
              action={
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                  Create template
                </Button>
              }
            />
          </Card>
        ) : (
          <ul className="sabmail-motion grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t, idx) => {
              const preview = previewText(t.bodyHtml);
              const deleting = deletingId === t.id;
              return (
                <li
                  key={t.id}
                  className="sabmail-stagger-item"
                  style={{ ["--i" as string]: idx } as React.CSSProperties}
                >
                  <Card className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start gap-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        <FileText className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--st-text)]">
                          {t.name}
                        </div>
                        <div className="truncate text-xs text-[var(--st-text-secondary)]">
                          {t.subject || "No subject"}
                        </div>
                      </div>
                    </div>

                    <p className="line-clamp-3 min-h-[2.5rem] text-xs text-[var(--st-text-secondary)]">
                      {preview || "Empty body"}
                    </p>

                    <div className="mt-auto flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        iconLeft={Pencil}
                        onClick={() => openEdit(t)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        loading={deleting}
                        disabled={deleting}
                        onClick={() => void handleDelete(t)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? null : closeEditor())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "edit" ? "Edit template" : "New template"}
            </DialogTitle>
            <DialogDescription>
              Give the template a name, an optional default subject, and a
              rich-text body. The body is sanitized before it&apos;s stored.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Name" error={formErr ?? undefined}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Welcome — new customer"
                autoFocus
                maxLength={160}
                disabled={saving}
              />
            </Field>

            <Field label="Subject">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Welcome to {{company}} 👋"
                maxLength={300}
                disabled={saving}
              />
            </Field>

            <Field label="Body">
              <div className="mb-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setVisualMode((v) => !v)}>
                  {visualMode ? "Rich text editor" : "Visual builder"}
                </Button>
              </div>
              {visualMode ? (
                <VisualBuilder
                  initialHtml={editor?.mode === "edit" ? editor.template.bodyHtml : ""}
                  onChange={(html) => {
                    bodyRef.current = html;
                  }}
                />
              ) : (
                <RichTextEditor
                  ref={richRef}
                  initialHtml={
                    editor?.mode === "edit" ? editor.template.bodyHtml : ""
                  }
                  onChange={(html) => {
                    bodyRef.current = html;
                  }}
                  ariaLabel="Template body"
                  placeholder="Write the template body…"
                  className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-3"
                />
              )}
            </Field>
          </div>

          <DialogFooter>
            {justSaved ? (
              <span className="mr-auto inline-flex items-center gap-2 text-sm text-[var(--st-status-ok,#16a34a)]">
                <SuccessCheck size={20} /> Saved
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={closeEditor}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Save}
              loading={saving && !justSaved}
              disabled={saving || !name.trim()}
              onClick={() => void handleSave()}
            >
              {editor?.mode === "edit" ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
