"use client";

import * as React from "react";
import { Loader2, Plug, ShieldCheck } from "lucide-react";

import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  connectSabmailImapAccount,
  type SabmailAccountRow,
} from "@/app/actions/sabmail-projects.actions";

interface Preset {
  label: string;
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean };
  note?: string;
}

const PRESETS: Record<string, Preset> = {
  gmail: {
    label: "Gmail / Google Workspace",
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
    note: "Requires 2-step verification + an App Password (not your normal password).",
  },
  outlook: {
    label: "Outlook / Microsoft 365",
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
    note: "IMAP/SMTP must be enabled on the mailbox.",
  },
  yahoo: {
    label: "Yahoo Mail",
    imap: { host: "imap.mail.yahoo.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
    note: "Use an App Password.",
  },
  icloud: {
    label: "iCloud Mail",
    imap: { host: "imap.mail.me.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
    note: "Use an App-Specific Password.",
  },
  fastmail: {
    label: "Fastmail",
    imap: { host: "imap.fastmail.com", port: 993, secure: true },
    smtp: { host: "smtp.fastmail.com", port: 465, secure: true },
    note: "Use an App Password.",
  },
  custom: {
    label: "Other / custom IMAP",
    imap: { host: "", port: 993, secure: true },
    smtp: { host: "", port: 587, secure: false },
  },
};

export function MailboxConnectForm({
  projectId,
  onConnected,
}: {
  projectId: string;
  onConnected?: (account: SabmailAccountRow) => void;
}) {
  const { toast } = useToast();

  const [presetKey, setPresetKey] = React.useState<string>("gmail");
  const preset = PRESETS[presetKey] ?? PRESETS.custom;

  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [advanced, setAdvanced] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Editable endpoint overrides (prefilled from the preset).
  const [imapHost, setImapHost] = React.useState(preset.imap.host);
  const [imapPort, setImapPort] = React.useState(String(preset.imap.port));
  const [imapSecure, setImapSecure] = React.useState(preset.imap.secure);
  const [smtpHost, setSmtpHost] = React.useState(preset.smtp.host);
  const [smtpPort, setSmtpPort] = React.useState(String(preset.smtp.port));
  const [smtpSecure, setSmtpSecure] = React.useState(preset.smtp.secure);

  const applyPreset = React.useCallback((key: string) => {
    setPresetKey(key);
    const p = PRESETS[key] ?? PRESETS.custom;
    setImapHost(p.imap.host);
    setImapPort(String(p.imap.port));
    setImapSecure(p.imap.secure);
    setSmtpHost(p.smtp.host);
    setSmtpPort(String(p.smtp.port));
    setSmtpSecure(p.smtp.secure);
  }, []);

  const handleConnect = React.useCallback(async () => {
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!mail) {
      setError("Enter the mailbox email address.");
      return;
    }
    if (!password) {
      setError("Enter the password (or app password).");
      return;
    }
    if (!imapHost.trim()) {
      setError("IMAP host is required — pick a provider or enter it manually.");
      return;
    }
    setBusy(true);
    const user = username.trim() || mail;
    const res = await connectSabmailImapAccount(projectId, {
      email: mail,
      displayName: displayName.trim() || undefined,
      imap: {
        host: imapHost.trim(),
        port: Number(imapPort) || 993,
        secure: imapSecure,
        user,
        pass: password,
      },
      smtp: smtpHost.trim()
        ? {
            host: smtpHost.trim(),
            port: Number(smtpPort) || 587,
            secure: smtpSecure,
            user,
            pass: password,
          }
        : undefined,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    toast({ title: "Mailbox connected", description: mail });
    setEmail("");
    setDisplayName("");
    setPassword("");
    setUsername("");
    onConnected?.({
      id: res.accountId,
      provider: "imap",
      email: mail,
      displayName: displayName.trim() || null,
      status: "active",
      lastError: null,
      lastSyncedAt: null,
      imapHost: imapHost.trim(),
    });
  }, [
    email,
    password,
    username,
    displayName,
    imapHost,
    imapPort,
    imapSecure,
    smtpHost,
    smtpPort,
    smtpSecure,
    projectId,
    onConnected,
    toast,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Provider">
        <Select value={presetKey} onValueChange={applyPreset}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a provider" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESETS).map(([key, p]) => (
              <SelectItem key={key} value={key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {preset.note ? (
        <p className="flex items-start gap-1.5 text-xs text-[var(--st-text-secondary)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {preset.note}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email address">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Display name (optional)">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane from Acme"
          />
        </Field>
      </div>

      <Field
        label="Password / App password"
        error={error ?? undefined}
      >
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="App password recommended"
          autoComplete="off"
        />
      </Field>

      <button
        type="button"
        className="self-start text-xs font-medium text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
        onClick={() => setAdvanced((v) => !v)}
      >
        {advanced ? "Hide advanced settings" : "Advanced (host, port, username)"}
      </button>

      {advanced ? (
        <div className="flex flex-col gap-4 rounded-md border border-[var(--st-border)] p-4">
          <Field label="Username (defaults to email)">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@example.com"
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="IMAP host">
              <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" />
            </Field>
            <Field label="IMAP port">
              <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="IMAP security">
              <Select value={imapSecure ? "ssl" : "starttls"} onValueChange={(v) => setImapSecure(v === "ssl")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ssl">SSL / TLS</SelectItem>
                  <SelectItem value="starttls">STARTTLS / None</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="SMTP host (optional)">
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
            </Field>
            <Field label="SMTP port">
              <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="SMTP security">
              <Select value={smtpSecure ? "ssl" : "starttls"} onValueChange={(v) => setSmtpSecure(v === "ssl")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ssl">SSL / TLS</SelectItem>
                  <SelectItem value="starttls">STARTTLS</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      ) : null}

      <Button
        variant="primary"
        size="sm"
        className="self-start"
        iconLeft={busy ? undefined : Plug}
        loading={busy}
        disabled={busy}
        onClick={() => void handleConnect()}
      >
        {busy ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Verifying…
          </span>
        ) : (
          "Connect & verify"
        )}
      </Button>
      <p className="text-xs text-[var(--st-text-secondary)]">
        We connect live to verify your credentials, then store them encrypted
        (AES-256-GCM). Gmail &amp; Outlook one-click OAuth arrive in the next
        phase.
      </p>
    </div>
  );
}
