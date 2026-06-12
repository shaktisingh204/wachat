"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, KeyRound, Webhook, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
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
  Separator,
} from "@/components/sabcrm/20ui";

import type { ProviderAccountDetail } from "../actions";
import {
  deleteProviderAccountAction,
  setDefaultProviderAccountAction,
  testProviderConnectionAction,
} from "../actions";

const PROVIDER_NAMES: Record<string, string> = {
  twilio: "Twilio",
  telnyx: "Telnyx",
  msg91: "MSG91",
  gupshup: "Gupshup",
};

type StatusTone = "success" | "warning" | "danger" | "neutral";

function statusTone(status: string): StatusTone {
  if (status === "active") return "success";
  if (status === "disabled") return "warning";
  if (status === "error") return "danger";
  return "neutral";
}

function CopyUrl({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} URL copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--st-text-secondary)]">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1.5 font-mono text-xs text-[var(--st-text)]">
          {value}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopy} aria-label={`Copy ${label} URL`}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

export function ProviderDetailClient({ account }: { account: ProviderAccountDetail }) {
  const router = useRouter();
  const providerName = PROVIDER_NAMES[account.provider] ?? account.provider;

  const [isDefault, setIsDefault] = React.useState(account.isDefault);
  const [status, setStatus] = React.useState(account.status);
  const [lastError, setLastError] = React.useState(account.lastError);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isSettingDefault, setIsSettingDefault] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const secretBasedWebhooks = account.provider === "msg91" || account.provider === "gupshup";

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await testProviderConnectionAction(account.id);
      if (res.ok) {
        toast.success(`Connection OK${res.detail ? ` — ${res.detail}` : ""}`);
        setStatus("active");
        setLastError(undefined);
      } else {
        toast.error(res.error ?? "Connection test failed");
        if (res.error !== "engine unreachable") {
          setStatus("error");
          setLastError(res.error);
        }
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSetDefault = async () => {
    setIsSettingDefault(true);
    try {
      const res = await setDefaultProviderAccountAction(account.id);
      if (res.success) {
        toast.success(`${providerName} set as default`);
        setIsDefault(true);
      } else {
        toast.error(res.error ?? "Failed to set default");
      }
    } finally {
      setIsSettingDefault(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteProviderAccountAction(account.id);
      if (res.success) {
        toast.success("Provider account deleted");
        router.push("/sabsms/providers");
      } else {
        toast.error(res.error ?? "Delete failed");
        setIsDeleting(false);
      }
    } catch {
      toast.error("Delete failed");
      setIsDeleting(false);
    }
  };

  const credentialEntries = Object.entries(account.maskedCredentials);

  return (
    <SabsmsPageShell
      eyebrow="Infrastructure"
      title={providerName}
      description={
        <span className="flex items-center gap-2">
          Provider account
          {account.region ? <>— region {account.region}</> : null}
        </span>
      }
      breadcrumbs={[
        { label: "Providers", href: "/sabsms/providers" },
        { label: providerName },
      ]}
      primaryAction={{
        label: isTesting ? "Testing..." : "Test connection",
        onClick: handleTest,
      }}
      secondaryActions={[
        {
          label: "Delete account",
          destructive: true,
          onSelectAction: () => setDeleteOpen(true),
        },
      ]}
      helpTitle="Provider account"
      helpBody="Credentials are stored encrypted and shown masked. Webhook URLs route inbound messages and delivery reports from the provider into SabSMS."
    >
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Credentials
              </CardTitle>
              <CardDescription>
                Stored encrypted per workspace. Values are masked — re-save the account to rotate them.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {credentialEntries.length === 0 ? (
                <p className="text-sm text-[var(--st-text-secondary)]">
                  Credentials could not be read (encryption key unavailable). Re-save the account to fix.
                </p>
              ) : (
                credentialEntries.map(([key, masked]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-[var(--st-text)]">{key}</span>
                    <code className="font-mono text-xs text-[var(--st-text-secondary)]">{masked}</code>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-4 w-4" aria-hidden="true" />
                Webhook URLs
              </CardTitle>
              <CardDescription>
                Paste these into the {providerName} dashboard so inbound messages and delivery
                reports reach SabSMS.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              {account.webhookUrls ? (
                <>
                  <CopyUrl label="Inbound" value={account.webhookUrls.inbound} />
                  <CopyUrl label="Delivery reports (DLR)" value={account.webhookUrls.dlr} />
                  {secretBasedWebhooks && (
                    <div className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-xs text-[var(--st-text-secondary)]">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        For {providerName}, webhook authenticity relies on the ?secret= parameter —
                        keep these URLs private.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--st-text-secondary)]">
                  No webhook secret on this account yet — re-save the credentials once to generate
                  the webhook URLs.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="md:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--st-text-secondary)]">Connection</span>
                <Badge tone={statusTone(status)}>{status}</Badge>
              </div>
              {lastError && (
                <div className="text-xs text-[var(--st-danger)]">{lastError}</div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--st-text-secondary)]">Default account</span>
                {isDefault ? (
                  <Badge tone="accent">Default</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSetDefault}
                    disabled={isSettingDefault}
                  >
                    {isSettingDefault ? "Saving..." : "Set as default"}
                  </Button>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--st-text-secondary)]">Created</span>
                <span className="text-sm text-[var(--st-text)]">
                  {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : "—"}
                </span>
              </div>
              {account.region && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--st-text-secondary)]">Region</span>
                    <span className="text-sm text-[var(--st-text)]">{account.region}</span>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
              <CardDescription>
                Deleting this account immediately stops sends routed through it.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete account
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete provider account</DialogTitle>
            <DialogDescription>
              Remove the {providerName} account? This cannot be undone and sends routed through it
              will stop immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
