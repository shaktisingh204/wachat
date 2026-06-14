"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldCheck,
  Upload,
  UserMinus,
  XCircle,
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
  SelectField,
  TBody,
  THead,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  useToast,
  type SelectOption,
} from "@/components/sabcrm/20ui";

import type {
  BulkOnboardResult,
  GrantableAppOption,
  OnboardCredentials,
  PersonRow,
  SettingsView,
} from "@/lib/sabadmin/dto";
import {
  onboardEmployee,
  bulkOnboardEmployees,
  updateEmployeeAccess,
  resetEmployeePassword,
  setEmployeeSuspended,
  offboardEmployee,
} from "../actions/provision.actions";

/* ── helpers ──────────────────────────────────────────────────────────── */

function deriveLocalPart(first: string, last: string): string {
  const clean = (s: string) =>
    (s || "").trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
  const f = clean(first);
  const l = clean(last);
  return [f, l].filter(Boolean).join(".") || f || l;
}

const STATUS_META: Record<
  PersonRow["status"],
  { label: string; variant: "success" | "secondary" | "outline" | "destructive" }
> = {
  active: { label: "Active", variant: "success" },
  suspended: { label: "Suspended", variant: "secondary" },
  offboarded: { label: "Offboarded", variant: "destructive" },
  provisioning: { label: "Provisioning", variant: "outline" },
};

/* ── app + package multi-select (chip toggles) ───────────────────────────
 * 20ui Checkbox has no onCheckedChange, so we toggle with chip buttons. */
function ChipPicker({
  title,
  options,
  selected,
  onToggle,
  emptyHint,
}: {
  title: string;
  options: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyHint?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{title}</div>
      {options.length === 0 ? (
        <p className="text-sm text-[var(--zoru-text-secondary,#666)]">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const on = selected.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onToggle(o.id)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
                  on
                    ? "border-transparent bg-[var(--zoru-primary,#4f46e5)] text-white"
                    : "border-[var(--zoru-border,#d4d4d8)] bg-transparent hover:bg-[var(--zoru-surface-2,#f4f4f5)]",
                ].join(" ")}
                aria-pressed={on}
              >
                {on ? <Check className="h-3.5 w-3.5" /> : null}
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── one-time credentials reveal ──────────────────────────────────────── */
function CredentialsCard({
  creds,
  onDismiss,
}: {
  creds: { upn: string; password: string; displayName: string };
  onDismiss: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Email: ${creds.upn}\nPassword: ${creds.password}`,
      );
      setCopied(true);
      toast({ title: "Credentials copied" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Couldn’t copy", variant: "destructive" });
    }
  };
  return (
    <Card className="mt-6 border-2 border-[var(--zoru-primary,#4f46e5)]">
      <CardHeader>
        <CardTitle>Credentials for {creds.displayName}</CardTitle>
        <CardDescription>
          Shown once — hand these to the employee securely. They’ll be asked to
          change the password on first sign-in.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-[var(--zoru-surface-2,#f4f4f5)] p-3">
            <div className="text-xs uppercase text-[var(--zoru-text-secondary,#666)]">Email / login</div>
            <div className="font-mono text-sm">{creds.upn}</div>
          </div>
          <div className="rounded-md bg-[var(--zoru-surface-2,#f4f4f5)] p-3">
            <div className="text-xs uppercase text-[var(--zoru-text-secondary,#666)]">Temporary password</div>
            <div className="font-mono text-sm">{creds.password}</div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" iconLeft={copied ? Check : Copy} onClick={copy}>
            {copied ? "Copied" : "Copy credentials"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── main client ──────────────────────────────────────────────────────── */
export function SabAdminPeopleClient({
  initialPeople,
  settings,
  grantableApps,
  packages,
}: {
  initialPeople: PersonRow[];
  settings: SettingsView | null;
  grantableApps: GrantableAppOption[];
  packages: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const [people, setPeople] = React.useState<PersonRow[]>(initialPeople);
  const [addOpen, setAddOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [reveal, setReveal] = React.useState<{ upn: string; password: string; displayName: string } | null>(null);

  // Add form state
  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [localPart, setLocalPart] = React.useState("");
  const [localTouched, setLocalTouched] = React.useState(false);
  const [domain, setDomain] = React.useState(settings?.defaultDomain ?? "");
  const [password, setPassword] = React.useState("");
  const [notifyEmail, setNotifyEmail] = React.useState("");
  const [apps, setApps] = React.useState<Set<string>>(new Set());
  const [pkgs, setPkgs] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);

  // Bulk import state
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkText, setBulkText] = React.useState("");
  const [bulkDomain, setBulkDomain] = React.useState(settings?.defaultDomain ?? "");
  const [bulkApps, setBulkApps] = React.useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = React.useState(false);
  const [bulkResults, setBulkResults] = React.useState<BulkOnboardResult[] | null>(null);

  // Manage-access dialog state
  const [manage, setManage] = React.useState<PersonRow | null>(null);
  const [mApps, setMApps] = React.useState<Set<string>>(new Set());
  const [mPkgs, setMPkgs] = React.useState<Set<string>>(new Set());
  const [mSaving, setMSaving] = React.useState(false);

  // Offboard confirm
  const [offboard, setOffboard] = React.useState<PersonRow | null>(null);

  const domainOptions: SelectOption[] = (settings?.verifiedDomains ?? []).map((d) => ({
    label: d,
    value: d,
  }));
  const appOptions = grantableApps.map((a) => ({ id: a.appId, label: a.label }));
  const pkgOptions = packages.map((p) => ({ id: p.id, label: p.name }));

  const needsSetup =
    !settings ||
    !settings.hostedMailConfigured ||
    !settings.hostedAuthConfigured ||
    !settings.mailWorkspaceId ||
    settings.verifiedDomains.length === 0;

  React.useEffect(() => {
    if (!localTouched) setLocalPart(deriveLocalPart(first, last));
  }, [first, last, localTouched]);

  const resetAddForm = () => {
    setFirst("");
    setLast("");
    setLocalPart("");
    setLocalTouched(false);
    setDomain(settings?.defaultDomain ?? "");
    setPassword("");
    setNotifyEmail("");
    setApps(new Set());
    setPkgs(new Set());
  };

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = async () => {
    if (!first.trim() && !last.trim()) {
      toast({ title: "Enter the employee’s name", variant: "destructive" });
      return;
    }
    if (!domain) {
      toast({ title: "Pick a verified domain", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const res = await onboardEmployee({
      firstName: first,
      lastName: last,
      localPart,
      domain,
      password: password.trim() || undefined,
      notifyEmail: notifyEmail.trim() || undefined,
      appIds: Array.from(apps),
      packageIds: Array.from(pkgs),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast({ title: "Couldn’t onboard", description: res.error, variant: "destructive" });
      return;
    }
    const c: OnboardCredentials = res.credentials;
    setPeople((prev) => [
      {
        userId: c.userId,
        employeeId: c.employeeId,
        upn: c.upn,
        displayName: c.displayName,
        status: "active",
        mailboxStatus: "active",
        grantedApps: c.grantedApps,
        packageIds: Array.from(pkgs),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setReveal({ upn: c.upn, password: c.oneTimePassword, displayName: c.displayName });
    setAddOpen(false);
    resetAddForm();
    toast({ title: "Employee onboarded", description: c.upn });
  };

  const handleBulk = async () => {
    // Parse pasted CSV: one per line — "First, Last, localpart(optional)".
    const rows = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [firstName = "", lastName = "", localPart = ""] = line
          .split(",")
          .map((c) => c.trim());
        return { firstName, lastName, localPart, domain: bulkDomain, appIds: Array.from(bulkApps) };
      })
      .filter((r) => r.firstName || r.lastName || r.localPart);

    if (rows.length === 0) {
      toast({ title: "Paste at least one row", variant: "destructive" });
      return;
    }
    if (!bulkDomain) {
      toast({ title: "Pick a domain for the batch", variant: "destructive" });
      return;
    }
    setBulkSubmitting(true);
    const res = await bulkOnboardEmployees(rows);
    setBulkSubmitting(false);
    if (!res.ok) {
      toast({ title: "Bulk import failed", description: res.error, variant: "destructive" });
      return;
    }
    setBulkResults(res.results);
    const okCount = res.results.filter((r) => r.ok).length;
    const failCount = res.results.length - okCount;
    toast({
      title: `Imported ${okCount}${failCount ? `, ${failCount} failed` : ""}`,
    });
    // The table refreshes with real records when the results panel is closed.
  };

  const closeBulk = () => {
    const hadSuccess = (bulkResults ?? []).some((r) => r.ok);
    setBulkOpen(false);
    setBulkResults(null);
    setBulkText("");
    setBulkApps(new Set());
    if (hadSuccess) window.location.reload();
  };

  const openManage = (p: PersonRow) => {
    setManage(p);
    setMApps(new Set(p.grantedApps));
    setMPkgs(new Set(p.packageIds));
  };

  const handleManageSave = async () => {
    if (!manage) return;
    setMSaving(true);
    const res = await updateEmployeeAccess(manage.userId, Array.from(mApps), Array.from(mPkgs));
    setMSaving(false);
    if (!res.ok) {
      toast({ title: "Couldn’t update access", description: res.error, variant: "destructive" });
      return;
    }
    setPeople((prev) =>
      prev.map((x) =>
        x.userId === manage.userId
          ? { ...x, grantedApps: Array.from(mApps), packageIds: Array.from(mPkgs) }
          : x,
      ),
    );
    setManage(null);
    toast({ title: "Access updated" });
  };

  const handleReset = async (p: PersonRow) => {
    setBusyId(p.userId);
    const res = await resetEmployeePassword(p.userId);
    setBusyId(null);
    if (!res.ok) {
      toast({ title: "Couldn’t reset password", description: res.error, variant: "destructive" });
      return;
    }
    setReveal({ upn: p.upn, password: res.oneTimePassword, displayName: p.displayName });
    toast({ title: "Password reset", description: p.upn });
  };

  const handleSuspend = async (p: PersonRow, suspend: boolean) => {
    setBusyId(p.userId);
    const res = await setEmployeeSuspended(p.userId, suspend);
    setBusyId(null);
    if (!res.ok) {
      toast({ title: "Action failed", description: res.error, variant: "destructive" });
      return;
    }
    setPeople((prev) =>
      prev.map((x) => (x.userId === p.userId ? { ...x, status: suspend ? "suspended" : "active" } : x)),
    );
    toast({ title: suspend ? "Sign-in blocked" : "Reactivated", description: p.upn });
  };

  const handleOffboard = async () => {
    if (!offboard) return;
    setBusyId(offboard.userId);
    const res = await offboardEmployee(offboard.userId);
    setBusyId(null);
    if (!res.ok) {
      toast({ title: "Couldn’t offboard", description: res.error, variant: "destructive" });
      return;
    }
    setPeople((prev) =>
      prev.map((x) => (x.userId === offboard.userId ? { ...x, status: "offboarded" } : x)),
    );
    const upn = offboard.upn;
    setOffboard(null);
    toast({ title: "Offboarded", description: upn });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">People</h1>
          <p className="mt-1 text-sm text-[var(--zoru-text-secondary,#666)]">
            Provisioned employees — their company email, login and tool access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            iconLeft={Upload}
            disabled={needsSetup}
            title={needsSetup ? "Finish setup first (Settings)" : undefined}
            onClick={() => {
              setBulkResults(null);
              setBulkText("");
              setBulkApps(new Set());
              setBulkDomain(settings?.defaultDomain ?? "");
              setBulkOpen(true);
            }}
          >
            Bulk import
          </Button>
          <Button
            iconLeft={Plus}
            disabled={needsSetup}
            title={needsSetup ? "Finish setup first (Settings)" : undefined}
            onClick={() => {
              resetAddForm();
              setAddOpen(true);
            }}
          >
            Add employee
          </Button>
        </div>
      </div>

      {needsSetup ? (
        <Callout tone="warning" title="Finish setup to start onboarding" className="mt-6">
          A linked SabMail mail workspace + a verified domain (and the hosted
          mail/login env on the server) are required.{" "}
          <Link className="underline" href="/sabadmin/settings">
            Open Settings
          </Link>
          .
        </Callout>
      ) : null}

      {reveal ? (
        <CredentialsCard
          creds={reveal}
          onDismiss={() => setReveal(null)}
        />
      ) : null}

      <Card className="mt-6">
        <CardBody className="p-0">
          {people.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No people yet"
                description="Onboard your first employee to give them a mailbox, login and tools."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Email / login</Th>
                  <Th>Status</Th>
                  <Th>Mailbox</Th>
                  <Th>Apps</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {people.map((p) => {
                  const meta = STATUS_META[p.status];
                  const off = p.status === "offboarded";
                  return (
                    <Tr key={p.userId}>
                      <Td className="font-medium">{p.displayName}</Td>
                      <Td className="font-mono text-xs">{p.upn}</Td>
                      <Td>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </Td>
                      <Td className="text-sm text-[var(--zoru-text-secondary,#666)]">
                        {p.mailboxStatus ?? "—"}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {p.grantedApps.length === 0 ? (
                            <span className="text-xs text-[var(--zoru-text-secondary,#666)]">none</span>
                          ) : (
                            p.grantedApps.slice(0, 4).map((a) => (
                              <Badge key={a} variant="outline">
                                {a}
                              </Badge>
                            ))
                          )}
                          {p.grantedApps.length > 4 ? (
                            <Badge variant="outline">+{p.grantedApps.length - 4}</Badge>
                          ) : null}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={ShieldCheck}
                            disabled={off || busyId === p.userId}
                            onClick={() => openManage(p)}
                          >
                            Access
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={KeyRound}
                            disabled={off || busyId === p.userId}
                            onClick={() => handleReset(p)}
                          >
                            Reset
                          </Button>
                          {p.status === "suspended" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              iconLeft={PlayCircle}
                              disabled={busyId === p.userId}
                              onClick={() => handleSuspend(p, false)}
                            >
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              iconLeft={PauseCircle}
                              disabled={off || busyId === p.userId}
                              onClick={() => handleSuspend(p, true)}
                            >
                              Suspend
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={UserMinus}
                            disabled={off || busyId === p.userId}
                            onClick={() => setOffboard(p)}
                          >
                            Offboard
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* ── Add employee dialog ─────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>
              Creates a company mailbox, a login (the email is the sign-in), an
              HR record, and grants the tools you pick.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
              </Field>
              <Field label="Last name">
                <Input value={last} onChange={(e) => setLast(e.target.value)} />
              </Field>
            </div>

            <div className="flex items-end gap-2">
              <Field label="Mailbox / login" className="flex-1">
                <Input
                  value={localPart}
                  onChange={(e) => {
                    setLocalTouched(true);
                    setLocalPart(e.target.value);
                  }}
                  placeholder="first.last"
                  maxLength={64}
                />
              </Field>
              <span className="pb-2.5 text-sm text-[var(--zoru-text-secondary,#666)]">@</span>
              <Field label="Domain" className="flex-1">
                <SelectField
                  value={domain}
                  onChange={(v) => setDomain(v ?? "")}
                  options={domainOptions}
                  placeholder="Pick a domain"
                />
              </Field>
            </div>

            <Field
              label="Temporary password"
              help="Leave blank to auto-generate a strong one. Shown once after creation."
            >
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Auto-generate"
              />
            </Field>

            <Field
              label="Notify email (optional)"
              help="Send a welcome + credentials to a personal/manager address (not the new mailbox)."
            >
              <Input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="personal@example.com"
              />
            </Field>

            <ChipPicker
              title="Grant apps"
              options={appOptions}
              selected={apps}
              onToggle={toggle(setApps)}
              emptyHint="You don’t currently have any grantable apps."
            />

            {pkgOptions.length > 0 ? (
              <ChipPicker
                title="Access packages"
                options={pkgOptions}
                selected={pkgs}
                onToggle={toggle(setPkgs)}
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={submitting} disabled={submitting}>
              Create &amp; provision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk import dialog ──────────────────────────────────────────── */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !o && closeBulk()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk import</DialogTitle>
            <DialogDescription>
              Paste one employee per line: <code>First, Last, mailbox-name</code>{" "}
              (the mailbox name is optional — derived from the name if omitted).
              Every row gets the same domain + apps below.
            </DialogDescription>
          </DialogHeader>

          {bulkResults === null ? (
            <div className="space-y-4">
              <Field label="Employees (CSV)">
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={6}
                  placeholder={"Ada, Lovelace, ada.lovelace\nAlan, Turing"}
                />
              </Field>
              <Field label="Domain (applied to all)">
                <SelectField
                  value={bulkDomain}
                  onChange={(v) => setBulkDomain(v ?? "")}
                  options={domainOptions}
                  placeholder="Pick a domain"
                />
              </Field>
              <ChipPicker
                title="Grant apps (applied to all)"
                options={appOptions}
                selected={bulkApps}
                onToggle={toggle(setBulkApps)}
                emptyHint="You don’t currently have any grantable apps."
              />
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-1 overflow-auto">
              {bulkResults.map((r, i) => (
                <div
                  key={`${r.upn ?? r.displayName}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--zoru-border,#e4e4e7)] px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {r.ok ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">{r.displayName}</span>
                  </span>
                  {r.ok ? (
                    <span className="flex items-center gap-2 font-mono text-xs">
                      <span>{r.upn}</span>
                      {r.oneTimePassword ? (
                        <span className="rounded bg-[var(--zoru-surface-2,#f4f4f5)] px-1.5 py-0.5">
                          {r.oneTimePassword}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-xs text-red-500">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            {bulkResults === null ? (
              <>
                <Button variant="ghost" onClick={closeBulk}>
                  Cancel
                </Button>
                <Button onClick={handleBulk} loading={bulkSubmitting} disabled={bulkSubmitting}>
                  Import
                </Button>
              </>
            ) : (
              <Button onClick={closeBulk}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage access dialog ────────────────────────────────────────── */}
      <Dialog open={!!manage} onOpenChange={(o) => !o && setManage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage access{manage ? ` — ${manage.displayName}` : ""}</DialogTitle>
            <DialogDescription>
              You can only grant access you hold yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ChipPicker
              title="Apps"
              options={appOptions}
              selected={mApps}
              onToggle={toggle(setMApps)}
              emptyHint="No grantable apps."
            />
            {pkgOptions.length > 0 ? (
              <ChipPicker
                title="Access packages"
                options={pkgOptions}
                selected={mPkgs}
                onToggle={toggle(setMPkgs)}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManage(null)}>
              Cancel
            </Button>
            <Button onClick={handleManageSave} loading={mSaving} disabled={mSaving}>
              Save access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Offboard confirm ────────────────────────────────────────────── */}
      <Dialog open={!!offboard} onOpenChange={(o) => !o && setOffboard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offboard {offboard?.displayName}?</DialogTitle>
            <DialogDescription>
              Blocks sign-in everywhere, revokes all tool access and suspends the
              mailbox. The mailbox is preserved for compliance (not deleted).
            </DialogDescription>
          </DialogHeader>
          <Alert tone="warning" className="mt-1">
            This is hard to undo — the person will be signed out of every device.
          </Alert>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffboard(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={busyId === offboard?.userId}
              onClick={handleOffboard}
            >
              Offboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
