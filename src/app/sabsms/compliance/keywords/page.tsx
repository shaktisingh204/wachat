"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  SabsmsPageShell,
  SabsmsDataTable,
  SabsmsEmpty,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Input,
  Label,
  Badge,
  StatCard,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/sabcrm/20ui";
import {
  Key,
  ShieldCheck,
  ShieldAlert,
  Settings,
  MessageSquare,
  X,
  Plus,
  Info,
  Trash,
} from "lucide-react";
import { toast } from "sonner";

import {
  ENGINE_DEFAULTS,
  loadKeywordsPage,
  saveKeywordOverride,
  saveKeywordRule,
  deleteKeywordRule,
  type KeywordsPageData,
  type KeywordOverrideView,
  type KeywordRuleView,
} from "./actions";

type View = "stop-help" | "rules" | "stats";

function KeywordChips({
  values,
  onRemove,
  defaults,
}: {
  values: string[];
  onRemove: (v: string) => void;
  defaults: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {defaults.map((d) => (
        <Badge
          key={`def-${d}`}
          variant="outline"
          className="font-mono bg-[var(--st-bg-muted)]/40 text-[var(--st-text-secondary)]"
          title="Built-in engine default (always active, cannot be removed)"
        >
          {d}
        </Badge>
      ))}
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="font-mono gap-1.5">
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onRemove(v)}
            className="opacity-60 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {values.length === 0 && (
        <span className="text-xs text-[var(--st-text-secondary)] italic self-center">
          No custom synonyms — engine defaults above still apply.
        </span>
      )}
    </div>
  );
}

const RULE_ACTION_LABEL: Record<KeywordRuleView["action"], string> = {
  reply: "Auto-reply",
  opt_out: "Opt-out",
  opt_in: "Opt-in",
  tag: "Tag",
};

export default function KeywordsPage() {
  const [view, setView] = useState<View>("stop-help");
  const [data, setData] = useState<KeywordsPageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // editable override draft
  const [override, setOverride] = useState<KeywordOverrideView>({
    stopKeywords: [],
    helpKeywords: [],
    confirmOptOutText: "",
    helpText: "",
  });
  const [newStop, setNewStop] = useState("");
  const [newHelp, setNewHelp] = useState("");

  // rule dialog
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<KeywordRuleView | null>(null);
  const [ruleDraft, setRuleDraft] = useState<{
    keyword: string;
    match: KeywordRuleView["match"];
    action: KeywordRuleView["action"];
    replyText: string;
    tag: string;
    enabled: boolean;
  }>({ keyword: "", match: "exact", action: "reply", replyText: "", tag: "", enabled: true });

  const refresh = React.useCallback(() => {
    loadKeywordsPage().then((res) => {
      if (res.success) {
        setData(res.data);
        setOverride(res.data.override);
        setLoadError(null);
      } else {
        setLoadError(res.error);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addStop = () => {
    const v = newStop.trim().toUpperCase();
    if (v && !override.stopKeywords.includes(v)) {
      setOverride((o) => ({ ...o, stopKeywords: [...o.stopKeywords, v] }));
    }
    setNewStop("");
  };
  const addHelp = () => {
    const v = newHelp.trim().toUpperCase();
    if (v && !override.helpKeywords.includes(v)) {
      setOverride((o) => ({ ...o, helpKeywords: [...o.helpKeywords, v] }));
    }
    setNewHelp("");
  };

  const handleSaveOverride = () => {
    startTransition(async () => {
      const res = await saveKeywordOverride({
        stopKeywords: override.stopKeywords,
        helpKeywords: override.helpKeywords,
        confirmOptOutText: override.confirmOptOutText,
        helpText: override.helpText,
      });
      if (res.success) {
        setOverride(res.override);
        toast.success("Custom keywords saved — the engine now uses them on inbound replies.");
        refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const openNewRule = () => {
    setEditingRule(null);
    setRuleDraft({ keyword: "", match: "exact", action: "reply", replyText: "", tag: "", enabled: true });
    setRuleDialogOpen(true);
  };
  const openEditRule = (r: KeywordRuleView) => {
    setEditingRule(r);
    setRuleDraft({
      keyword: r.keyword,
      match: r.match,
      action: r.action,
      replyText: r.replyText ?? "",
      tag: r.tag ?? "",
      enabled: r.enabled,
    });
    setRuleDialogOpen(true);
  };
  const handleSaveRule = () => {
    startTransition(async () => {
      const res = await saveKeywordRule({
        id: editingRule?.id,
        keyword: ruleDraft.keyword,
        match: ruleDraft.match,
        action: ruleDraft.action,
        replyText: ruleDraft.replyText,
        tag: ruleDraft.tag,
        enabled: ruleDraft.enabled,
      });
      if (res.success) {
        toast.success("Rule saved (stored — per-keyword enforcement coming soon).");
        setRuleDialogOpen(false);
        refresh();
      } else {
        toast.error(res.error);
      }
    });
  };
  const handleDeleteRule = (r: KeywordRuleView) => {
    startTransition(async () => {
      const res = await deleteKeywordRule(r.id);
      if (res.success) {
        toast.success("Rule deleted.");
        refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const ruleColumns: SabsmsColumn<KeywordRuleView>[] = [
    {
      id: "keyword",
      header: "Keyword",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-mono font-semibold">{r.keyword}</span>
          <span className="text-xs text-[var(--st-text-secondary)]">
            {r.match} match
          </span>
        </div>
      ),
    },
    {
      id: "action",
      header: "Action",
      render: (r) => <Badge variant="outline">{RULE_ACTION_LABEL[r.action]}</Badge>,
    },
    {
      id: "detail",
      header: "Reply / Tag",
      render: (r) => (
        <span className="text-sm text-[var(--st-text-secondary)]">
          {r.action === "reply" ? r.replyText || "—" : r.action === "tag" ? r.tag || "—" : "—"}
        </span>
      ),
    },
    {
      id: "enabled",
      header: "Enabled",
      render: (r) => (
        <Badge variant={r.enabled ? "secondary" : "outline"}>
          {r.enabled ? "On" : "Off"}
        </Badge>
      ),
    },
  ];

  const ruleActions: SabsmsRowAction<KeywordRuleView>[] = [
    { label: "Edit", icon: <Settings className="h-4 w-4" />, onSelect: openEditRule },
    { label: "Delete", icon: <Trash className="h-4 w-4" />, destructive: true, onSelect: handleDeleteRule },
  ];

  return (
    <SabsmsPageShell
      title="STOP / HELP Keywords"
      eyebrow="Compliance"
      description="Custom STOP/HELP synonyms and the auto-reply text the inbound engine sends. These genuinely change engine behaviour."
      breadcrumbs={[
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "Keywords" },
      ]}
      primaryAction={{
        label: "Add reply rule",
        onClick: openNewRule,
      }}
      helpTitle="Keyword Management"
      helpBody="The engine's built-in STOP/START/HELP keywords are always active. Here you ADD custom synonyms and override the STOP confirmation + HELP auto-reply text the engine sends. Per-keyword reply rules are stored but not yet enforced."
    >
      <div className="mb-6 flex gap-2 overflow-x-auto">
        <Button variant={view === "stop-help" ? "default" : "outline"} onClick={() => setView("stop-help")}>
          <Key className="mr-2 h-4 w-4" /> STOP / HELP config
        </Button>
        <Button variant={view === "rules" ? "default" : "outline"} onClick={() => setView("rules")}>
          <MessageSquare className="mr-2 h-4 w-4" /> Reply rules
        </Button>
        <Button variant={view === "stats" ? "default" : "outline"} onClick={() => setView("stats")}>
          <ShieldAlert className="mr-2 h-4 w-4" /> Activity
        </Button>
      </div>

      {loadError && (
        <Card className="mb-6">
          <CardBody>
            <p className="text-sm text-[var(--st-text)]">{loadError}</p>
          </CardBody>
        </Card>
      )}

      {view === "stop-help" && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 p-4 text-sm">
            <Info className="h-5 w-5 shrink-0 text-[var(--st-text-secondary)]" />
            <p className="text-[var(--st-text-secondary)]">
              The engine always honours its built-in keywords (shown as muted
              chips). Anything you add here is merged on top. Leaving an
              auto-reply blank falls back to the engine default.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> STOP (opt-out) keywords
              </CardTitle>
              <CardDescription>
                Inbound messages matching any of these suppress the contact.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <KeywordChips
                values={override.stopKeywords}
                defaults={ENGINE_DEFAULTS.stop}
                onRemove={(v) =>
                  setOverride((o) => ({
                    ...o,
                    stopKeywords: o.stopKeywords.filter((k) => k !== v),
                  }))
                }
              />
              <div className="flex gap-2 max-w-sm">
                <Input
                  placeholder="Add synonym e.g. ARRET"
                  value={newStop}
                  onChange={(e) => setNewStop(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStop())}
                />
                <Button type="button" variant="outline" onClick={addStop}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>STOP confirmation auto-reply</Label>
                <Textarea
                  rows={2}
                  placeholder={ENGINE_DEFAULTS.confirmOptOutText}
                  value={override.confirmOptOutText}
                  onChange={(e) =>
                    setOverride((o) => ({ ...o, confirmOptOutText: e.target.value }))
                  }
                />
                <p className="text-xs text-[var(--st-text-secondary)]">
                  Sent automatically when a STOP fires. Blank → engine default.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> HELP keywords
              </CardTitle>
              <CardDescription>
                Inbound messages matching any of these send the HELP auto-reply.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <KeywordChips
                values={override.helpKeywords}
                defaults={ENGINE_DEFAULTS.help}
                onRemove={(v) =>
                  setOverride((o) => ({
                    ...o,
                    helpKeywords: o.helpKeywords.filter((k) => k !== v),
                  }))
                }
              />
              <div className="flex gap-2 max-w-sm">
                <Input
                  placeholder="Add synonym e.g. SUPPORT"
                  value={newHelp}
                  onChange={(e) => setNewHelp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHelp())}
                />
                <Button type="button" variant="outline" onClick={addHelp}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>HELP auto-reply</Label>
                <Textarea
                  rows={2}
                  placeholder={ENGINE_DEFAULTS.helpText}
                  value={override.helpText}
                  onChange={(e) => setOverride((o) => ({ ...o, helpText: e.target.value }))}
                />
                <p className="text-xs text-[var(--st-text-secondary)]">
                  Sent automatically when a HELP fires. Blank → engine default.
                </p>
              </div>
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveOverride} disabled={isPending}>
              {isPending ? "Saving…" : "Save custom keywords"}
            </Button>
          </div>
        </div>
      )}

      {view === "rules" && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Per-keyword reply rules</CardTitle>
              <CardDescription className="mt-1">
                <Badge variant="outline" className="mr-2">
                  Saved — enforcement coming soon
                </Badge>
                Stored on the workspace. The engine does not yet fire per-keyword
                auto-replies for these, so they will not send until support ships.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openNewRule}>
              <Plus className="mr-2 h-4 w-4" /> New rule
            </Button>
          </CardHeader>
          <CardBody>
            {data && data.rules.length === 0 ? (
              <SabsmsEmpty
                title="No reply rules yet"
                description="Add a rule to define a custom auto-reply or tag for a keyword. Note these are stored only until per-keyword enforcement ships."
                action={{ label: "New rule", onClick: openNewRule }}
              />
            ) : (
              <SabsmsDataTable
                rowKey={(r) => r.id}
                rows={data?.rules ?? []}
                columns={ruleColumns}
                rowActions={ruleActions}
                loading={!data && !loadError}
              />
            )}
          </CardBody>
        </Card>
      )}

      {view === "stats" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="STOP suppressions"
              value={data ? data.stats.stopSuppressions.toLocaleString() : "…"}
            />
            <StatCard
              label="Inbound-keyword opt-outs"
              value={data ? data.stats.inboundKeywordOptOuts.toLocaleString() : "…"}
            />
            <StatCard
              label="Stored reply rules"
              value={data ? data.stats.storedRules.toLocaleString() : "…"}
            />
          </div>
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--st-text-secondary)]">
                STOP suppressions count rows in <code>sabsms_suppressions</code>{" "}
                with source <code>stop</code>. Inbound-keyword opt-outs count
                <code> sabsms_consent_log</code> events captured via{" "}
                <code>inbound_keyword</code> — both written by the engine's
                interceptor. These are real counts, not estimates.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Rule editor dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit reply rule" : "New reply rule"}</DialogTitle>
            <DialogDescription>
              Stored on the workspace. Per-keyword auto-reply enforcement is not
              live yet — this rule will not fire until it ships.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Keyword</Label>
              <Input
                placeholder="e.g. BALANCE"
                value={ruleDraft.keyword}
                onChange={(e) => setRuleDraft((d) => ({ ...d, keyword: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Match</Label>
                <Select
                  value={ruleDraft.match}
                  onValueChange={(v) =>
                    setRuleDraft((d) => ({ ...d, match: v as KeywordRuleView["match"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="starts_with">Starts with</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select
                  value={ruleDraft.action}
                  onValueChange={(v) =>
                    setRuleDraft((d) => ({ ...d, action: v as KeywordRuleView["action"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reply">Auto-reply</SelectItem>
                    <SelectItem value="opt_out">Opt-out</SelectItem>
                    <SelectItem value="opt_in">Opt-in</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {ruleDraft.action === "reply" && (
              <div className="space-y-2">
                <Label>Reply text</Label>
                <Textarea
                  rows={3}
                  value={ruleDraft.replyText}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, replyText: e.target.value }))}
                />
              </div>
            )}
            {ruleDraft.action === "tag" && (
              <div className="space-y-2">
                <Label>Tag</Label>
                <Input
                  value={ruleDraft.tag}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, tag: e.target.value }))}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="rule-enabled">Enabled</Label>
              <Switch
                id="rule-enabled"
                checked={ruleDraft.enabled}
                onCheckedChange={(c) => setRuleDraft((d) => ({ ...d, enabled: c }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={isPending}>
              {isPending ? "Saving…" : "Save rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
