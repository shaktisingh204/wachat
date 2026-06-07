"use client";

/**
 * Ticket Reply Templates. Full list page with KPI strip, filters,
 * bulk actions, and CSV export.
 *
 * RBAC: crm_reply_template (view / edit / delete).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquareText,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Download,
} from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";

import { EntityListShell } from "@/components/crm/entity-list-shell";
import { EntityRowLink } from "@/components/crm/entity-row-link";
import { StatusPill } from "@/components/crm/status-pill";
import { downloadCsv, dateStamp } from "@/lib/crm-list-export";

import {
  getReplyTemplates,
  getReplyTemplateKpis,
  bulkUpdateReplyTemplates,
  bulkDeleteReplyTemplates,
  type ReplyTemplateKpis,
} from "@/app/actions/crm-reply-templates.actions";
import type { CrmReplyTemplateDoc } from "@/lib/rust-client/crm-reply-templates";

/* --- Constants --------------------------------------------------------- */

const BASE = "/dashboard/sabdesk/reply-templates";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "email", label: "Email" },
  { value: "chat", label: "Chat" },
  { value: "sms", label: "SMS" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/* --- KPI strip --------------------------------------------------------- */

interface KpiStripProps {
  kpis: ReplyTemplateKpis;
  loading: boolean;
}

function KpiStrip({ kpis, loading }: KpiStripProps) {
  const categoryCount = Object.keys(kpis.byCategory).length;

  const tiles = [
    { label: "Total templates", value: kpis.total, wide: false },
    { label: "Active", value: kpis.active, wide: false },
    { label: "Categories", value: categoryCount, wide: false },
    {
      label: "Most used",
      value: kpis.mostUsedName
        ? `${kpis.mostUsedName} (${kpis.mostUsedCount}x)`
        : "None yet",
      wide: true,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className={t.wide ? "col-span-2 sm:col-span-1" : ""}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-[12px] font-medium text-[var(--st-text-secondary)]">
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardBody className="pb-4">
              <Skeleton className="h-6 w-16" />
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <StatCard
          key={t.label}
          label={t.label}
          value={t.value}
          className={t.wide ? "col-span-2 sm:col-span-1" : ""}
        />
      ))}
    </div>
  );
}

/* --- Bulk bar ---------------------------------------------------------- */

interface BulkBarProps {
  selectedIds: string[];
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  busy: boolean;
}

function BulkBar({
  selectedIds,
  onActivate,
  onDeactivate,
  onDelete,
  busy,
}: BulkBarProps) {
  const n = selectedIds.length;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-[var(--st-text)]">
        {n} selected
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onActivate}
        disabled={busy}
        iconLeft={ToggleRight}
      >
        Activate
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onDeactivate}
        disabled={busy}
        iconLeft={ToggleLeft}
      >
        Deactivate
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={onDelete}
        disabled={busy}
        iconLeft={Trash2}
      >
        Delete
      </Button>
    </div>
  );
}

/* --- Page -------------------------------------------------------------- */

export default function TicketReplyTemplatesPage() {
  const router = useRouter();

  const [templates, setTemplates] = React.useState<CrmReplyTemplateDoc[]>([]);
  const [kpis, setKpis] = React.useState<ReplyTemplateKpis>({
    total: 0,
    active: 0,
    byCategory: {},
    mostUsedName: null,
    mostUsedCount: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [kpisLoading, setKpisLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  // Selection
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  // Confirmation for delete
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  /* Load data on mount */
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setKpisLoading(true);
      setLoadError(null);

      const [templateRes, kpiRes] = await Promise.all([
        getReplyTemplates({ limit: 200 }),
        getReplyTemplateKpis(),
      ]);

      if (cancelled) return;

      if (templateRes.error) {
        setLoadError(templateRes.error);
      } else {
        setTemplates(templateRes.items);
      }
      setKpis(kpiRes);
      setLoading(false);
      setKpisLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Filtered rows */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q) {
        const inName = t.name.toLowerCase().includes(q);
        const inBody = t.body.toLowerCase().includes(q);
        if (!inName && !inBody) return false;
      }
      if (categoryFilter !== "all") {
        if ((t.category ?? "other") !== categoryFilter) return false;
      }
      if (statusFilter !== "all") {
        const isActive = statusFilter === "active";
        if (t.isActive !== isActive) return false;
      }
      return true;
    });
  }, [templates, search, categoryFilter, statusFilter]);

  /* Selection helpers */
  const allVisibleIds = filtered.map((t) => t._id);
  const allChecked =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someChecked =
    !allChecked && allVisibleIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* Bulk activate */
  async function handleActivate() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    await bulkUpdateReplyTemplates(ids, { isActive: true });
    setTemplates((prev) =>
      prev.map((t) => (selected.has(t._id) ? { ...t, isActive: true } : t)),
    );
    setKpis((prev) => ({
      ...prev,
      active:
        prev.active +
        ids.filter((id) => {
          const t = templates.find((x) => x._id === id);
          return t && !t.isActive;
        }).length,
    }));
    setSelected(new Set());
    setBusy(false);
  }

  /* Bulk deactivate */
  async function handleDeactivate() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    await bulkUpdateReplyTemplates(ids, { isActive: false });
    setTemplates((prev) =>
      prev.map((t) => (selected.has(t._id) ? { ...t, isActive: false } : t)),
    );
    setSelected(new Set());
    setBusy(false);
  }

  /* Bulk delete */
  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    setConfirmDelete(false);
    await bulkDeleteReplyTemplates(ids);
    setTemplates((prev) => prev.filter((t) => !selected.has(t._id)));
    setSelected(new Set());
    setBusy(false);
  }

  /* Export CSV */
  function handleExport() {
    const headers = ["name", "category", "usageCount", "status", "createdAt"];
    const rows = filtered.map((t) => ({
      name: t.name,
      category: t.category ?? "",
      usageCount: t.usageCount,
      status: t.isActive ? "active" : "inactive",
      createdAt: t.createdAt ?? "",
    }));
    downloadCsv(`reply-templates-${dateStamp()}.csv`, headers, rows);
  }

  const selectedIds = [...selected];

  return (
    <EntityListShell
      title="Reply Templates"
      subtitle="Canned responses agents can paste into ticket replies."
      primaryAction={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            iconLeft={Download}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            onClick={() => router.push(`${BASE}/new`)}
            iconLeft={Plus}
          >
            New template
          </Button>
        </div>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="Search by name or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search reply templates"
            className="w-56"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      bulkBar={
        selectedIds.length > 0 ? (
          <BulkBar
            selectedIds={selectedIds}
            onActivate={() => void handleActivate()}
            onDeactivate={() => void handleDeactivate()}
            onDelete={() => void handleDelete()}
            busy={busy}
          />
        ) : null
      }
    >
      {/* KPI strip */}
      <KpiStrip kpis={kpis} loading={kpisLoading} />

      {/* Confirm delete prompt */}
      {confirmDelete ? (
        <Alert
          tone="danger"
          title="Confirm delete"
          className="mt-3"
          onClose={() => setConfirmDelete(false)}
          closeLabel="Cancel delete"
        >
          This will permanently delete {selectedIds.length} template
          {selectedIds.length !== 1 ? "s" : ""}. Click Delete again to confirm,
          or dismiss this notice to cancel.
        </Alert>
      ) : null}

      {/* Table */}
      <Card padding="none" className="mt-3 overflow-x-auto">
        <Table>
          <THead>
            <Tr>
              <Th className="w-10">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={toggleAll}
                  aria-label="Select all visible"
                />
              </Th>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Preview</Th>
              <Th align="right">Used</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {loading ? (
              <Tr>
                <Td
                  colSpan={7}
                  align="center"
                  className="h-24 text-[13px] text-[var(--st-text-secondary)]"
                >
                  Loading templates...
                </Td>
              </Tr>
            ) : loadError ? (
              <Tr>
                <Td
                  colSpan={7}
                  align="center"
                  className="h-24 text-[13px] text-[var(--st-danger)]"
                >
                  {loadError}
                </Td>
              </Tr>
            ) : filtered.length === 0 ? (
              <Tr>
                <Td
                  colSpan={7}
                  align="center"
                  className="h-24 text-[13px] text-[var(--st-text-secondary)]"
                >
                  <MessageSquareText
                    className="mx-auto mb-2 h-6 w-6 text-[var(--st-text-tertiary)]"
                    aria-hidden="true"
                  />
                  No templates match your filters.
                </Td>
              </Tr>
            ) : (
              filtered.map((t) => (
                <Tr key={t._id}>
                  <Td>
                    <Checkbox
                      checked={selected.has(t._id)}
                      onChange={() => toggleOne(t._id)}
                      aria-label={`Select ${t.name}`}
                    />
                  </Td>
                  <Td>
                    <EntityRowLink
                      href={`${BASE}/${t._id}`}
                      label={t.name}
                      subtitle={t.shortcut ? t.shortcut : undefined}
                    />
                  </Td>
                  <Td>
                    {t.category ? (
                      <Badge variant="secondary">{t.category}</Badge>
                    ) : (
                      <span className="text-[var(--st-text-secondary)]">--</span>
                    )}
                  </Td>
                  <Td
                    truncate
                    className="max-w-[280px] text-[12.5px] text-[var(--st-text-secondary)]"
                  >
                    {(t.body ?? "").slice(0, 50)}
                    {(t.body ?? "").length > 50 ? "..." : ""}
                  </Td>
                  <Td align="right" className="tabular-nums text-[var(--st-text)]">
                    {t.usageCount}
                  </Td>
                  <Td>
                    <StatusPill
                      label={t.isActive ? "Active" : "Inactive"}
                      tone={t.isActive ? "green" : "neutral"}
                    />
                  </Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`${BASE}/${t._id}/edit`)}
                    >
                      Edit
                    </Button>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </EntityListShell>
  );
}
