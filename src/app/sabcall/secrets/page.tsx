"use client";

import * as React from "react";
import { KeyRound, Plus, Pencil, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
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
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Skeleton,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  listSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
  type SecretDoc,
} from "./actions";

const KINDS = [
  { value: "sip_password", label: "SIP password" },
  { value: "api_key", label: "API key" },
  { value: "token", label: "Token" },
  { value: "other", label: "Other" },
];

type Draft = {
  name: string;
  kind: SecretDoc["kind"];
  vaultRef: string;
  note: string;
  status: string;
};

const EMPTY: Draft = { name: "", kind: "sip_password", vaultRef: "", note: "", status: "active" };

export default function SabcallSecretsPage() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SecretDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await listSecrets({ limit: 200 });
    setRows(res.items);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditId(null);
    setDraft(EMPTY);
    setOpen(true);
  };
  const openEdit = (s: SecretDoc) => {
    setEditId(s._id);
    setDraft({
      name: s.name,
      kind: s.kind,
      vaultRef: s.vaultRef,
      note: s.note ?? "",
      status: s.status ?? "active",
    });
    setOpen(true);
  };

  const save = React.useCallback(async () => {
    if (!draft.name.trim() || !draft.vaultRef.trim()) {
      toast({ title: "Name and vault reference are required", variant: "destructive" });
      return;
    }
    setBusy(true);
    const res = editId ? await updateSecret(editId, draft) : await createSecret(draft);
    setBusy(false);
    if (res) {
      setOpen(false);
      toast({ title: editId ? "Secret updated" : "Secret added" });
      void load();
    } else {
      toast({ title: "Save failed", variant: "destructive" });
    }
  }, [draft, editId, toast, load]);

  const remove = React.useCallback(
    async (id: string) => {
      await deleteSecret(id);
      setRows((r) => r.filter((x) => x._id !== id));
      toast({ title: "Secret deleted" });
    },
    [toast],
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Secrets vault</PageTitle>
          <PageDescription>
            Named references to SIP passwords, provider keys, and tokens. Values
            live in SabVault / your secret store — this registry holds the
            reference that trunks and credentials point at.
          </PageDescription>
        </PageHeaderHeading>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew} className="sc-press">
          New secret
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<KeyRound aria-hidden />}
            title="No secrets yet"
            description="Register a secret reference so trunks and SIP credentials can point at it."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((s) => (
            <li key={s._id}>
              <Card className="sc-card flex items-center gap-3 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                  <KeyRound className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--st-text)]">{s.name}</div>
                  <div className="truncate text-xs text-[var(--st-text-secondary)]">
                    ref: {s.vaultRef}
                  </div>
                </div>
                <Badge variant="outline">{s.kind}</Badge>
                <Button size="sm" variant="ghost" iconLeft={Pencil} onClick={() => openEdit(s)} className="sc-press">
                  Edit
                </Button>
                <Button size="sm" variant="ghost" iconLeft={Trash2} onClick={() => void remove(s._id)} className="sc-press">
                  Delete
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit secret" : "New secret"}</DialogTitle>
            <DialogDescription>
              The value is stored in SabVault — enter only its reference key here.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. acme-trunk-password"
              />
            </Field>
            <Field label="Kind">
              <SelectField
                value={draft.kind}
                onChange={(v) => setDraft((d) => ({ ...d, kind: (v as SecretDoc["kind"]) ?? "other" }))}
                options={KINDS}
              />
            </Field>
            <Field label="Vault reference" help="The key in SabVault / your secret store.">
              <Input
                value={draft.vaultRef}
                onChange={(e) => setDraft((d) => ({ ...d, vaultRef: e.target.value }))}
                placeholder="e.g. sabvault://sabcall/acme-trunk-password"
              />
            </Field>
            <Field label="Note (optional)">
              <Input
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              />
            </Field>
            <Field label="Status">
              <SelectField
                value={draft.status}
                onChange={(v) => setDraft((d) => ({ ...d, status: v ?? "active" }))}
                options={[
                  { value: "active", label: "Active" },
                  { value: "disabled", label: "Disabled" },
                ]}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={busy} disabled={busy} onClick={() => void save()} className="sc-press">
              {editId ? "Save" : "Add secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
