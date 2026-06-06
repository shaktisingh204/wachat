'use client';

/**
 * Modules — list page with:
 *  KPIs: total modules, enabled, disabled
 *  Search across display name / slug / description
 *  Filter chips: All / Enabled / Disabled
 *  Bulk enable / disable
 *  RowDrawer on name to view module details
 *  Inline edit + add dialog
 */

import * as React from 'react';
import { useActionState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  CheckCircle2,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  XCircle,
  X,
} from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, IconPicker, Input, Label, StatCard, Switch, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import {
  getModules,
  saveModule,
  deleteModule,
  toggleModule,
  toggleModuleInMenu,
} from '@/app/actions/worksuite/rbac.actions';
import type { WsModule } from '@/lib/worksuite/rbac-types';

type Row = WsModule & { _id: string };
type StatusFilter = 'all' | 'enabled' | 'disabled';

export default function ModulesPage(): React.JSX.Element {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, startLoading] = React.useTransition();
  const [isBusy, startBusy] = React.useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [icon, setIcon] = React.useState<string>('');
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = React.useState<'enable' | 'disable' | null>(null);

  React.useEffect(() => {
    setIcon(editing?.icon ?? '');
  }, [editing]);

  const [saveState, saveAction, isSaving] = useActionState(saveModule, {
    message: '',
    error: '',
  } as { message: string; error: string });

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const list = (await getModules()) as Row[];
      setRows(Array.isArray(list) ? list : []);
    });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
  }, [saveState, toast, refresh]);

  const handleSearch = useDebouncedCallback(
    (v: string) => setSearch(v),
    200,
  );

  const flip = (id: string, which: 'active' | 'menu') =>
    startBusy(async () => {
      const res =
        which === 'active' ? await toggleModule(id) : await toggleModuleInMenu(id);
      if (res.success) refresh();
      else
        toast({
          title: 'Error',
          description: res.error || 'Toggle failed',
          variant: 'destructive',
        });
    });

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteModule(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Module removed.' });
      setDeletingId(null);
      setSelected((cur) => {
        const n = new Set(cur);
        n.delete(deletingId);
        return n;
      });
      refresh();
    } else {
      toast({ title: 'Error', description: res.error || 'Failed', variant: 'destructive' });
    }
  };

  const handleBulkToggle = async (enable: boolean) => {
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      const row = rows.find((r) => r._id === id);
      const alreadyCorrect = enable ? row?.is_active : !row?.is_active;
      if (alreadyCorrect) { ok += 1; continue; }
      const res = await toggleModule(id);
      if (res.success) ok += 1;
      else fail += 1;
    }
    toast({
      title: fail === 0 ? (enable ? 'Enabled' : 'Disabled') : 'Partial',
      description: `${ok} updated, ${fail} failed.`,
      variant: fail === 0 ? undefined : 'destructive',
    });
    setSelected(new Set());
    setBulkAction(null);
    refresh();
  };

  // Filtered rows
  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay =
          `${r.display_name ?? ''} ${r.module_name ?? ''} ${r.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === 'enabled' && !r.is_active) return false;
      if (statusFilter === 'disabled' && r.is_active) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const allVisibleIds = React.useMemo(() => visible.map((r) => r._id), [visible]);
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = allVisibleIds.some((id) => selected.has(id));

  const toggleAll = React.useCallback(() => {
    setSelected((cur) => {
      if (allSelected) {
        const n = new Set(cur);
        for (const id of allVisibleIds) n.delete(id);
        return n;
      }
      const n = new Set(cur);
      for (const id of allVisibleIds) n.add(id);
      return n;
    });
  }, [allSelected, allVisibleIds]);

  const toggleOne = React.useCallback((id: string) => {
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  // KPI values
  const totalEnabled = rows.filter((r) => r.is_active).length;
  const totalDisabled = rows.length - totalEnabled;

  return (
    <EntityListShell
      title="Modules"
      subtitle="Enable or disable CRM modules and control whether they appear in the menu."
      search={{
        value: search,
        onChange: (v) => handleSearch(v),
        placeholder: 'Search modules…',
      }}
      primaryAction={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Module
        </Button>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0.5">
            {(['all', 'enabled', 'disabled'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setStatusFilter(v)}
                className={
                  'rounded-[calc(var(--st-radius)-2px)] px-2.5 py-1 text-[12.5px] font-medium capitalize transition-colors ' +
                  (statusFilter === v
                    ? 'bg-[var(--st-bg)] text-[var(--st-text)] shadow-[var(--st-shadow-sm)]'
                    : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]')
                }
              >
                {v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {(search !== '' || statusFilter !== 'all') ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          ) : null}
        </div>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-[var(--st-text)]">{selected.size} selected</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkAction('enable')}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Enable
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction('disable')}
              >
                <XCircle className="h-3.5 w-3.5" /> Disable
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total modules"
          value={rows.length}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label="Enabled"
          value={totalEnabled}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Disabled"
          value={totalDisabled}
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <THead>
              <Tr className="hover:bg-transparent">
                <Th className="w-8">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </Th>
                <Th className="text-[var(--st-text-secondary)]">Module</Th>
                <Th className="text-[var(--st-text-secondary)]">Slug</Th>
                <Th className="text-[var(--st-text-secondary)]">Active</Th>
                <Th className="text-[var(--st-text-secondary)]">In Menu</Th>
                <Th className="w-[120px] text-right text-[var(--st-text-secondary)]">
                  Actions
                </Th>
              </Tr>
            </THead>
            <TBody>
              {isLoading && rows.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </Td>
                </Tr>
              ) : visible.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={6}
                    className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    {rows.length === 0
                      ? 'No modules yet.'
                      : 'No modules match the current filters.'}
                  </Td>
                </Tr>
              ) : (
                visible.map((row) => (
                  <Tr key={row._id}>
                    <Td>
                      <Checkbox
                        checked={selected.has(row._id)}
                        onCheckedChange={() => toggleOne(row._id)}
                        aria-label={`Select ${row.display_name ?? row.module_name}`}
                      />
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      <RowDrawer
                        label={row.display_name || row.module_name}
                        subtitle={row.description || row.module_name}
                        title={`Module · ${row.display_name || row.module_name}`}
                        description="Module configuration details."
                        width="sm"
                      >
                        <div className="space-y-3 text-[13px]">
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
                              Slug
                            </div>
                            <code className="font-mono text-[12px]">
                              {row.module_name}
                            </code>
                          </div>
                          {row.description ? (
                            <div>
                              <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
                                Description
                              </div>
                              <div>{row.description}</div>
                            </div>
                          ) : null}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
                                Active
                              </div>
                              <Badge variant={row.is_active ? 'success' : 'ghost'}>
                                {row.is_active ? 'Yes' : 'No'}
                              </Badge>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
                                In Menu
                              </div>
                              <Badge variant={row.in_menu ? 'success' : 'ghost'}>
                                {row.in_menu ? 'Yes' : 'No'}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit module
                          </Button>
                        </div>
                      </RowDrawer>
                    </Td>
                    <Td>
                      <Badge variant="ghost">
                        <code>{row.module_name}</code>
                      </Badge>
                    </Td>
                    <Td>
                      <Switch
                        checked={!!row.is_active}
                        disabled={isBusy}
                        onCheckedChange={() => flip(row._id, 'active')}
                        aria-label="Toggle active"
                      />
                    </Td>
                    <Td>
                      <Switch
                        checked={!!row.in_menu}
                        disabled={isBusy}
                        onCheckedChange={() => flip(row._id, 'menu')}
                        aria-label="Toggle menu"
                      />
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(row);
                            setDialogOpen(true);
                          }}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(row._id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Module' : 'Add Module'}
            </DialogTitle>
            <DialogDescription>
              Modules group related permissions (e.g. Leads, Tasks).
            </DialogDescription>
          </DialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="display_name">
                Display name <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                id="display_name"
                name="display_name"
                required
                defaultValue={editing?.display_name || ''}
              />
            </div>
            <div>
              <Label htmlFor="module_name">Slug</Label>
              <Input
                id="module_name"
                name="module_name"
                defaultValue={editing?.module_name || ''}
                placeholder="leads"
              />
            </div>
            <div>
              <Label>Icon</Label>
              <input type="hidden" name="icon" value={icon} />
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editing?.description || ''}
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3">
                <Label htmlFor="is_active_toggle" className="text-[13px] text-[var(--st-text)]">
                  Active
                </Label>
                <ActiveToggle
                  name="is_active"
                  id="is_active_toggle"
                  defaultChecked={editing?.is_active ?? true}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3">
                <Label htmlFor="in_menu_toggle" className="text-[13px] text-[var(--st-text)]">
                  Show in menu
                </Label>
                <ActiveToggle
                  name="in_menu"
                  id="in_menu_toggle"
                  defaultChecked={editing?.in_menu ?? true}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete module?</AlertDialogTitle>
            <AlertDialogDescription>
              Permissions referencing this module will become uncategorised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk action confirm */}
      <AlertDialog
        open={bulkAction !== null}
        onOpenChange={(o) => !o && setBulkAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'enable'
                ? `Enable ${selected.size} modules?`
                : `Disable ${selected.size} modules?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'enable'
                ? 'Selected modules will be activated.'
                : 'Selected modules will be deactivated and hidden from the menu.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkToggle(bulkAction === 'enable')}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityListShell>
  );
}

/** Switch that writes a hidden `yes`/`no` value into a form. */
function ActiveToggle({
  name,
  id,
  defaultChecked,
}: {
  name: string;
  id: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = React.useState(defaultChecked);
  return (
    <>
      <Switch id={id} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? 'true' : ''} />
    </>
  );
}
