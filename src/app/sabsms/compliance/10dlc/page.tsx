"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  SabsmsPageShell,
  SabsmsDataTable,
  SabsmsEmpty,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Input,
  Label,
  Badge,
  StatCard,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/sabcrm/20ui";
import { ShieldCheck, Info, Pencil, Building2 } from "lucide-react";
import { toast } from "sonner";

import {
  loadTenDlcPage,
  saveTenDlcRegistration,
  type TenDlcPageData,
  type TenDlcAccountRow,
  type TenDlcRegistrationRow,
} from "./actions";

type TenDlcStatus = TenDlcAccountRow["status"];

const STATUS_LABEL: Record<TenDlcStatus, string> = {
  unregistered: "Unregistered",
  pending: "Pending",
  registered: "Registered",
  rejected: "Rejected",
};

function statusVariant(s: TenDlcStatus): "secondary" | "outline" | "destructive" {
  if (s === "registered") return "secondary";
  if (s === "rejected") return "destructive";
  return "outline";
}

export default function TenDlcRegistrationPage() {
  const [data, setData] = useState<TenDlcPageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TenDlcAccountRow | null>(null);
  const [draft, setDraft] = useState<{
    accountId: string;
    status: TenDlcStatus;
    brandId: string;
    campaignId: string;
    notes: string;
  }>({ accountId: "", status: "pending", brandId: "", campaignId: "", notes: "" });

  const refresh = React.useCallback(() => {
    loadTenDlcPage().then((res) => {
      if (res.success) {
        setData(res.data);
        setLoadError(null);
      } else {
        setLoadError(res.error);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEditor = (account: TenDlcAccountRow) => {
    setEditing(account);
    setDraft({
      accountId: account.id,
      status: account.status === "unregistered" ? "pending" : account.status,
      brandId: account.brandId ?? "",
      campaignId: account.campaignId ?? "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveTenDlcRegistration({
        accountId: draft.accountId,
        status: draft.status,
        brandId: draft.brandId,
        campaignId: draft.campaignId,
        notes: draft.notes,
      });
      if (res.success) {
        toast.success(
          draft.status === "registered"
            ? "Saved — US marketing is now unblocked for this account."
            : "10DLC status saved.",
        );
        setDialogOpen(false);
        refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const accountColumns: SabsmsColumn<TenDlcAccountRow>[] = [
    {
      id: "provider",
      header: "Provider account",
      render: (a) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <div className="flex flex-col">
            <span className="font-medium capitalize">{a.provider || "—"}</span>
            <span className="text-xs text-[var(--st-text-secondary)]">
              {a.region || ""} {a.isDefault ? "· default" : ""}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "10DLC status",
      render: (a) => (
        <Badge variant={statusVariant(a.status)}>{STATUS_LABEL[a.status]}</Badge>
      ),
    },
    {
      id: "brandId",
      header: "Brand ID",
      render: (a) => <span className="font-mono text-sm">{a.brandId || "—"}</span>,
    },
    {
      id: "campaignId",
      header: "Campaign ID",
      render: (a) => (
        <span className="font-mono text-sm">{a.campaignId || "—"}</span>
      ),
    },
    {
      id: "updatedAt",
      header: "Updated",
      render: (a) => (
        <span className="text-sm text-[var(--st-text-secondary)]">
          {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  const accountActions: SabsmsRowAction<TenDlcAccountRow>[] = [
    { label: "Edit 10DLC status", icon: <Pencil className="h-4 w-4" />, onSelect: openEditor },
  ];

  const historyColumns: SabsmsColumn<TenDlcRegistrationRow>[] = [
    {
      id: "createdAt",
      header: "When",
      render: (r) => (
        <span className="text-sm">{new Date(r.createdAt).toLocaleString()}</span>
      ),
    },
    {
      id: "provider",
      header: "Provider",
      render: (r) => <span className="capitalize">{r.provider || "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge>
      ),
    },
    {
      id: "brandId",
      header: "Brand / Campaign",
      render: (r) => (
        <span className="font-mono text-xs">
          {r.brandId || "—"}
          {r.campaignId ? ` / ${r.campaignId}` : ""}
        </span>
      ),
    },
    {
      id: "notes",
      header: "Notes",
      render: (r) => (
        <span className="text-sm text-[var(--st-text-secondary)]">
          {r.notes || "—"}
        </span>
      ),
    },
  ];

  return (
    <SabsmsPageShell
      title="10DLC Registration (US)"
      eyebrow="Compliance"
      description="Record your A2P 10DLC brand & campaign registration for each provider account. The send engine blocks US marketing until an account is marked Registered."
      breadcrumbs={[
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "10DLC" },
      ]}
      helpTitle="What is 10DLC?"
      helpBody="10-Digit Long Code (10DLC) is the US standard for A2P SMS. Brands and campaigns must be registered with The Campaign Registry (TCR), usually via your provider's console. There is no automated TCR sync here yet — enter the brand/campaign IDs your provider gives you so the engine knows the account is cleared."
    >
      <div className="mb-6 flex items-start gap-3 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 p-4 text-sm">
        <Info className="h-5 w-5 shrink-0 text-[var(--st-text-secondary)]" />
        <p className="text-[var(--st-text-secondary)]">
          Manual entry. Register your brand/campaign with TCR through your
          provider's console, then record the resulting IDs here. Marking an
          account <strong>Registered</strong> is what unblocks US marketing
          sends in the compliance kernel — there is no fake auto-sync.
        </p>
      </div>

      {loadError && (
        <Card className="mb-6">
          <CardBody>
            <p className="text-sm text-[var(--st-text)]">{loadError}</p>
          </CardBody>
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Provider accounts"
          value={data ? data.accounts.length.toLocaleString() : "…"}
        />
        <StatCard
          label="Registered (US marketing cleared)"
          value={data ? data.registeredCount.toLocaleString() : "…"}
        />
        <StatCard
          label="Registration entries"
          value={data ? data.history.length.toLocaleString() : "…"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Provider accounts
          </CardTitle>
          <CardDescription>
            Each provider account carries its own 10DLC registration state.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {data && data.accounts.length === 0 ? (
            <SabsmsEmpty
              icon={<Building2 className="h-6 w-6" />}
              title="No provider accounts"
              description="Add a provider account under SabSMS settings first; then return here to record its 10DLC registration."
              action={{ label: "Provider settings", href: "/sabsms/providers" }}
            />
          ) : (
            <SabsmsDataTable
              rowKey={(a) => a.id}
              rows={data?.accounts ?? []}
              columns={accountColumns}
              rowActions={accountActions}
              loading={!data && !loadError}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registration history</CardTitle>
          <CardDescription>
            Every manual 10DLC entry, newest first.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {data && data.history.length === 0 ? (
            <SabsmsEmpty
              title="No registration entries yet"
              description="Edit an account above to record its first 10DLC status."
            />
          ) : (
            <SabsmsDataTable
              rowKey={(r) => r.id}
              rows={data?.history ?? []}
              columns={historyColumns}
              loading={!data && !loadError}
            />
          )}
        </CardBody>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              10DLC status · {editing?.provider}
            </DialogTitle>
            <DialogDescription>
              Enter the brand/campaign IDs from your provider/TCR console. This
              is recorded as-is — there is no automated verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, status: v as TenDlcStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unregistered">Unregistered</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="registered">
                    Registered (unblocks US marketing)
                  </SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Brand ID</Label>
              <Input
                placeholder="e.g. BXXXXXX"
                value={draft.brandId}
                onChange={(e) => setDraft((d) => ({ ...d, brandId: e.target.value }))}
              />
              <p className="text-xs text-[var(--st-text-secondary)]">
                Required to mark the account Registered.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Campaign ID</Label>
              <Input
                placeholder="e.g. CXXXXXX"
                value={draft.campaignId}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, campaignId: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Standard vetting, T-Mobile tier approved"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save registration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
