"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  archiveKbArticle,
  deleteKbArticle,
  publishKbArticle,
  saveKbArticle,
} from "@/app/actions/sabchat-support.actions";
import type { KbArticle } from "@/lib/rust-client/sabchat-knowledge";

export function KnowledgeClient({
  portalId,
  portalName,
  initialArticles,
}: {
  portalId: string;
  portalName: string;
  initialArticles: KbArticle[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<KbArticle | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handle = async (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => {
    const res = await fn();
    if (res.ok) {
      if (msg) toast({ title: msg });
      router.refresh();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
    return res.ok;
  };

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setOpen(true);
  };
  const openEdit = (a: KbArticle) => {
    setEditing(a);
    setTitle(a.title);
    setBody(a.body);
    setOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Knowledge base</PageTitle>
          <PageDescription>
            Articles in “{portalName}” — used by the AI resolve-bot to deflect
            common questions and published to your help center.
          </PageDescription>
        </PageHeaderHeading>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew}>
          New article
        </Button>
      </PageHeader>

      <Card className="mt-6 divide-y divide-[var(--st-border)] p-0">
        {initialArticles.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--st-text-secondary)]">
            <BookOpen className="mx-auto mb-2 h-7 w-7 opacity-50" aria-hidden />
            No articles yet.
          </div>
        ) : (
          initialArticles.map((a) => (
            <div key={a._id} className="flex items-center justify-between gap-3 p-4">
              <button onClick={() => openEdit(a)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">{a.title}</p>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {a.viewCount} views · {a.helpfulCount} helpful
                </p>
              </button>
              <Badge
                variant={
                  a.status === "published"
                    ? "default"
                    : a.status === "archived"
                      ? "outline"
                      : "secondary"
                }
                className="capitalize"
              >
                {a.status}
              </Badge>
              {a.status === "published" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handle(() => archiveKbArticle(a._id), "Archived")}
                >
                  Archive
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handle(() => publishKbArticle(a._id), "Published")}
                >
                  Publish
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void handle(() => deleteKbArticle(a._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit article" : "New article"}</DialogTitle>
          </DialogHeader>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="Body">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !title.trim() || !body.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await handle(
                  () => saveKbArticle({ id: editing?._id, portalId, title, body }),
                  "Saved",
                );
                setBusy(false);
                if (ok) setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
