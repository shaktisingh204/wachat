"use client";

import * as React from "react";
import {
  Check,
  Mail,
  Plus,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  X,
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
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  addScreenerSender,
  listSabmailScreener,
  setScreenerDecision,
  type SabmailScreenerDecision,
  type SabmailScreenerRow,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

type FilterTab = SabmailScreenerDecision;

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "denied", label: "Denied" },
];

const EMPTY: Record<FilterTab, { title: string; description: string }> = {
  pending: {
    title: "No one's waiting",
    description:
      "First-time senders land here for a one-time yes or no. Add someone manually to screen them ahead of time.",
  },
  approved: {
    title: "No approved senders yet",
    description: "Senders you let in will appear here. Approve from the Pending tab to build your allow-list.",
  },
  denied: {
    title: "No denied senders",
    description: "Senders you keep out will appear here. Deny from the Pending tab to build your block-list.",
  },
};

function decisionBadge(decision: SabmailScreenerDecision): React.ReactNode {
  if (decision === "approved") {
    return (
      <Badge variant="secondary">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Approved
      </Badge>
    );
  }
  if (decision === "denied") {
    return (
      <Badge variant="destructive">
        <ShieldX className="h-3.5 w-3.5" aria-hidden /> Denied
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <ShieldQuestion className="h-3.5 w-3.5" aria-hidden /> Pending
    </Badge>
  );
}

function initialFor(name: string | null, email: string): string {
  const src = (name?.trim() || email).trim();
  return src ? src[0]!.toUpperCase() : "?";
}

export function SabmailScreenerClient({
  initialSenders,
}: {
  initialSenders: SabmailScreenerRow[];
}) {
  const { toast } = useToast();

  const [tab, setTab] = React.useState<FilterTab>("pending");
  const [senders, setSenders] = React.useState<SabmailScreenerRow[]>(initialSenders);
  const [loading, setLoading] = React.useState(false);
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Manual-add dialog state.
  const [addOpen, setAddOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [addErr, setAddErr] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  // Whether the initial server-provided list (pending) has been shown.
  const loadedTabs = React.useRef<Set<FilterTab>>(new Set(["pending"]));

  const switchTab = React.useCallback(
    (next: FilterTab) => {
      if (next === tab) return;
      setTab(next);
      setLoading(true);
      startTransition(async () => {
        const rows = await listSabmailScreener(next);
        loadedTabs.current.add(next);
        setSenders(rows);
        setLoading(false);
      });
    },
    [tab],
  );

  const resetAdd = React.useCallback(() => {
    setEmail("");
    setName("");
    setAddErr(null);
  }, []);

  const handleAdd = React.useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setAddErr("Email is required.");
      return;
    }
    setAdding(true);
    setAddErr(null);
    const res = await addScreenerSender({
      email: trimmed,
      name: name.trim() || undefined,
    });
    if (!res.ok) {
      setAddErr(res.error);
      setAdding(false);
      return;
    }
    toast({ title: "Sender added to the screener" });
    setAdding(false);
    setAddOpen(false);
    resetAdd();
    // A manual add is always pending — fold it into the pending view.
    if (tab === "pending") {
      setSenders((prev) => {
        const without = prev.filter((s) => s.email !== res.sender.email);
        return [res.sender, ...without];
      });
    } else {
      switchTab("pending");
    }
  }, [email, name, tab, toast, resetAdd, switchTab]);

  const decide = React.useCallback(
    async (sender: SabmailScreenerRow, decision: SabmailScreenerDecision) => {
      setPendingEmail(sender.email);
      const res = await setScreenerDecision(sender.email, decision);
      setPendingEmail(null);
      if (!res.ok) {
        toast({
          title: "Could not save the decision",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      // The row leaves the current tab once it no longer matches the filter.
      setSenders((prev) => prev.filter((s) => s.email !== sender.email));
      toast({
        title: decision === "approved" ? "Sender approved" : "Sender denied",
        description:
          decision === "approved"
            ? `${sender.email} can now reach your inbox.`
            : `${sender.email} will be kept out.`,
      });
    },
    [toast],
  );

  const showSkeletonState = (loading || isPending) && senders.length === 0;
  const empty = EMPTY[tab];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Screener</PageTitle>
          <PageDescription>
            A one-time yes or no for first-time senders, HEY-style. Approve the
            people you want; deny the rest — once. Approved/denied decisions
            gate inbound once the sync engine binds live mail.
          </PageDescription>
        </PageHeaderHeading>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => {
              resetAdd();
              setAddOpen(true);
            }}
          >
            Add sender
          </Button>
        </div>
      </PageHeader>

      {/* Filter tabs */}
      <div
        className="mt-6 inline-flex items-center gap-1 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-1"
        role="tablist"
        aria-label="Filter senders by decision"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(t.id)}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--st-bg)] text-[var(--st-text)] shadow-sm"
                  : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {tab === "pending"
                ? "Waiting on you"
                : tab === "approved"
                  ? "Approved senders"
                  : "Denied senders"}
            </CardTitle>
            <CardDescription>
              {showSkeletonState
                ? "Loading…"
                : `${senders.length} sender${senders.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardBody>
            {showSkeletonState ? (
              <div className="space-y-2" aria-busy>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-[58px] items-center rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]"
                    aria-hidden
                  />
                ))}
              </div>
            ) : senders.length === 0 ? (
              <EmptyState
                icon={<Mail aria-hidden />}
                title={empty.title}
                description={empty.description}
                action={
                  tab === "pending" ? (
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={Plus}
                      onClick={() => {
                        resetAdd();
                        setAddOpen(true);
                      }}
                    >
                      Add sender
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="sabmail-motion space-y-2">
                {senders.map((s, idx) => {
                  const busy = pendingEmail === s.email;
                  return (
                    <div
                      key={s.id}
                      className="sabmail-stagger-item flex items-center justify-between gap-3 rounded-md border border-[var(--st-border)] px-3 py-2.5"
                      style={{ ["--i" as string]: idx } as React.CSSProperties}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-sm font-medium text-[var(--st-text-secondary)]"
                          aria-hidden
                        >
                          {initialFor(s.name, s.email)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-[var(--st-text)]">
                              {s.name ?? s.email}
                            </span>
                            {s.decision !== "pending" ? decisionBadge(s.decision) : null}
                          </div>
                          <span className="block truncate text-xs text-[var(--st-text-secondary)]">
                            {s.name ? s.email : "First-time sender"}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {tab !== "approved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Check}
                            loading={busy}
                            disabled={busy}
                            onClick={() => void decide(s, "approved")}
                          >
                            Approve
                          </Button>
                        ) : null}
                        {tab !== "denied" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={X}
                            disabled={busy}
                            onClick={() => void decide(s, "denied")}
                          >
                            Deny
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Manual add */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add sender to screener</DialogTitle>
            <DialogDescription>
              Queue someone for a one-time approve / deny decision before they
              ever reach your inbox.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field label="Email" error={addErr ?? undefined}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sender@example.com"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !adding) {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
            </Field>
            <Field label="Name (optional)">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={adding}
              disabled={adding || !email.trim()}
              onClick={() => void handleAdd()}
            >
              Add sender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
