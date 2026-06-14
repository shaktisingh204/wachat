"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  SelectField,
  useToast,
  type SelectOption,
} from "@/components/sabcrm/20ui";

import type { SettingsView } from "@/lib/sabadmin/dto";
import type { DomainMode, UsernameConvention } from "@/lib/sabadmin/types";
import { updateSabAdminSettingsAction } from "../actions/settings.actions";

const DOMAIN_MODE_OPTIONS: SelectOption[] = [
  { label: "Custom domain, else shared", value: "custom" },
  { label: "Shared SabNode domain", value: "shared" },
];

const CONVENTION_OPTIONS: SelectOption[] = [
  { label: "first.last", value: "first.last" },
  { label: "flast", value: "flast" },
  { label: "firstlast", value: "firstlast" },
  { label: "first", value: "first" },
];

function Capability({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span>{label}</span>
    </div>
  );
}

export function SabAdminSettingsClient({ initial }: { initial: SettingsView }) {
  const { toast } = useToast();
  const [mailWorkspaceId, setMailWorkspaceId] = React.useState(initial.mailWorkspaceId ?? "");
  const [domainMode, setDomainMode] = React.useState<DomainMode>(initial.domainMode);
  const [sharedDomain, setSharedDomain] = React.useState(initial.sharedDomain ?? "");
  const [orgSlug, setOrgSlug] = React.useState(initial.orgSlug ?? "");
  const [convention, setConvention] = React.useState<UsernameConvention>(initial.usernameConvention);
  const [sabcrmProjectId, setSabcrmProjectId] = React.useState(initial.sabcrmProjectId ?? "");
  const [saving, setSaving] = React.useState(false);

  const projectOptions: SelectOption[] = [
    { label: "Primary project (default)", value: "" },
    ...initial.projects.map((p) => ({ label: p.name, value: p.id })),
  ];

  const save = async () => {
    setSaving(true);
    const res = await updateSabAdminSettingsAction({
      mailWorkspaceId: mailWorkspaceId.trim() || undefined,
      domainMode,
      sharedDomain: sharedDomain.trim() || undefined,
      orgSlug: orgSlug.trim() || undefined,
      usernameConvention: convention,
      sabcrmProjectId,
    });
    setSaving(false);
    if (!res.ok) {
      toast({ title: "Couldn’t save", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Settings saved" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-[var(--zoru-text-secondary,#666)]">
        Where employee mailboxes are created and how their addresses are formed.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Server capabilities</CardTitle>
          <CardDescription>Provisioning needs these configured on the server.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-2">
          <Capability ok={initial.hostedAuthConfigured} label="Login provisioning (Firebase Admin)" />
          <Capability ok={initial.hostedMailConfigured} label="Hosted mail server (Stalwart)" />
          <Capability ok={!!initial.mailWorkspaceId} label="SabMail mail workspace linked" />
          <Capability ok={initial.verifiedDomains.length > 0} label="At least one verified email domain" />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Email domains</CardTitle>
          <CardDescription>
            Verified domains come from your SabMail mail workspace.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {initial.verifiedDomains.length === 0 ? (
              <span className="text-sm text-[var(--zoru-text-secondary,#666)]">
                No verified domains yet.
              </span>
            ) : (
              initial.verifiedDomains.map((d) => (
                <Badge key={d} variant={d === initial.defaultDomain ? "secondary" : "outline"}>
                  {d}
                  {d === initial.defaultDomain ? " · default" : ""}
                </Badge>
              ))
            )}
          </div>
          <div className="flex gap-2 text-sm">
            <Button asChild variant="outline" size="sm">
              <Link href="/sabmail/domains">Manage domains in SabMail</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sabmail/projects">Switch mail workspace</Link>
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Provisioning policy</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Domain policy" help="Custom domain when verified, otherwise a shared SabNode domain.">
            <SelectField
              value={domainMode}
              onChange={(v) => setDomainMode(v as DomainMode)}
              options={DOMAIN_MODE_OPTIONS}
            />
          </Field>
          <Field label="Shared domain" help="e.g. acme.sabnode.email — used when the policy falls back to shared.">
            <Input value={sharedDomain} onChange={(e) => setSharedDomain(e.target.value)} placeholder="acme.sabnode.email" />
          </Field>
          <Field label="Org slug" help="Short identifier used for shared-domain addresses.">
            <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} placeholder="acme" />
          </Field>
          <Field label="Username convention" help="How a new mailbox name is derived from the employee’s name.">
            <SelectField
              value={convention}
              onChange={(v) => setConvention(v as UsernameConvention)}
              options={CONVENTION_OPTIONS}
            />
          </Field>
          <Field
            label="SabCRM project"
            help="Provisioned employees appear under this project in SabCRM → People. The HRM portal always shows them regardless."
          >
            <SelectField
              value={sabcrmProjectId}
              onChange={(v) => setSabcrmProjectId(v ?? "")}
              options={projectOptions}
            />
          </Field>
          <Field
            label="Mail workspace id"
            help="Advanced — the kind:'mail' project id used for mailboxes. Leave blank to auto-resolve your mail project."
          >
            <Input value={mailWorkspaceId} onChange={(e) => setMailWorkspaceId(e.target.value)} placeholder="auto" />
          </Field>

          <div>
            <Button onClick={save} loading={saving} disabled={saving}>
              Save settings
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
