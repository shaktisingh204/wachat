"use client";

import * as React from "react";
import { Plus, Trash2, Users, Sparkles, Tag, Globe, AtSign } from "lucide-react";

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
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  createSabmailSegment,
  deleteSabmailSegment,
  previewSegment,
  type SabmailSegmentRow,
  type SabmailSegmentRule,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

/* ── helpers ──────────────────────────────────────────────────────────── */

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

/** A short, human description of a segment's rule for the list rows. */
function describeRule(rule: SabmailSegmentRule): string {
  const parts: string[] = [];
  if (rule.tagsAny?.length) parts.push(`tagged ${rule.tagsAny.join(" / ")}`);
  if (rule.domain) parts.push(`@${rule.domain}`);
  if (rule.emailContains) parts.push(`email contains “${rule.emailContains}”`);
  return parts.length ? parts.join(" · ") : "Everyone in this workspace";
}

interface PreviewState {
  loading: boolean;
  count: number | null;
  sample: string[];
  error: string | null;
}

const EMPTY_PREVIEW: PreviewState = {
  loading: false,
  count: null,
  sample: [],
  error: null,
};

/* ── create dialog ────────────────────────────────────────────────────── */

function CreateSegmentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (segment: SabmailSegmentRow) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [contains, setContains] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewState>(EMPTY_PREVIEW);

  const buildRule = React.useCallback(
    (): SabmailSegmentRule => ({
      tagsAny: parseTags(tags),
      domain: domain.trim(),
      emailContains: contains.trim(),
    }),
    [tags, domain, contains],
  );

  // Reset the form each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setName("");
      setTags("");
      setDomain("");
      setContains("");
      setNameError(null);
      setSaving(false);
      setPreview(EMPTY_PREVIEW);
    }
  }, [open]);

  // Debounced live preview as the rule changes.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreview((p) => ({ ...p, loading: true, error: null }));
    const handle = setTimeout(() => {
      void previewSegment(buildRule()).then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setPreview({ loading: false, count: res.count, sample: res.sample, error: null });
        } else {
          setPreview({ loading: false, count: null, sample: [], error: res.error });
        }
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, buildRule]);

  const submit = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Give the segment a name.");
      return;
    }
    setNameError(null);
    setSaving(true);
    const res = await createSabmailSegment({ name: trimmed, rule: buildRule() });
    setSaving(false);
    if (!res.ok) {
      toast({ title: "Could not save segment", description: res.error, variant: "destructive" });
      return;
    }
    onCreated(res.segment);
    onOpenChange(false);
    toast({ title: "Segment created" });
  }, [name, buildRule, toast, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New segment</DialogTitle>
          <DialogDescription>
            Build an audience from your contacts. Combine any of the filters below —
            a contact matches when it satisfies all of them.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <Field label="Name" error={nameError ?? undefined}>
            <Input
              value={name}
              placeholder="e.g. Active customers"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="Has any of these tags" help="Comma-separated. Matches contacts carrying any one.">
            <Input
              value={tags}
              placeholder="vip, trial, newsletter"
              onChange={(e) => setTags(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email domain" help="Matches @domain">
              <Input
                value={domain}
                placeholder="acme.com"
                onChange={(e) => setDomain(e.target.value)}
              />
            </Field>
            <Field label="Email contains">
              <Input
                value={contains}
                placeholder="support"
                onChange={(e) => setContains(e.target.value)}
              />
            </Field>
          </div>

          {/* Live preview */}
          <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
              <Sparkles className="h-4 w-4 text-[var(--st-accent)]" aria-hidden />
              Preview
              {preview.loading ? (
                <span className="text-xs font-normal text-[var(--st-text-secondary)]">
                  resolving…
                </span>
              ) : preview.count != null ? (
                <Badge variant="secondary">
                  {preview.count.toLocaleString()} contact{preview.count === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            {preview.error ? (
              <p className="mt-1.5 text-xs text-[var(--st-status-err,#dc2626)]">{preview.error}</p>
            ) : preview.sample.length ? (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {preview.sample.map((email) => (
                  <li
                    key={email}
                    className="truncate rounded bg-[var(--st-bg)] px-1.5 py-0.5 text-xs text-[var(--st-text-secondary)]"
                  >
                    {email}
                  </li>
                ))}
              </ul>
            ) : !preview.loading && preview.count === 0 ? (
              <p className="mt-1.5 text-xs text-[var(--st-text-secondary)]">
                No contacts match these filters yet.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            loading={saving}
            disabled={saving}
            onClick={() => void submit()}
          >
            Create segment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── list client ──────────────────────────────────────────────────────── */

export function SabmailSegmentsClient({
  initialSegments,
}: {
  initialSegments: SabmailSegmentRow[];
}) {
  const { toast } = useToast();
  const [segments, setSegments] = React.useState<SabmailSegmentRow[]>(initialSegments);
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const remove = React.useCallback(
    async (id: string) => {
      setDeletingId(id);
      const res = await deleteSabmailSegment(id);
      setDeletingId(null);
      if (!res.ok) {
        toast({ title: "Could not delete", description: res.error, variant: "destructive" });
        return;
      }
      setSegments((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Segment deleted" });
    },
    [toast],
  );

  return (
    <div className="sabmail-canvas min-h-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--st-text)]">Segments</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--st-text-secondary)]">
              Saved audiences built from your contacts. Filter by tag, email domain,
              or substring — then target them from a campaign.
            </p>
          </div>
          <Button variant="primary" size="sm" iconLeft={Plus} className="shrink-0" onClick={() => setCreating(true)}>
            New segment
          </Button>
        </div>

        <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Audiences</CardTitle>
            <CardDescription>{segments.length} total</CardDescription>
          </CardHeader>
          <CardBody>
            {segments.length === 0 ? (
              <EmptyState
                icon={<Users aria-hidden />}
                title="No segments yet"
                description="Create your first segment to slice your contacts into a targetable audience."
                action={
                  <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setCreating(true)}>
                    New segment
                  </Button>
                }
              />
            ) : (
              <ul className="sabmail-motion flex flex-col gap-2">
                {segments.map((s, idx) => (
                  <li
                    key={s.id}
                    data-selected={false}
                    className="sabmail-stagger-item sabmail-listrow flex items-center justify-between gap-3 rounded-lg border border-[var(--st-border)] px-3 py-2.5 hover:bg-[var(--st-bg-muted)]"
                    style={{ ["--i" as string]: idx } as React.CSSProperties}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        <Users className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--st-text)]">
                          {s.name}
                        </div>
                        <div className="truncate text-xs text-[var(--st-text-secondary)]">
                          {describeRule(s.rule)}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.rule.tagsAny?.length ? (
                        <Badge variant="outline" className="hidden sm:inline-flex">
                          <Tag className="mr-1 h-3 w-3" aria-hidden />
                          {s.rule.tagsAny.length} tag{s.rule.tagsAny.length === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                      {s.rule.domain ? (
                        <Badge variant="outline" className="hidden sm:inline-flex">
                          <Globe className="mr-1 h-3 w-3" aria-hidden />
                          {s.rule.domain}
                        </Badge>
                      ) : null}
                      {s.rule.emailContains ? (
                        <Badge variant="outline" className="hidden sm:inline-flex">
                          <AtSign className="mr-1 h-3 w-3" aria-hidden />
                          {s.rule.emailContains}
                        </Badge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        loading={deletingId === s.id}
                        disabled={deletingId === s.id}
                        onClick={() => void remove(s.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

        <CreateSegmentDialog
          open={creating}
          onOpenChange={setCreating}
          onCreated={(segment) => setSegments((prev) => [segment, ...prev])}
        />
      </div>
    </div>
  );
}
