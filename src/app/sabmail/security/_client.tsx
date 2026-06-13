"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Fingerprint,
  KeyRound,
  Lock,
  PackageOpen,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
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
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import { CreatingOverlay } from "@/components/sabmail/motion";
import {
  deleteSabmailPgpKey,
  generateSabmailPgpKey,
  importSabmailPgpKey,
  testEncryptDecrypt,
  type SabmailPgpStatus,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

/* ── small helpers ────────────────────────────────────────────────────── */

function CopyButton({
  value,
  label,
  size = "sm",
}: {
  value: string;
  label: string;
  size?: "sm" | "md";
}) {
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
      size={size}
      iconLeft={copied ? CheckCircle2 : Copy}
      onClick={() => void copy()}
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function AvailabilityBanner({ available }: { available: boolean }) {
  if (available) {
    return (
      <div
        className="flex items-start gap-3 rounded-md border px-4 py-3"
        style={{
          borderColor: "color-mix(in srgb, var(--st-status-ok, #16a34a) 35%, transparent)",
          background: "color-mix(in srgb, var(--st-status-ok, #16a34a) 9%, transparent)",
        }}
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--st-status-ok, #16a34a)" }} aria-hidden />
        <div className="text-sm">
          <p className="font-medium text-[var(--st-text)]">OpenPGP is available</p>
          <p className="text-[var(--st-text-secondary)]">
            End-to-end encryption is enabled on this server. Generate or import a workspace keypair below.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex items-start gap-3 rounded-md border px-4 py-3"
      style={{
        borderColor: "color-mix(in srgb, var(--st-status-err, #dc2626) 35%, transparent)",
        background: "color-mix(in srgb, var(--st-status-err, #dc2626) 9%, transparent)",
      }}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--st-status-err, #dc2626)" }} aria-hidden />
      <div className="text-sm">
        <p className="font-medium text-[var(--st-text)]">OpenPGP is not installed</p>
        <p className="text-[var(--st-text-secondary)]">
          End-to-end encryption requires the optional <code className="font-mono">openpgp</code> package. Install it on the
          server, then redeploy:
        </p>
        <code className="mt-2 inline-block rounded bg-[var(--st-bg-muted)] px-2 py-1 font-mono text-xs text-[var(--st-text)]">
          npm i openpgp
        </code>
      </div>
    </div>
  );
}

/* ── key details card ─────────────────────────────────────────────────── */

function KeyDetailsCard({
  status,
  onDelete,
  deleting,
}: {
  status: SabmailPgpStatus;
  onDelete: () => void;
  deleting: boolean;
}) {
  const pub = status.publicKeyArmored ?? "";
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
            <KeyRound className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">
              {status.email ? status.email : "Workspace PGP key"}
            </CardTitle>
            <CardDescription className="truncate">
              {status.name ? `${status.name} · ` : ""}
              {status.createdAt ? `Created ${new Date(status.createdAt).toLocaleString()}` : "Active"}
            </CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status.encrypted ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" aria-hidden /> Passphrase
            </Badge>
          ) : null}
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Trash2}
            loading={deleting}
            disabled={deleting}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[var(--st-text-secondary)]">
            <Fingerprint className="h-3.5 w-3.5" aria-hidden /> Fingerprint
          </div>
          <div className="flex items-center gap-2">
            <code className="break-all rounded bg-[var(--st-bg-muted)] px-2 py-1 font-mono text-xs text-[var(--st-text)]">
              {status.fingerprint || "—"}
            </code>
            {status.fingerprint ? <CopyButton value={status.fingerprint} label="fingerprint" /> : null}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--st-text-secondary)]">Public key (share this)</span>
            {pub ? <CopyButton value={pub} label="public key" /> : null}
          </div>
          <Textarea
            value={pub}
            readOnly
            rows={8}
            className="font-mono text-xs"
            aria-label="Armored public key"
          />
          <p className="mt-1.5 text-xs text-[var(--st-text-secondary)]">
            The private key is stored server-side only and never leaves this server. Share the public key with people who
            need to send you encrypted mail.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── encrypt / decrypt test box ───────────────────────────────────────── */

function EncryptTestCard({ encrypted }: { encrypted: boolean }) {
  const { toast } = useToast();
  const [text, setText] = React.useState("Hello, SabMail — this is end-to-end encrypted.");
  const [passphrase, setPassphrase] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ciphertext: string; roundtrip: string } | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const run = React.useCallback(async () => {
    if (!text.trim()) {
      setErr("Enter some text to encrypt.");
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    const res = await testEncryptDecrypt(text, encrypted ? passphrase : undefined);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setResult({ ciphertext: res.ciphertext, roundtrip: res.roundtrip });
    toast({ title: "Round-trip succeeded", description: "Encrypt → decrypt matched the original text." });
  }, [text, passphrase, encrypted, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Encrypt / decrypt test</CardTitle>
        <CardDescription>
          Encrypt some text to your public key, then decrypt it with the stored private key to confirm the round-trip
          works.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <Field label="Plaintext">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Type something to encrypt…"
          />
        </Field>

        {encrypted ? (
          <Field label="Private-key passphrase" help="Required because this key is passphrase-protected.">
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              autoComplete="off"
            />
          </Field>
        ) : null}

        {err ? (
          <p className="text-sm" style={{ color: "var(--st-status-err, #dc2626)" }}>
            {err}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button variant="primary" size="sm" iconLeft={Lock} loading={busy} disabled={busy} onClick={() => void run()}>
            Run round-trip
          </Button>
        </div>

        {result ? (
          <div className="space-y-3 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--st-text-secondary)]">Ciphertext</span>
                <CopyButton value={result.ciphertext} label="ciphertext" />
              </div>
              <Textarea
                value={result.ciphertext}
                readOnly
                rows={6}
                className="font-mono text-[11px]"
                aria-label="Ciphertext"
              />
            </div>
            <div>
              <span className="text-xs font-medium text-[var(--st-text-secondary)]">Decrypted (round-trip)</span>
              <div
                className="mt-1 flex items-center gap-2 rounded border px-2 py-1.5 text-sm text-[var(--st-text)]"
                style={{
                  borderColor: "color-mix(in srgb, var(--st-status-ok, #16a34a) 35%, transparent)",
                }}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--st-status-ok, #16a34a)" }} aria-hidden />
                <span className="break-all">{result.roundtrip}</span>
              </div>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ── generate dialog ──────────────────────────────────────────────────── */

function GenerateDialog({
  open,
  onOpenChange,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerated: (status: SabmailPgpStatus) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [passphrase, setPassphrase] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPassphrase("");
      setErr(null);
    }
  }, [open]);

  const submit = React.useCallback(async () => {
    if (!email.trim()) {
      setErr("Enter an email for the key identity.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await generateSabmailPgpKey({ name, email, passphrase: passphrase || undefined });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    onGenerated(res.status);
    onOpenChange(false);
    toast({ title: "Keypair generated", description: "Your public key is ready to share." });
  }, [name, email, passphrase, onGenerated, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate a PGP keypair</DialogTitle>
          <DialogDescription>
            We generate a Curve25519 keypair on the server. The private key is stored server-side only — you only ever
            share the public key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Name" help="Optional — shown in the key identity.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Support" maxLength={120} />
          </Field>
          <Field label="Email" error={err && !email.trim() ? err : undefined}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={254}
              autoFocus
            />
          </Field>
          <Field label="Passphrase" help="Optional — protects the private key at rest.">
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Leave blank for no passphrase"
              autoComplete="new-password"
              maxLength={256}
            />
          </Field>
          {err && email.trim() ? (
            <p className="text-sm" style={{ color: "var(--st-status-err, #dc2626)" }}>
              {err}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" iconLeft={X} onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" iconLeft={KeyRound} loading={busy} disabled={busy} onClick={() => void submit()}>
            Generate keypair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── import dialog ────────────────────────────────────────────────────── */

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (status: SabmailPgpStatus) => void;
}) {
  const { toast } = useToast();
  const [publicKey, setPublicKey] = React.useState("");
  const [privateKey, setPrivateKey] = React.useState("");
  const [passphrase, setPassphrase] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setPublicKey("");
      setPrivateKey("");
      setPassphrase("");
      setErr(null);
    }
  }, [open]);

  const submit = React.useCallback(async () => {
    if (!publicKey.trim()) {
      setErr("Paste an armored public key.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await importSabmailPgpKey({
      publicKeyArmored: publicKey,
      privateKeyArmored: privateKey || undefined,
      passphrase: passphrase || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    onImported(res.status);
    onOpenChange(false);
    toast({ title: "Key imported", description: "The public key is now active for this workspace." });
  }, [publicKey, privateKey, passphrase, onImported, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a PGP key</DialogTitle>
          <DialogDescription>
            Paste an armored public key (required). Include the private key only if you want the server to decrypt
            incoming mail — it&apos;s stored server-side and never returned to the browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Public key (armored)" error={err && !publicKey.trim() ? err : undefined}>
            <Textarea
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder={"-----BEGIN PGP PUBLIC KEY BLOCK-----\n…\n-----END PGP PUBLIC KEY BLOCK-----"}
              autoFocus
            />
          </Field>
          <Field label="Private key (armored)" help="Optional — enables server-side decryption + the round-trip test.">
            <Textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder={"-----BEGIN PGP PRIVATE KEY BLOCK-----\n…\n-----END PGP PRIVATE KEY BLOCK-----"}
            />
          </Field>
          {privateKey.trim() ? (
            <Field label="Private-key passphrase" help="Required if the private key is passphrase-protected.">
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase"
                autoComplete="off"
              />
            </Field>
          ) : null}
          {err && publicKey.trim() ? (
            <p className="text-sm" style={{ color: "var(--st-status-err, #dc2626)" }}>
              {err}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" iconLeft={X} onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" iconLeft={Download} loading={busy} disabled={busy} onClick={() => void submit()}>
            Import key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── page ─────────────────────────────────────────────────────────────── */

export function SabmailSecurityClient({ initialStatus }: { initialStatus: SabmailPgpStatus }) {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<SabmailPgpStatus>(initialStatus);
  const [genOpen, setGenOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const available = status.available;

  const handleDelete = React.useCallback(async () => {
    setDeleting(true);
    const res = await deleteSabmailPgpKey();
    setDeleting(false);
    if (!res.ok) {
      toast({ title: "Could not delete key", description: res.error, variant: "destructive" });
      return;
    }
    setStatus((prev) => ({ available: prev.available, hasKey: false }));
    toast({ title: "Key deleted" });
  }, [toast]);

  const headerActions = (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        iconLeft={Upload}
        disabled={!available}
        onClick={() => setImportOpen(true)}
      >
        Import key
      </Button>
      <Button
        variant="primary"
        size="sm"
        iconLeft={Plus}
        disabled={!available}
        onClick={() => setGenOpen(true)}
      >
        {status.hasKey ? "Replace key" : "Generate key"}
      </Button>
    </div>
  );

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <CreatingOverlay
        show={deleting}
        variant="process"
        title="Deleting key…"
        subtitle="Removing the workspace keypair"
      />

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Security &amp; Encryption</PageTitle>
          <PageDescription>
            OpenPGP end-to-end encryption for this workspace. The private key stays on the server — only the public key
            and fingerprint are ever shared.
          </PageDescription>
        </PageHeaderHeading>
        {available ? headerActions : null}
      </PageHeader>

      <div className="mt-6 grid gap-6">
        <AvailabilityBanner available={available} />

        {!available ? (
          <Card className="p-10">
            <EmptyState
              icon={<PackageOpen aria-hidden />}
              title="Encryption is not enabled"
              description="Install the openpgp package on the server to generate or import a workspace keypair and encrypt mail end-to-end."
            />
          </Card>
        ) : !status.hasKey ? (
          <Card className="p-10">
            <EmptyState
              icon={<ShieldCheck aria-hidden />}
              title="No encryption key yet"
              description="Generate a fresh keypair or import an existing one to start sending and receiving encrypted mail."
              action={
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" iconLeft={Upload} onClick={() => setImportOpen(true)}>
                    Import key
                  </Button>
                  <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setGenOpen(true)}>
                    Generate keypair
                  </Button>
                </div>
              }
            />
          </Card>
        ) : (
          <div className="sabmail-motion grid gap-6">
            <div className="sabmail-stagger-item" style={{ ["--i" as string]: 0 } as React.CSSProperties}>
              <KeyDetailsCard status={status} onDelete={() => void handleDelete()} deleting={deleting} />
            </div>
            <div className="sabmail-stagger-item" style={{ ["--i" as string]: 1 } as React.CSSProperties}>
              <EncryptTestCard encrypted={!!status.encrypted} />
            </div>
          </div>
        )}
      </div>

      <GenerateDialog open={genOpen} onOpenChange={setGenOpen} onGenerated={setStatus} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={setStatus} />
    </div>
  );
}
