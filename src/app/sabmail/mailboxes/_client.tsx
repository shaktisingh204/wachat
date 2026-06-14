"use client";

import * as React from "react";
import {
  AlertCircle,
  AtSign,
  CheckCircle2,
  Copy,
  KeyRound,
  Mailbox,
  PauseCircle,
  PlayCircle,
  Plus,
  ServerOff,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Callout,
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
  SelectField,
  Switch,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  useToast,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { renderIcon } from "@/components/sabcrm/20ui/_icon";
import { CreatingOverlay, SuccessCheck } from "@/components/sabmail/motion";
import {
  deleteSabmailHostedMailbox,
  provisionSabmailHostedMailbox,
  resetSabmailHostedMailboxPassword,
  setSabmailHostedMailboxStatus,
  type SabmailHostedMailboxRow,
} from "../accounts/hosted-actions";
import "@/components/sabmail/motion/sabmail-motion.css";

export interface VerifiedDomainOption {
  domain: string;
}

/* ── status pill ──────────────────────────────────────────────────────── */

type AccountStatus = SabmailHostedMailboxRow["status"];

const STATUS_META: Record<
  string,
  { label: string; variant: "success" | "destructive" | "secondary" | "outline"; Icon: typeof CheckCircle2 }
> = {
  active: { label: "Active", variant: "success", Icon: CheckCircle2 },
  disconnected: { label: "Suspended", variant: "secondary", Icon: PauseCircle },
  error: { label: "Error", variant: "destructive", Icon: AlertCircle },
  pending: { label: "Pending", variant: "outline", Icon: AlertCircle },
};

function StatusPill({ status }: { status: AccountStatus }) {
  const meta = STATUS_META[status] ?? {
    label: String(status),
    variant: "outline" as const,
    Icon: AlertCircle,
  };
  const Icon = meta.Icon;
  return (
    <Badge variant={meta.variant} className="shrink-0 gap-1">
      <Icon className="h-3 w-3" aria-hidden /> {meta.label}
    </Badge>
  );
}

/* ── one-time password callout ────────────────────────────────────────── */

function PasswordReveal({ password, onCopy }: { password: string; onCopy: () => void }) {
  return (
    <Callout tone="warning" title="Save this password now" icon={ShieldAlert}>
      <span className="block text-xs">
        It won&apos;t be shown again. Copy it into your mail client (IMAP &amp; SMTP).
      </span>
      <div className="mt-2 flex items-center gap-2">
        <code className="select-all break-all rounded-md bg-[var(--st-bg-muted)] px-2 py-1 font-mono text-xs text-[var(--st-text)]">
          {password}
        </code>
        <Button variant="outline" size="sm" iconLeft={Copy} onClick={onCopy}>
          Copy
        </Button>
      </div>
    </Callout>
  );
}

/* ── disabled (not configured) state ──────────────────────────────────── */

function HostedNotConfigured() {
  return (
    <div className="sabmail-canvas min-h-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[var(--st-text)]">
            Hosted mailboxes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--st-text-secondary)]">
            Create real mailboxes on your own verified domains, hosted on the
            SabMail mail server.
          </p>
        </div>

        <Card className="mt-6 p-10">
          <EmptyState
            icon={<ServerOff aria-hidden />}
            tone="warning"
            title="Hosted mail isn't set up yet"
            description="An admin must connect the mail server before you can create hosted mailboxes. Once the Stalwart mail server is configured, this page lets you provision mailboxes on your verified domains."
          />
        </Card>
      </div>
    </div>
  );
}

/* ── main client ──────────────────────────────────────────────────────── */

export function SabmailMailboxesClient({
  hostedEnabled,
  initialMailboxes,
  verifiedDomains,
  loadError,
}: {
  hostedEnabled: boolean;
  initialMailboxes: SabmailHostedMailboxRow[];
  verifiedDomains: VerifiedDomainOption[];
  loadError: string | null;
}) {
  const { toast } = useToast();

  const [mailboxes, setMailboxes] =
    React.useState<SabmailHostedMailboxRow[]>(initialMailboxes);

  // Create form state.
  const [open, setOpen] = React.useState(false);
  const [localPart, setLocalPart] = React.useState("");
  const [domain, setDomain] = React.useState<string | null>(
    verifiedDomains[0]?.domain ?? null,
  );
  const [displayName, setDisplayName] = React.useState("");
  const [quotaMb, setQuotaMb] = React.useState("");
  const [autoGenerate, setAutoGenerate] = React.useState(true);
  const [password, setPassword] = React.useState("");
  const [formErr, setFormErr] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);

  // One-time generated password reveal (post-create or post-reset).
  const [revealed, setRevealed] = React.useState<{ email: string; password: string } | null>(
    null,
  );

  // Per-row busy flags.
  const [resettingId, setResettingId] = React.useState<string | null>(null);
  const [statusId, setStatusId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Delete confirm.
  const [confirmDelete, setConfirmDelete] =
    React.useState<SabmailHostedMailboxRow | null>(null);

  const domainOptions = React.useMemo<SelectOption[]>(
    () => verifiedDomains.map((d) => ({ value: d.domain, label: d.domain })),
    [verifiedDomains],
  );

  const copyToClipboard = React.useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        toast({ title: "Copied", description: "Password copied to clipboard." });
      } catch {
        toast({
          title: "Couldn't copy",
          description: "Copy the password manually.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const resetForm = React.useCallback(() => {
    setLocalPart("");
    setDomain(verifiedDomains[0]?.domain ?? null);
    setDisplayName("");
    setQuotaMb("");
    setAutoGenerate(true);
    setPassword("");
    setFormErr(null);
  }, [verifiedDomains]);

  /* ── create ─────────────────────────────────────────────────────────── */
  const handleCreate = React.useCallback(async () => {
    const lp = localPart.trim().toLowerCase();
    if (!lp) {
      setFormErr("Enter the part before the @.");
      return;
    }
    if (!domain) {
      setFormErr("Pick a verified domain.");
      return;
    }
    if (!autoGenerate && !password.trim()) {
      setFormErr("Enter a password or switch on auto-generate.");
      return;
    }

    const quotaNum = quotaMb.trim() ? Number(quotaMb.trim()) : undefined;
    if (quotaNum !== undefined && (!Number.isFinite(quotaNum) || quotaNum <= 0)) {
      setFormErr("Quota must be a positive number of MB, or leave it blank.");
      return;
    }

    setCreating(true);
    setFormErr(null);

    const res = await provisionSabmailHostedMailbox({
      localPart: lp,
      domain,
      displayName: displayName.trim() || undefined,
      password: autoGenerate ? undefined : password.trim(),
      quotaMb: quotaNum,
    });

    setCreating(false);

    if (!res.ok) {
      setFormErr(res.error);
      return;
    }

    setMailboxes((prev) => [res.mailbox, ...prev]);
    setOpen(false);
    resetForm();

    // Brief success check, then surface the one-time password if generated.
    setShowSuccess(true);
    window.setTimeout(() => setShowSuccess(false), 1400);

    if (res.generatedPassword) {
      setRevealed({ email: res.mailbox.email, password: res.generatedPassword });
    }
    toast({
      title: "Mailbox created",
      description: `${res.mailbox.email} is ready.`,
    });
  }, [localPart, domain, autoGenerate, password, quotaMb, displayName, resetForm, toast]);

  /* ── reset password ─────────────────────────────────────────────────── */
  const handleReset = React.useCallback(
    async (mb: SabmailHostedMailboxRow) => {
      setResettingId(mb.id);
      const res = await resetSabmailHostedMailboxPassword(mb.id);
      setResettingId(null);
      if (!res.ok) {
        toast({
          title: "Couldn't reset password",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      if (res.generatedPassword) {
        setRevealed({ email: mb.email, password: res.generatedPassword });
      }
      toast({
        title: "Password reset",
        description: `New password issued for ${mb.email}.`,
      });
    },
    [toast],
  );

  /* ── suspend / activate ─────────────────────────────────────────────── */
  const handleToggleStatus = React.useCallback(
    async (mb: SabmailHostedMailboxRow) => {
      const next = mb.status === "active" ? "suspended" : "active";
      setStatusId(mb.id);
      const res = await setSabmailHostedMailboxStatus(mb.id, next);
      setStatusId(null);
      if (!res.ok) {
        toast({
          title: "Couldn't update status",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      setMailboxes((prev) =>
        prev.map((m) =>
          m.id === mb.id
            ? { ...m, status: next === "suspended" ? "disconnected" : "active" }
            : m,
        ),
      );
      toast({
        title: next === "suspended" ? "Mailbox suspended" : "Mailbox activated",
        description: mb.email,
      });
    },
    [toast],
  );

  /* ── delete ─────────────────────────────────────────────────────────── */
  const handleDelete = React.useCallback(async () => {
    const mb = confirmDelete;
    if (!mb) return;
    setDeletingId(mb.id);
    const res = await deleteSabmailHostedMailbox(mb.id);
    setDeletingId(null);
    if (!res.ok) {
      toast({
        title: "Couldn't delete mailbox",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    setMailboxes((prev) => prev.filter((m) => m.id !== mb.id));
    setConfirmDelete(null);
    toast({ title: "Mailbox deleted", description: mb.email });
  }, [confirmDelete, toast]);

  /* ── disabled state ─────────────────────────────────────────────────── */
  if (!hostedEnabled) {
    return <HostedNotConfigured />;
  }

  const noVerifiedDomains = verifiedDomains.length === 0;

  return (
    <div className="sabmail-canvas relative min-h-full p-4 sm:p-6">
      <CreatingOverlay
        show={creating}
        variant="connect"
        title="Provisioning mailbox…"
        subtitle="Creating the principal on the mail server"
        icon={renderIcon(Mailbox, { className: "h-1/2 w-1/2" })}
      />

      {showSuccess ? (
        <div
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
          role="status"
          aria-live="polite"
        >
          <SuccessCheck size={64} />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--st-text)]">
              Hosted mailboxes
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--st-text-secondary)]">
              Create real mailboxes on your verified domains, hosted on the
              SabMail mail server. Each mailbox works over IMAP and SMTP.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            className="shrink-0"
            disabled={noVerifiedDomains}
            title={
              noVerifiedDomains
                ? "Verify a sending domain first (Domains & deliverability)"
                : undefined
            }
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            Create mailbox
          </Button>
        </div>

        {loadError ? (
          <Alert variant="destructive" title="Couldn't load mailboxes" className="mt-6">
            {loadError}
          </Alert>
        ) : null}

        {noVerifiedDomains ? (
          <Callout tone="info" title="No verified domains yet" className="mt-6">
            Verify at least one sending domain on{" "}
            <a className="underline" href="/sabmail/domains">
              Domains &amp; deliverability
            </a>{" "}
            before creating hosted mailboxes.
          </Callout>
        ) : null}

        {/* One-time password reveal (after create or reset). */}
        {revealed ? (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>One-time password for {revealed.email}</CardTitle>
                <CardDescription>Shown once — store it somewhere safe.</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={X}
                aria-label="Dismiss password"
                onClick={() => setRevealed(null)}
              >
                Dismiss
              </Button>
            </CardHeader>
            <CardBody>
              <PasswordReveal
                password={revealed.password}
                onCopy={() => void copyToClipboard(revealed.password)}
              />
            </CardBody>
          </Card>
        ) : null}

        <div className="mt-6">
          {mailboxes.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<AtSign aria-hidden />}
              title="No hosted mailboxes yet"
              description="Create your first mailbox on a verified domain to send and receive mail from your own address."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={Plus}
                  disabled={noVerifiedDomains}
                  onClick={() => {
                    resetForm();
                    setOpen(true);
                  }}
                >
                  Create mailbox
                </Button>
              }
            />
          </Card>
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Mailbox</Th>
                      <Th>Domain</Th>
                      <Th>Status</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {mailboxes.map((mb, idx) => {
                      const isActive = mb.status === "active";
                      return (
                        <Tr
                          key={mb.id}
                          className="sabmail-stagger-item"
                          style={{ ["--i" as string]: idx } as React.CSSProperties}
                        >
                          <Td>
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                <Mailbox className="h-4 w-4" aria-hidden />
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-[var(--st-text)]">
                                  {mb.email}
                                </div>
                                {mb.displayName ? (
                                  <div className="truncate text-xs text-[var(--st-text-secondary)]">
                                    {mb.displayName}
                                  </div>
                                ) : null}
                                {mb.lastError ? (
                                  <div className="truncate text-xs text-[var(--st-status-error,#dc2626)]">
                                    {mb.lastError}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <div className="flex flex-col gap-0.5">
                              <code className="font-mono text-xs text-[var(--st-text)]">
                                {mb.domain}
                              </code>
                              {mb.domainStatus && mb.domainStatus !== "verified" ? (
                                <Badge variant="destructive" className="w-fit gap-1">
                                  <AlertCircle className="h-3 w-3" aria-hidden /> Domain{" "}
                                  {mb.domainStatus}
                                </Badge>
                              ) : null}
                            </div>
                          </Td>
                          <Td>
                            <StatusPill status={mb.status} />
                          </Td>
                          <Td align="right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={KeyRound}
                                loading={resettingId === mb.id}
                                disabled={resettingId === mb.id}
                                onClick={() => void handleReset(mb)}
                                title="Issue a new one-time password"
                              >
                                Reset password
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                iconLeft={isActive ? PauseCircle : PlayCircle}
                                loading={statusId === mb.id}
                                disabled={statusId === mb.id}
                                onClick={() => void handleToggleStatus(mb)}
                              >
                                {isActive ? "Suspend" : "Activate"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={Trash2}
                                disabled={deletingId === mb.id}
                                onClick={() => setConfirmDelete(mb)}
                              >
                                Delete
                              </Button>
                            </div>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            </CardBody>
          </Card>
        )}
        </div>
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a hosted mailbox</DialogTitle>
            <DialogDescription>
              Provision a new mailbox on a verified domain. It works over IMAP and
              SMTP using the password below.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Field label="Mailbox name">
                <Input
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value)}
                  placeholder="e.g. hello"
                  autoFocus
                  maxLength={64}
                />
              </Field>
              <span className="pb-2.5 text-sm text-[var(--st-text-secondary)]">@</span>
              <Field label="Domain">
                <SelectField
                  value={domain}
                  onChange={(v) => setDomain(v)}
                  options={domainOptions}
                  placeholder="Pick a domain"
                />
              </Field>
            </div>

            <Field label="Display name" help="Shown as the sender name (optional).">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Support Team"
                maxLength={120}
              />
            </Field>

            <Field label="Quota (MB)" help="Storage limit for this mailbox (optional).">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={quotaMb}
                onChange={(e) => setQuotaMb(e.target.value)}
                placeholder="e.g. 2048"
              />
            </Field>

            <div className="rounded-md border border-[var(--st-border)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--st-text)]">
                    Auto-generate password
                  </div>
                  <div className="text-xs text-[var(--st-text-secondary)]">
                    Recommended — a strong password is created and shown once.
                  </div>
                </div>
                <Switch
                  checked={autoGenerate}
                  onCheckedChange={setAutoGenerate}
                  aria-label="Auto-generate password"
                />
              </div>
              {!autoGenerate ? (
                <div className="mt-3">
                  <Field label="Password">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a strong password"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
              ) : null}
            </div>

            {formErr ? (
              <Alert variant="destructive" title="Couldn't create mailbox">
                {formErr}
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              iconLeft={X}
              onClick={() => setOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={creating}
              disabled={creating || !localPart.trim() || !domain}
              onClick={() => void handleCreate()}
            >
              Create mailbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this mailbox?</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `${confirmDelete.email} will be permanently removed from the mail server. Stored mail in this mailbox is deleted. This can't be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              iconLeft={X}
              onClick={() => setConfirmDelete(null)}
              disabled={deletingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              iconLeft={Trash2}
              loading={deletingId !== null}
              disabled={deletingId !== null}
              onClick={() => void handleDelete()}
            >
              Delete mailbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
