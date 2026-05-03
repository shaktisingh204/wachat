'use client';

import * as React from 'react';
import { KanbanSquare, Save, Trash2 } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  getMyTaskboardSettings,
  saveTaskboardSettings,
  deleteTaskboardSettings,
} from '@/app/actions/worksuite/dashboard.actions';
import type {
  WsUserTaskboardSetting,
  WsTaskboardGroupBy,
  WsTaskboardSortBy,
} from '@/lib/worksuite/dashboard-types';

type Row = WsUserTaskboardSetting & { _id: string };

const GROUPS: WsTaskboardGroupBy[] = ['none', 'assignee', 'priority', 'label'];
const SORTS: WsTaskboardSortBy[] = ['due_date', 'priority', 'created'];

/**
 * Taskboard view preferences — per-project (or global) overrides
 * controlling Kanban column visibility, grouping, sorting, and
 * whether "done" tasks are hidden.
 */
export default function TaskboardPreferencesPage() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    project_id: '',
    hide_done: false,
    group_by: 'none' as WsTaskboardGroupBy,
    sort_by: 'due_date' as WsTaskboardSortBy,
    visible_columns: 'todo, in_progress, review, done',
  });

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = (await getMyTaskboardSettings()) as Row[];
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Failed to load taskboard settings', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    setSaving(true);
    const res = await saveTaskboardSettings(null, form.project_id || null, {
      hide_done: form.hide_done,
      group_by: form.group_by,
      sort_by: form.sort_by,
      visible_columns: form.visible_columns
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (!res.success) {
      toast({
        title: 'Error',
        description: res.error || 'Save failed',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Saved', description: 'Preferences saved.' });
    refresh();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteTaskboardSettings(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Preset removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Delete failed',
        variant: 'destructive',
      });
    }
  };

  const loadRow = (r: Row) => {
    setForm({
      project_id: r.project_id ? String(r.project_id) : '',
      hide_done: !!r.hide_done,
      group_by: (r.group_by || 'none') as WsTaskboardGroupBy,
      sort_by: (r.sort_by || 'due_date') as WsTaskboardSortBy,
      visible_columns: (r.visible_columns || []).join(', '),
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Taskboard Preferences"
        subtitle="Per-project Kanban view preferences — hide done, group, sort, visible columns."
        icon={KanbanSquare}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ClayCard className="lg:col-span-2">
          <div className="pb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              Edit preferences
            </h2>
            <p className="text-[12.5px] text-muted-foreground">
              Leave project id blank for a global default that applies to
              every project board.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="project-id">Project ID (optional)</Label>
              <Input
                id="project-id"
                value={form.project_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, project_id: e.target.value }))
                }
                placeholder="leave blank for global default"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hide-done"
                checked={form.hide_done}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, hide_done: !!v }))
                }
              />
              <Label htmlFor="hide-done">Hide completed tasks</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Group by</Label>
                <Select
                  value={form.group_by}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      group_by: v as WsTaskboardGroupBy,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUPS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Sort by</Label>
                <Select
                  value={form.sort_by}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, sort_by: v as WsTaskboardSortBy }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cols">Visible columns (comma separated)</Label>
              <Textarea
                id="cols"
                rows={3}
                value={form.visible_columns}
                onChange={(e) =>
                  setForm((f) => ({ ...f, visible_columns: e.target.value }))
                }
              />
            </div>
            <div>
              <ClayButton
                variant="obsidian"
                leading={<Save className="h-4 w-4" strokeWidth={1.75} />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save preferences'}
              </ClayButton>
            </div>
          </div>
        </ClayCard>

        <ClayCard>
          <div className="pb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              Saved presets
            </h2>
            <p className="text-[12.5px] text-muted-foreground">
              Click a preset to load it into the editor.
            </p>
          </div>
          {isLoading ? (
            <p className="text-[13px] text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No presets yet. Save one to see it here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li
                  key={r._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
                >
                  <button
                    type="button"
                    onClick={() => loadRow(r)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {r.project_id ? `Project ${String(r.project_id).slice(-6)}` : 'Global default'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <ClayBadge tone="neutral">{r.group_by}</ClayBadge>
                      <ClayBadge tone="neutral">{r.sort_by}</ClayBadge>
                      {r.hide_done ? (
                        <ClayBadge tone="amber">hide done</ClayBadge>
                      ) : null}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingId(r._id)}
                    aria-label="Delete preset"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ClayCard>
      </div>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete preset?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This removes the stored taskboard preferences for that scope.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
