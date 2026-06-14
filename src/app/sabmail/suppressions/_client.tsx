"use client";

import * as React from "react";
import { Plus, ShieldBan, Trash2 } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
  type BadgeVariant,
} from "@/components/sabcrm/20ui";

import {
  addSuppressionManual,
  listSabmailSuppressions,
  removeSuppression,
} from "./actions";
import type { SabmailSuppressionRaw } from "@/lib/sabmail/suppressions";
import "@/components/sabmail/motion/sabmail-motion.css";

const REASON_VARIANT: Record<string, BadgeVariant> = {
  bounce: "destructive",
  complaint: "destructive",
  unsubscribe: "secondary",
  manual: "outline",
};

const REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "manual", label: "Manual block" },
  { value: "bounce", label: "Bounce" },
  { value: "complaint", label: "Complaint" },
  { value: "unsubscribe", label: "Unsubscribe" },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SabmailSuppressionsClient({
  initialSuppressions,
}: {
  initialSuppressions: SabmailSuppressionRaw[];
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SabmailSuppressionRaw[]>(initialSuppressions);
  const [adding, setAdding] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [reason, setReason] = React.useState("manual");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [removingEmail, setRemovingEmail] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const res = await listSabmailSuppressions();
    if (res.ok) setRows(res.suppressions);
  }, []);

  const openDialog = React.useCallback(() => {
    setEmail("");
    setReason("manual");
    setEmailError(null);
    setAdding(true);
  }, []);

  const submit = React.useCallback(async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setEmailError("Enter an email address.");
      return;
    }
    setSubmitting(true);
    setEmailError(null);
    const res = await addSuppressionManual(normalized, reason);
    setSubmitting(false);
    if (!res.ok) {
      setEmailError(res.error);
      return;
    }
    setAdding(false);
    toast({ title: "Address suppressed", description: normalized });
    await refresh();
  }, [email, reason, refresh, toast]);

  const remove = React.useCallback(
    async (addr: string) => {
      setRemovingEmail(addr);
      const res = await removeSuppression(addr);
      setRemovingEmail(null);
      if (!res.ok) {
        toast({ title: "Could not remove", description: res.error, variant: "destructive" });
        return;
      }
      setRows((prev) => prev.filter((r) => r.email !== addr));
      toast({ title: "Removed from suppression list" });
    },
    [toast],
  );

  return (
    <div className="sabmail-canvas min-h-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Suppressions</PageTitle>
          <PageDescription>
            Addresses SabMail will never email. Hard bounces and complaints land
            here automatically — block an address manually any time, or remove
            one to re-enable sending.
          </PageDescription>
        </PageHeaderHeading>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openDialog}>
          Add suppression
        </Button>
      </PageHeader>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Suppressed addresses</CardTitle>
            <CardDescription>{rows.length} total</CardDescription>
          </CardHeader>
          <CardBody>
            {rows.length === 0 ? (
              <EmptyState
                icon={<ShieldBan aria-hidden />}
                title="No suppressed addresses"
                description="Bounces and complaints will appear here. You can also block an address manually."
                action={
                  <Button variant="primary" size="sm" iconLeft={Plus} onClick={openDialog}>
                    Add suppression
                  </Button>
                }
              />
            ) : (
              <div className="sabmail-motion overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Email</Th>
                      <Th>Reason</Th>
                      <Th>Source</Th>
                      <Th>Added</Th>
                      <Th className="text-right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {rows.map((r, idx) => (
                      <Tr
                        key={r.email}
                        className="sabmail-stagger-item"
                        style={{ ["--i" as string]: idx } as React.CSSProperties}
                      >
                        <Td>
                          <span
                            className="block max-w-[260px] truncate text-sm text-[var(--st-text)]"
                            title={r.email}
                          >
                            {r.email}
                          </span>
                        </Td>
                        <Td>
                          <Badge
                            variant={REASON_VARIANT[r.reason] ?? "outline"}
                            className="capitalize"
                          >
                            {r.reason}
                          </Badge>
                        </Td>
                        <Td>
                          <span className="text-sm capitalize text-[var(--st-text-secondary)]">
                            {r.source}
                          </span>
                        </Td>
                        <Td>
                          <span className="whitespace-nowrap text-sm text-[var(--st-text-secondary)]">
                            {formatWhen(r.createdAt)}
                          </span>
                        </Td>
                        <Td className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={Trash2}
                            loading={removingEmail === r.email}
                            disabled={removingEmail === r.email}
                            onClick={() => void remove(r.email)}
                          >
                            Remove
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add suppression</DialogTitle>
            <DialogDescription>
              Block an address so SabMail never sends to it again.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <Field label="Email address" error={emailError ?? undefined}>
              <Input
                type="email"
                value={email}
                placeholder="person@example.com"
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
            </Field>
            <Field label="Reason">
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdding(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={submitting}
              onClick={() => void submit()}
            >
              Add suppression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
