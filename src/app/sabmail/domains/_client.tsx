"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
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
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  useToast,
} from "@/components/sabcrm/20ui";
import { CreatingOverlay } from "@/components/sabmail/motion";
import {
  addSabmailDomain,
  deleteSabmailDomain,
  regenerateSabmailDkim,
  verifySabmailDomain,
  type SabmailDnsRecord,
  type SabmailDomainRow,
  type SabmailDomainStatus,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

/* ── recommended-records template (mirrors the server `getRecommendedRecords`
 *    helper; computed client-side to avoid a server roundtrip per render) ─── */
function recommendedRecords(
  domain: string,
  selector: string,
  dkimPublicKeyB64?: string | null,
): SabmailDnsRecord[] {
  const d = domain.trim().toLowerCase();
  const sel = (selector || "sabmail").trim().toLowerCase();
  const b64 = (dkimPublicKeyB64 || "").trim();
  const dkimValue = b64
    ? `v=DKIM1; k=rsa; p=${b64}`
    : "v=DKIM1; k=rsa; p= (regenerate the DKIM key to populate this value)";
  // Provider-agnostic SPF; append an ESP include only when configured (matches
  // the server-side SABMAIL_SPF_INCLUDE default). No bogus placeholder host.
  const spfInclude = (process.env.NEXT_PUBLIC_SABMAIL_SPF_INCLUDE || "").trim();
  const spfValue = spfInclude
    ? `v=spf1 include:${spfInclude} a mx ~all`
    : "v=spf1 a mx ~all";
  return [
    { type: "TXT", host: "@", value: spfValue, label: "SPF" },
    { type: "TXT", host: "_dmarc", value: `v=DMARC1; p=none; rua=mailto:dmarc@${d}`, label: "DMARC" },
    { type: "TXT", host: `${sel}._domainkey`, value: dkimValue, label: "DKIM" },
  ];
}

const STATUS_META: Record<
  SabmailDomainStatus,
  { label: string; variant: "success" | "destructive" | "secondary"; Icon: typeof CheckCircle2 }
> = {
  verified: { label: "Verified", variant: "success", Icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", Icon: AlertCircle },
  pending: { label: "Pending", variant: "secondary", Icon: Clock },
};

function StatusPill({ status }: { status: SabmailDomainStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <Badge variant={meta.variant} className="shrink-0 gap-1">
      <Icon className="h-3 w-3" aria-hidden /> {meta.label}
    </Badge>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Couldn't copy", description: "Copy the value manually.", variant: "destructive" });
    }
  }, [value, toast]);

  return (
    <Button
      variant="ghost"
      size="sm"
      iconLeft={copied ? CheckCircle2 : Copy}
      onClick={() => void copy()}
      aria-label={`Copy ${label} value`}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function DomainCard({
  domain,
  onVerify,
  onDelete,
  onRegenerate,
  verifying,
  deleting,
  regenerating,
}: {
  domain: SabmailDomainRow;
  onVerify: (id: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
  verifying: boolean;
  deleting: boolean;
  regenerating: boolean;
}) {
  const records = React.useMemo(
    () => recommendedRecords(domain.domain, domain.dkimSelector, domain.dkimPublicKeyB64),
    [domain.domain, domain.dkimSelector, domain.dkimPublicKeyB64],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
            <Globe className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{domain.domain}</CardTitle>
            <CardDescription className="truncate">
              SPF {domain.checks.spf ? "✓" : "—"} · DMARC {domain.checks.dmarc ? "✓" : "—"} · DKIM {domain.checks.dkim ? "✓" : "—"}
              {domain.checks.checkedAt
                ? ` · checked ${new Date(domain.checks.checkedAt).toLocaleString()}`
                : ""}
            </CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={domain.status} />
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            loading={deleting}
            disabled={deleting}
            onClick={() => onDelete(domain.id)}
          >
            Remove
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        <p className="mb-3 text-xs text-[var(--st-text-secondary)]">
          Add these records at your DNS provider, then verify. DKIM uses a hosted
          public key — no private key leaves the MTA.
        </p>
        <div className="overflow-x-auto rounded-md border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr>
                <Th>Type</Th>
                <Th>Host</Th>
                <Th>Value</Th>
                <Th align="right">Copy</Th>
              </Tr>
            </THead>
            <TBody>
              {records.map((rec) => (
                <Tr key={`${rec.type}-${rec.host}`}>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--st-text)]">
                      <Badge variant="outline">{rec.type}</Badge>
                      <span className="text-[var(--st-text-secondary)]">{rec.label}</span>
                    </span>
                  </Td>
                  <Td>
                    <code className="break-all font-mono text-xs text-[var(--st-text)]">{rec.host}</code>
                  </Td>
                  <Td>
                    <code className="break-all font-mono text-xs text-[var(--st-text)]">{rec.value}</code>
                  </Td>
                  <Td align="right">
                    <CopyButton value={rec.value} label={rec.label} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={KeyRound}
            loading={regenerating}
            disabled={regenerating || verifying}
            onClick={() => onRegenerate(domain.id)}
            title="Generate a fresh DKIM keypair and update the DKIM record to publish"
          >
            Regenerate DKIM
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={RefreshCw}
            loading={verifying}
            disabled={verifying}
            onClick={() => onVerify(domain.id)}
          >
            Verify records
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function SabmailDomainsClient({
  initialDomains,
}: {
  initialDomains: SabmailDomainRow[];
}) {
  const { toast } = useToast();
  const [domains, setDomains] = React.useState<SabmailDomainRow[]>(initialDomains);
  const [open, setOpen] = React.useState(false);
  const [newDomain, setNewDomain] = React.useState("");
  const [addErr, setAddErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = React.useState<string | null>(null);

  const handleAdd = React.useCallback(async () => {
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) {
      setAddErr("Enter a domain.");
      return;
    }
    setBusy(true);
    setAddErr(null);
    const res = await addSabmailDomain({ domain: trimmed });
    if (!res.ok) {
      setAddErr(res.error);
      setBusy(false);
      return;
    }
    setDomains((prev) => [res.domain, ...prev]);
    setOpen(false);
    setNewDomain("");
    setBusy(false);
    toast({ title: "Domain added", description: "Add the DNS records, then verify." });
  }, [newDomain, toast]);

  const handleVerify = React.useCallback(
    async (id: string) => {
      setVerifyingId(id);
      const res = await verifySabmailDomain(id);
      setVerifyingId(null);
      if (!res.ok) {
        toast({ title: "Verification failed", description: res.error, variant: "destructive" });
        return;
      }
      setDomains((prev) => prev.map((d) => (d.id === id ? res.domain : d)));
      toast({
        title: res.domain.status === "verified" ? "Domain verified" : "Records not found yet",
        description:
          res.domain.status === "verified"
            ? "SPF, DMARC and DKIM are live."
            : "DNS can take a while to propagate — try again shortly.",
        variant: res.domain.status === "verified" ? "default" : "destructive",
      });
    },
    [toast],
  );

  const handleRegenerate = React.useCallback(
    async (id: string) => {
      setRegeneratingId(id);
      const res = await regenerateSabmailDkim(id);
      setRegeneratingId(null);
      if (!res.ok) {
        toast({ title: "Could not regenerate DKIM", description: res.error, variant: "destructive" });
        return;
      }
      setDomains((prev) => prev.map((d) => (d.id === id ? res.domain : d)));
      toast({
        title: "DKIM key regenerated",
        description: "Publish the new DKIM record, then verify.",
      });
    },
    [toast],
  );

  const handleDelete = React.useCallback(
    async (id: string) => {
      setDeletingId(id);
      const res = await deleteSabmailDomain(id);
      setDeletingId(null);
      if (!res.ok) {
        toast({ title: "Could not remove domain", description: res.error, variant: "destructive" });
        return;
      }
      setDomains((prev) => prev.filter((d) => d.id !== id));
      toast({ title: "Domain removed" });
    },
    [toast],
  );

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <CreatingOverlay
        show={verifyingId !== null}
        variant="process"
        title="Checking DNS…"
        subtitle="Resolving SPF and DMARC records"
      />

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Domains &amp; Deliverability</PageTitle>
          <PageDescription>
            Authenticate the domains you send from. Add SPF, DMARC and DKIM
            records at your DNS provider, then verify — verified domains land in
            the inbox, not spam.
          </PageDescription>
        </PageHeaderHeading>
        <Button
          variant="primary"
          size="sm"
          iconLeft={Plus}
          onClick={() => {
            setNewDomain("");
            setAddErr(null);
            setOpen(true);
          }}
        >
          Add domain
        </Button>
      </PageHeader>

      <div className="mt-6">
        {domains.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<Globe aria-hidden />}
              title="No sending domains yet"
              description="Add your first domain to publish its DNS records and start authenticating mail."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() => {
                    setNewDomain("");
                    setAddErr(null);
                    setOpen(true);
                  }}
                >
                  Add domain
                </Button>
              }
            />
          </Card>
        ) : (
          <ul className="sabmail-motion flex flex-col gap-6">
            {domains.map((d, idx) => (
              <li
                key={d.id}
                className="sabmail-stagger-item"
                style={{ ["--i" as string]: idx } as React.CSSProperties}
              >
                <DomainCard
                  domain={d}
                  onVerify={(id) => void handleVerify(id)}
                  onDelete={(id) => void handleDelete(id)}
                  onRegenerate={(id) => void handleRegenerate(id)}
                  verifying={verifyingId === d.id}
                  deleting={deletingId === d.id}
                  regenerating={regeneratingId === d.id}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a sending domain</DialogTitle>
            <DialogDescription>
              Enter the domain you want to send mail from. We&apos;ll generate
              the DNS records to publish, then verify them live.
            </DialogDescription>
          </DialogHeader>

          <Field label="Domain" error={addErr ?? undefined}>
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g. mail.example.com"
              autoFocus
              maxLength={253}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
          </Field>

          <DialogFooter>
            <Button variant="outline" size="sm" iconLeft={X} onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              loading={busy}
              disabled={busy || !newDomain.trim()}
              onClick={() => void handleAdd()}
            >
              Add domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
