"use client";

/**
 * SabSMS lists — main table client component.
 *
 * Owns the 20 page-unique features for /sabsms/lists:
 *   - Create / duplicate / delete / tag
 *   - Add / remove contacts (paste + search)
 *   - Convert list → segment / suppression
 *   - Auto-expire + read-only share link
 *   - Compare overlap (select 2)
 *   - Cross-link to campaigns using the list
 *   - Audit + membership history drawer
 *   - Cost estimate + analytics row
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  ListChecks,
  ListPlus,
  Send,
  Share2,
  ShieldBan,
  Tag,
  Trash2,
  Users,
  UserPlus,
} from "lucide-react";

import {
  SabsmsPageShell,
  SabsmsFilterBar,
  SabsmsDataTable,
  SabsmsExportMenu,
  SabsmsRefreshButton,
  SabsmsDetailDrawer,
  type SabsmsColumn,
  type SabsmsRowAction,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";
import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  StatCard,
  Textarea,
  zoruSonnerToast,
} from "@/components/zoruui";
import { SabFilePickerButton, type SabFilePick } from "@/components/sabfiles";

import {
  addContactsToList,
  compareLists,
  convertListToSuppression,
  createList,
  deleteList,
  duplicateList,
  exportListCsv,
  removeContactsFromList,
  setListShareToken,
  tagList,
  estimateDynamicListSize,
  toggleListLock,
  updateList,
  type ListAnalytics,
  type ListRecord,
} from "./actions";
import { parsePhoneList } from "./helpers";
import { parseCsv } from "../imports/parse";
import { PredicateCanvas } from "../segments/new/predicate-canvas";
import { emptyGroup, type SegmentNode } from "../segments/new/evaluate";

// Default per-message cost (USD). Mirrors what /sabsms/send shows so the
// estimate is consistent across the app.
const DEFAULT_COST_PER_MESSAGE = 0.0075;

export interface ListsTableProps {
  workspaceId: string;
  initialLists: ListRecord[];
  analytics: ListAnalytics;
}

type DialogKind =
  | "create"
  | "edit"
  | "add"
  | "share"
  | "tag"
  | "compare"
  | null;

export function ListsTable({
  workspaceId,
  initialLists,
  analytics,
}: ListsTableProps) {
  const router = useRouter();
  const [lists, setLists] = React.useState<ListRecord[]>(initialLists);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [activeList, setActiveList] = React.useState<ListRecord | null>(null);
  const [drawerList, setDrawerList] = React.useState<ListRecord | null>(null);

  React.useEffect(() => {
    setLists(initialLists);
  }, [initialLists]);

  const handleRefresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  function openDialog(kind: DialogKind, list?: ListRecord) {
    setActiveList(list ?? null);
    setDialog(kind);
  }

  async function withToast(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    const result = await fn();
    if (result.ok) {
      zoruSonnerToast.success(`${label} succeeded.`);
      handleRefresh();
    } else {
      zoruSonnerToast.error(`${label} failed: ${result.error ?? "Unknown"}`);
    }
  }

  const columns: SabsmsColumn<ListRecord>[] = [
    {
      id: "name",
      header: "Name",
      render: (r) => (
        <button
          type="button"
          className="text-left font-medium text-slate-800 hover:underline"
          onClick={() => setDrawerList(r)}
        >
          {r.name}
        </button>
      ),
    },
    {
      id: "kind",
      header: "Kind",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] capitalize">
            {r.kind || "Static"}
          </Badge>
          {r.isLocked && (
            <Lock className="h-3 w-3 text-amber-500" title="Locked" />
          )}
        </div>
      ),
    },
    {
      id: "members",
      header: "Members",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-slate-700">
          {r.memberCount.toLocaleString()}
        </span>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      render: (r) =>
        r.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {r.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
            {r.tags.length > 3 && (
              <span className="text-[10px] text-slate-500">
                +{r.tags.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "cost",
      header: "Est. cost",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-xs text-slate-700">
          ${(r.memberCount * DEFAULT_COST_PER_MESSAGE).toFixed(2)}
        </span>
      ),
    },
    {
      id: "expires",
      header: "Expires",
      render: (r) =>
        r.expiresAt ? (
          <span className="text-xs text-slate-600">
            {new Date(r.expiresAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      id: "updated",
      header: "Updated",
      render: (r) => (
        <span className="text-xs text-slate-600">
          {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  const rowActions: SabsmsRowAction<ListRecord>[] = [
    {
      label: "Edit list",
      icon: <ListChecks className="h-3.5 w-3.5" />,
      onSelect: (r) => openDialog("edit", r),
    },
    {
      label: "Lock / Unlock",
      icon: <ShieldBan className="h-3.5 w-3.5" />,
      onSelect: (r) => withToast("Toggle lock", () => toggleListLock(r.id, !r.isLocked)),
    },
    {
      label: "Add contacts",
      icon: <UserPlus className="h-3.5 w-3.5" />,
      onSelect: (r) => openDialog("add", r),
    },
    {
      label: "Send to list",
      icon: <Send className="h-3.5 w-3.5" />,
      onSelect: (r) => router.push(`/sabsms/send?listId=${r.id}`),
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-3.5 w-3.5" />,
      onSelect: (r) => withToast("Duplicate", () => duplicateList(r.id)),
    },
    {
      label: "Tag / label",
      icon: <Tag className="h-3.5 w-3.5" />,
      onSelect: (r) => openDialog("tag", r),
    },
    {
      label: "Share link",
      icon: <Share2 className="h-3.5 w-3.5" />,
      onSelect: (r) => openDialog("share", r),
    },
    {
      label: "Convert → suppression",
      icon: <ShieldBan className="h-3.5 w-3.5" />,
      onSelect: (r) =>
        withToast("Convert to suppression", () => convertListToSuppression(r.id)),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      destructive: true,
      onSelect: (r) => withToast("Delete", () => deleteList(r.id)),
    },
  ];

  return (
    <SabsmsPageShell
      eyebrow="Audiences"
      title="Lists"
      description="Static contact lists. Hand-curated audiences for campaigns, drips, and ad-hoc broadcasts."
      breadcrumbs={[{ label: "Lists" }]}
      primaryAction={{
        label: "New list",
        onClick: () => openDialog("create"),
      }}
      helpTitle="About lists"
      helpBody={
        <ul className="list-disc space-y-1 pl-4 text-xs">
          <li>Lists are static — to grow with criteria, convert one to a segment.</li>
          <li>
            Phone numbers are stored in E.164 form; duplicates are deduped
            automatically.
          </li>
          <li>Read-only share links let stakeholders view membership without sign-in.</li>
        </ul>
      }
      secondaryActions={[
        { label: "Mapping templates", icon: <ListChecks className="h-3.5 w-3.5" /> },
        {
          label: "Compare two lists…",
          icon: <Users className="h-3.5 w-3.5" />,
          onSelectAction: () => openDialog("compare"),
        },
      ]}
      toolbar={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Lists"
              value={analytics.totalLists.toLocaleString()}
              icon={<ListPlus className="h-4 w-4" />}
            />
            <StatCard
              label="Total members"
              value={analytics.totalMembers.toLocaleString()}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              label="Average size"
              value={analytics.averageSize.toLocaleString()}
            />
            <StatCard
              label="Fresh / stale"
              value={`${analytics.freshLists} / ${analytics.staleLists}`}
              period="vs 30-day window"
            />
          </div>

          <SabsmsFilterBar
            searchPlaceholder="Search lists by name…"
            sortOptions={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "largest", label: "Largest first" },
              { value: "name", label: "Name A→Z" },
            ]}
            defaultSort="newest"
            trailing={
              <>
                <SabsmsRefreshButton onRefresh={handleRefresh} />
                <SabsmsExportMenu
                  filename="sabsms-lists"
                  toCsv={async () =>
                    rowsToCsv(
                      lists.map((l) => ({
                        name: l.name,
                        memberCount: l.memberCount,
                        tags: l.tags.join("|"),
                        updatedAt: l.updatedAt,
                      })),
                      [
                        { key: "name", header: "Name" },
                        { key: "memberCount", header: "Members" },
                        { key: "tags", header: "Tags" },
                        { key: "updatedAt", header: "Updated" },
                      ],
                    )
                  }
                />
              </>
            }
          />
        </div>
      }
    >
      <SabsmsDataTable<ListRecord>
        rows={lists}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        rowActions={rowActions}
        bulkActions={[
          {
            label: "Compare overlap",
            icon: <Users className="h-3.5 w-3.5" />,
            onSelect: () => openDialog("compare"),
          },
          {
            label: "Delete selected",
            icon: <Trash2 className="h-3.5 w-3.5" />,
            destructive: true,
            onSelect: async (rows) => {
              await Promise.all(rows.map((r) => deleteList(r.id)));
              zoruSonnerToast.success(`Deleted ${rows.length} list(s).`);
              setSelectedIds([]);
              handleRefresh();
            },
          },
        ]}
        emptyTitle="No lists yet"
        emptyDescription="Create your first list to start sending broadcasts."
        emptyAction={{
          label: "New list",
          onClick: () => openDialog("create"),
        }}
      />

            <EditListDialog
        open={dialog === "edit"}
        list={activeList}
        onOpenChange={(o) => !o && setDialog(null)}
        onUpdated={handleRefresh}
      />
      <CreateListDialog
        open={dialog === "create"}
        onOpenChange={(o) => !o && setDialog(null)}
        onCreated={handleRefresh}
      />
      <AddContactsDialog
        open={dialog === "add"}
        list={activeList}
        onOpenChange={(o) => !o && setDialog(null)}
        onChanged={handleRefresh}
      />
      <TagDialog
        open={dialog === "tag"}
        list={activeList}
        onOpenChange={(o) => !o && setDialog(null)}
        onSaved={handleRefresh}
      />
      <ShareDialog
        open={dialog === "share"}
        list={activeList}
        onOpenChange={(o) => !o && setDialog(null)}
        onSaved={handleRefresh}
      />
      <CompareDialog
        open={dialog === "compare"}
        lists={lists}
        preselected={selectedIds.slice(0, 2)}
        onOpenChange={(o) => !o && setDialog(null)}
      />

      <SabsmsDetailDrawer
        open={drawerList !== null}
        onOpenChange={(o) => !o && setDrawerList(null)}
        title={drawerList?.name ?? "List"}
        description="Membership preview, audit trail, and cross-references."
      >
        {drawerList && (
          <ListDetail
            workspaceId={workspaceId}
            list={drawerList}
            onRemove={async (phones) => {
              await removeContactsFromList({
                listId: drawerList.id,
                phones,
              });
              handleRefresh();
            }}
          />
        )}
      </SabsmsDetailDrawer>
    </SabsmsPageShell>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────

function CreateListDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<"static" | "dynamic">("static");
  const [predicate, setPredicate] = React.useState<SegmentNode>(emptyGroup("and"));
  const [tagsRaw, setTagsRaw] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [estimate, setEstimate] = React.useState<{ matched: number; scanned: number } | null>(null);
  const [estimating, setEstimating] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setKind("static");
      setPredicate(emptyGroup("and"));
      setTagsRaw("");
      setExpiresAt("");
      setError(null);
      setEstimate(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (kind !== "dynamic" || !open) return;
    const t = setTimeout(() => {
      setEstimating(true);
      estimateDynamicListSize(predicate).then((res) => {
        if (res.ok) setEstimate({ matched: res.matched, scanned: res.scanned });
        setEstimating(false);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [predicate, kind, open]);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const result = await createList({
        name,
        description: description || undefined,
        kind,
        predicate: kind === "dynamic" ? predicate : undefined,
        tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
        expiresAt: expiresAt || undefined,
      });
      if (result.ok) {
        zoruSonnerToast.success(`Created list "${name}".`);
        onOpenChange(false);
        onCreated();
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Create list</ZoruDialogTitle>
          <ZoruDialogDescription>
            Lists can be static (manual contacts) or dynamic (filtered automatically).
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VIP customers"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "static" | "dynamic")}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="static">Static (manual members)</option>
                <option value="dynamic">Dynamic (filters)</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this list represents."
              rows={2}
            />
          </div>

          {kind === "dynamic" && (
            <div className="space-y-3 rounded-md border border-slate-200 p-4 bg-slate-50">
              <div className="flex justify-between items-center mb-2">
                <Label className="block">Dynamic Filters</Label>
                <div className="text-xs font-medium text-slate-500">
                  {estimating ? (
                    "Estimating..."
                  ) : estimate ? (
                    `Matches ${estimate.matched.toLocaleString()} of ${estimate.scanned.toLocaleString()} contacts`
                  ) : (
                    ""
                  )}
                </div>
              </div>
              <div className="bg-white rounded-md border border-slate-200 p-3">
                <PredicateCanvas predicate={predicate} onChange={setPredicate} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="vip, q1-promo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auto-expire (optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <ZoruAlertTitle>Could not create list</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          )}
        </div>

        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create list"}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}


function AddContactsDialog({
  open,
  list,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  list: ListRecord | null;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const [paste, setPaste] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setPaste("");
      setSearch("");
      setError(null);
    }
  }, [open]);

  const parsed = React.useMemo(() => parsePhoneList(paste), [paste]);

  async function handleAdd() {
    if (!list) return;
    setBusy(true);
    setError(null);
    try {
      const result = await addContactsToList({
        listId: list.id,
        phones: parsed.valid,
      });
      if (result.ok) {
        zoruSonnerToast.success(`Added ${result.added} contact(s).`);
        onOpenChange(false);
        onChanged();
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCsvPick(pick: SabFilePick) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(pick.url);
      const text = await res.text();
      const csv = parseCsv(text);
      const phoneCol =
        csv.headers.find((h) => /phone|mobile|msisdn/i.test(h)) ?? csv.headers[0];
      const rawPhones = csv.rows
        .map((r) => r[phoneCol] ?? "")
        .filter(Boolean);
      const combined = `${paste}\n${rawPhones.join("\n")}`;
      setPaste(combined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read CSV.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle>
            Add contacts to {list?.name ?? "list"}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            Paste phone numbers (one per line) or import a CSV via SabFiles.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Search existing contacts</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="By name or phone…"
            />
            <p className="text-[11px] text-slate-500">
              TODO(follow-up): wire to /sabsms/contacts search.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Paste phones</Label>
            <Textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"+15550001111\n+15550002222"}
              rows={6}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-500">
                {parsed.valid.length} valid, {parsed.invalid.length} invalid.
              </p>
              <SabFilePickerButton
                accept="document"
                variant="ghost"
                onPick={handleCsvPick}
              >
                Or import CSV
              </SabFilePickerButton>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <ZoruAlertTitle>Could not add contacts</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          )}
        </div>

        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={busy || parsed.valid.length === 0}
          >
            {busy ? "Adding…" : `Add ${parsed.valid.length}`}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

function TagDialog({
  open,
  list,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  list: ListRecord | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [tagsRaw, setTagsRaw] = React.useState("");
  React.useEffect(() => {
    if (open && list) setTagsRaw(list.tags.join(", "));
  }, [open, list]);

  async function handleSave() {
    if (!list) return;
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await tagList({ listId: list.id, tags });
    if (result.ok) {
      zoruSonnerToast.success("Tags updated.");
      onOpenChange(false);
      onSaved();
    } else {
      zoruSonnerToast.error(`Failed: ${result.error}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Tag {list?.name}</ZoruDialogTitle>
        </ZoruDialogHeader>
        <Input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="vip, q1-promo"
        />
        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

function ShareDialog({
  open,
  list,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  list: ListRecord | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    setToken(list?.shareToken ?? null);
  }, [list]);

  async function handleEnable(enable: boolean) {
    if (!list) return;
    const result = await setListShareToken({ listId: list.id, enable });
    if (result.ok) {
      setToken(result.token);
      onSaved();
    } else {
      zoruSonnerToast.error(`Failed: ${result.error}`);
    }
  }

  const url = token ? `/sabsms/lists/share/${token}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Share {list?.name}</ZoruDialogTitle>
          <ZoruDialogDescription>
            Generate a read-only link to share list membership.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        {url ? (
          <div className="space-y-2">
            <Input value={url} readOnly />
            <Button
              variant="outline"
              onClick={() => handleEnable(false)}
              className="w-full"
            >
              Revoke link
            </Button>
          </div>
        ) : (
          <Button onClick={() => handleEnable(true)}>
            Generate share link
          </Button>
        )}
        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

function CompareDialog({
  open,
  lists,
  preselected,
  onOpenChange,
}: {
  open: boolean;
  lists: ListRecord[];
  preselected: string[];
  onOpenChange: (o: boolean) => void;
}) {
  const [a, setA] = React.useState(preselected[0] ?? "");
  const [b, setB] = React.useState(preselected[1] ?? "");
  const [result, setResult] = React.useState<
    { onlyA: number; onlyB: number; both: number } | null
  >(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setA(preselected[0] ?? "");
      setB(preselected[1] ?? "");
      setResult(null);
    }
  }, [open, preselected]);

  async function handleRun() {
    if (!a || !b || a === b) return;
    setBusy(true);
    try {
      const res = await compareLists(a, b);
      if (res.ok) {
        setResult({ onlyA: res.onlyA, onlyB: res.onlyB, both: res.both });
      } else {
        zoruSonnerToast.error(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Compare two lists</ZoruDialogTitle>
          <ZoruDialogDescription>
            See how much two lists overlap.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>List A</Label>
            <select
              value={a}
              onChange={(e) => setA(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>List B</Label>
            <select
              value={b}
              onChange={(e) => setB(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          {result && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-slate-50 p-2">
                <div className="font-semibold text-slate-800">{result.onlyA}</div>
                <div className="text-slate-500">Only in A</div>
              </div>
              <div className="rounded-md bg-emerald-50 p-2">
                <div className="font-semibold text-emerald-800">{result.both}</div>
                <div className="text-emerald-600">In both</div>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <div className="font-semibold text-slate-800">{result.onlyB}</div>
                <div className="text-slate-500">Only in B</div>
              </div>
            </div>
          )}
        </div>

        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleRun} disabled={!a || !b || a === b || busy}>
            {busy ? "Comparing…" : "Compare"}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────

function ListDetail({
  workspaceId,
  list,
  onRemove,
}: {
  workspaceId: string;
  list: ListRecord;
  onRemove: (phones: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  function toggle(phone: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  async function handleRemoveSelected() {
    await onRemove(Array.from(selected));
    setSelected(new Set());
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind" value={<span className="capitalize">{list.kind || "static"}</span>} />
        <Field label="Members" value={list.memberCount.toLocaleString()} />
        <Field
          label="Estimated cost"
          value={`$${(list.memberCount * DEFAULT_COST_PER_MESSAGE).toFixed(2)}`}
        />
        <Field
          label="Created"
          value={list.createdAt ? new Date(list.createdAt).toLocaleDateString() : "—"}
        />
        <Field
          label="Updated"
          value={list.updatedAt ? new Date(list.updatedAt).toLocaleDateString() : "—"}
        />
        {list.expiresAt && (
          <Field
            label="Expires"
            value={new Date(list.expiresAt).toLocaleDateString()}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link href={`/sabsms/send?listId=${list.id}`}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Send to list
          </Link>
        </Button>
        <SabsmsExportMenu
          filename={`sabsms-list-${list.id}`}
          toCsv={async () => exportListCsv(workspaceId, list.id)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">Members</h3>
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveSelected}
            >
              Remove {selected.size} selected
            </Button>
          )}
        </div>
        <div className="max-h-[280px] overflow-y-auto rounded-md border border-slate-200">
          {list.members.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-500">
              This list has no members yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.members.slice(0, 200).map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p)}
                    onChange={() => toggle(p)}
                    aria-label={`Select ${p}`}
                  />
                  <code className="text-[11px] text-slate-700">{p}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
        {list.members.length > 200 && (
          <p className="text-[11px] text-slate-500">
            Showing 200 of {list.memberCount.toLocaleString()} — export to see all.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700">Audit / history</h3>
        <ol className="space-y-2">
          {list.audit.map((evt, i) => (
            <li
              key={i}
              className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"
            >
              <div className="font-medium text-slate-700">{evt.kind}</div>
              {evt.message && (
                <div className="text-slate-600">{evt.message}</div>
              )}
              <div className="mt-0.5 text-[10px] text-slate-400">
                {new Date(evt.at).toLocaleString()}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  );
}

function EditListDialog({
  open,
  list,
  onOpenChange,
  onUpdated,
}: {
  open: boolean;
  list: ListRecord | null;
  onOpenChange: (o: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<"static" | "dynamic">("static");
  const [predicate, setPredicate] = React.useState<SegmentNode>(emptyGroup("and"));
  const [tagsRaw, setTagsRaw] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [estimate, setEstimate] = React.useState<{ matched: number; scanned: number } | null>(null);
  const [estimating, setEstimating] = React.useState(false);

  React.useEffect(() => {
    if (open && list) {
      setName(list.name);
      setDescription(list.description || "");
      setKind(list.kind || "static");
      setPredicate(list.predicate || emptyGroup("and"));
      setTagsRaw((list.tags || []).join(", "));
      setExpiresAt(list.expiresAt ? list.expiresAt.split("T")[0] : "");
      setError(null);
      setEstimate(null);
    }
  }, [open, list]);

  React.useEffect(() => {
    if (kind !== "dynamic" || !open) return;
    const t = setTimeout(() => {
      setEstimating(true);
      estimateDynamicListSize(predicate).then((res) => {
        if (res.ok) setEstimate({ matched: res.matched, scanned: res.scanned });
        setEstimating(false);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [predicate, kind, open]);

  async function handleSubmit() {
    if (!list) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateList({
        listId: list.id,
        name,
        description: description || undefined,
        kind,
        predicate: kind === "dynamic" ? predicate : undefined,
        tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
        expiresAt: expiresAt || undefined,
      });
      if (result.ok) {
        zoruSonnerToast.success(`Updated list "${name}".`);
        onOpenChange(false);
        onUpdated();
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  const locked = list?.isLocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Edit list</ZoruDialogTitle>
          <ZoruDialogDescription>
            {locked ? "This list is locked. Unlock it to make changes." : "Update configuration or filters."}
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={locked}
                placeholder="VIP customers"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "static" | "dynamic")}
                disabled={locked}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="static">Static (manual members)</option>
                <option value="dynamic">Dynamic (filters)</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={locked}
              placeholder="What this list represents."
              rows={2}
            />
          </div>

          {kind === "dynamic" && (
            <div className="space-y-3 rounded-md border border-slate-200 p-4 bg-slate-50">
              <div className="flex justify-between items-center mb-2">
                <Label className="block">Dynamic Filters</Label>
                <div className="text-xs font-medium text-slate-500">
                  {estimating ? (
                    "Estimating..."
                  ) : estimate ? (
                    `Matches ${estimate.matched.toLocaleString()} of ${estimate.scanned.toLocaleString()} contacts`
                  ) : (
                    ""
                  )}
                </div>
              </div>
              <div className="bg-white rounded-md border border-slate-200 p-3">
                {locked ? (
                  <div className="p-4 text-center text-sm text-slate-500">Filters are locked</div>
                ) : (
                  <PredicateCanvas predicate={predicate} onChange={setPredicate} />
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                disabled={locked}
                placeholder="vip, q1-promo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Auto-expire (optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={locked}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <ZoruAlertTitle>Could not update list</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          )}
        </div>

        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!locked && (
            <Button onClick={handleSubmit} disabled={busy || !name.trim()}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          )}
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
