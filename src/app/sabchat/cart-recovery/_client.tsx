"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Plus, ShoppingCart, Trash2, Zap } from "lucide-react";

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
  useToast,
} from "@/components/sabcrm/20ui";
import {
  deleteCartRule,
  saveCartRule,
  sweepCarts,
} from "@/app/actions/sabchat-cart-recovery.actions";
import type {
  SabChatCart,
  SabChatCartRule,
  SabChatCartTrigger,
} from "@/lib/rust-client/sabchat-cart-recovery";

const ACTIONS: { value: SabChatCartRule["action"]; label: string }[] = [
  { value: "open_widget", label: "Open the widget" },
  { value: "send_message", label: "Send a message" },
  { value: "send_coupon", label: "Send a coupon" },
];

function money(minor: number, ccy?: string): string {
  return `${ccy ?? "$"}${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function rel(iso?: string): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function CartRecoveryClient({
  initialRules,
  initialCarts,
  initialTriggers,
}: {
  initialRules: SabChatCartRule[];
  initialCarts: SabChatCart[];
  initialTriggers: SabChatCartTrigger[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = React.useTransition();
  const refresh = React.useCallback(() => startTransition(() => router.refresh()), [router]);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabChatCartRule | null>(null);
  const [name, setName] = React.useState("");
  const [idle, setIdle] = React.useState("30");
  const [minTotal, setMinTotal] = React.useState("");
  const [action, setAction] = React.useState<SabChatCartRule["action"]>("open_widget");
  const [busy, setBusy] = React.useState(false);
  const [sweeping, setSweeping] = React.useState(false);

  const openNew = () => {
    setEditing(null);
    setName("");
    setIdle("30");
    setMinTotal("");
    setAction("open_widget");
    setOpen(true);
  };
  const openEdit = (r: SabChatCartRule) => {
    setEditing(r);
    setName(r.name);
    setIdle(String(r.idleMinutes));
    setMinTotal(r.minTotalMinor ? String(r.minTotalMinor / 100) : "");
    setAction(r.action);
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const res = await saveCartRule({
      id: editing?._id,
      name,
      idleMinutes: Number(idle),
      minTotalMajor: minTotal ? Number(minTotal) : undefined,
      action,
      active: editing ? editing.active : true,
    });
    setBusy(false);
    if (res.ok) {
      toast({ title: editing ? "Rule saved" : "Rule created" });
      setOpen(false);
      refresh();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const del = async (id: string) => {
    const res = await deleteCartRule(id);
    if (res.ok) {
      toast({ title: "Rule deleted" });
      refresh();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const sweep = async () => {
    setSweeping(true);
    const res = await sweepCarts(false);
    setSweeping(false);
    if (res.ok) {
      toast({ title: "Sweep complete", description: `${res.scanned} scanned · ${res.fired} fired` });
      refresh();
    } else {
      toast({ title: "Sweep failed", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Cart recovery</PageTitle>
          <PageDescription>
            Win back abandoned carts — fire a widget nudge, a message, or a
            coupon when a shopper goes idle.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* Rules */}
      <div className="mt-6 mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">Recovery rules</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" iconLeft={Play} loading={sweeping} onClick={() => void sweep()}>
            Run sweep
          </Button>
          <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew}>
            New rule
          </Button>
        </div>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {initialRules.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No rules yet. Create one to start recovering abandoned carts.
          </p>
        ) : (
          initialRules.map((r) => (
            <div key={r._id} className="flex items-center justify-between gap-3 p-4">
              <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(r)}>
                <p className="text-sm font-medium text-[var(--st-text)]">{r.name}</p>
                <p className="truncate text-xs text-[var(--st-text-secondary)]">
                  idle {r.idleMinutes}m
                  {r.minTotalMinor ? ` · min ${money(r.minTotalMinor, r.payload?.currency as string)}` : ""}
                  {" · "}
                  {ACTIONS.find((a) => a.value === r.action)?.label ?? r.action}
                </p>
              </button>
              <Badge variant={r.active ? "default" : "outline"}>
                {r.active ? "Active" : "Paused"}
              </Badge>
              <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={() => void del(r._id)} />
            </div>
          ))
        )}
      </Card>

      {/* Abandoned carts */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">
        Abandoned carts{" "}
        <span className="text-xs font-normal text-[var(--st-text-secondary)]">· live</span>
      </h2>
      <Card className="p-0">
        {initialCarts.length === 0 ? (
          <p className="flex items-center justify-center gap-2 p-6 text-center text-sm text-[var(--st-text-secondary)]">
            <ShoppingCart className="h-4 w-4" aria-hidden /> No abandoned carts right now.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {initialCarts.map((c) => (
              <li key={c._id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--st-text)]">
                    {money(c.totalMinor, c.currency)}{" "}
                    <span className="text-xs font-normal text-[var(--st-text-secondary)]">
                      · {c.items.length} item{c.items.length === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-[var(--st-text-secondary)]">
                    {c.items.map((i) => i.name ?? i.sku).slice(0, 3).join(", ")}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--st-text-secondary)]">
                  {rel(c.lastEventAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Trigger log */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">Recent triggers</h2>
      <Card className="p-0">
        {initialTriggers.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No recovery actions fired yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {initialTriggers.map((t) => (
              <li key={t._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-[var(--st-text)]">
                  <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden /> {t.action}
                </span>
                <span className="text-xs text-[var(--st-text-secondary)]">{rel(t.firedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit rule" : "New recovery rule"}</DialogTitle>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="High-value carts" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Idle minutes">
              <Input type="number" min={1} value={idle} onChange={(e) => setIdle(e.target.value)} />
            </Field>
            <Field label="Min total ($, optional)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={minTotal}
                onChange={(e) => setMinTotal(e.target.value)}
                placeholder="any"
              />
            </Field>
          </div>
          <Field label="Action">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as SabChatCartRule["action"])}
              className="h-9 w-full rounded-md border border-[var(--st-border)] bg-transparent px-3 text-sm text-[var(--st-text)] outline-none focus:border-[var(--st-primary,var(--st-accent))]"
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim() || !idle}
              onClick={() => void save()}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
