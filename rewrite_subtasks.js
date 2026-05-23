const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/crm/projects/subtasks/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{([\s\S]*?)useZoruToast,\n\} from '@\/components\/zoruui';/, `import {$1Checkbox, useZoruToast,\n} from '@/components/zoruui';`);

content = content.replace(/import \{\n  getWsSubTasks,\n  saveWsSubTask,\n  deleteWsSubTask,\n\} from '@\/app\/actions\/worksuite\/projects\.actions';/, `import {\n  getWsSubTasks,\n  deleteWsSubTask,\n  bulkCompleteWsSubTasks,\n  bulkDeleteWsSubTasks,\n  bulkAssignWsSubTasks,\n} from '@/app/actions/worksuite/projects.actions';`);

content = content.replace(/const \[editTarget, setEditTarget\] = React\.useState<Row \| null>\(null\);\n  const \[deleteTargetId, setDeleteTargetId\] = React\.useState<string \| null>\(null\);/, `const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);\n  const [selection, setSelection] = React.useState<Set<string>>(new Set());\n  const [bulkPending, startBulkTransition] = React.useTransition();\n  const [confirmBulk, setConfirmBulk] = React.useState<'complete' | 'delete' | 'assign' | null>(null);`);

// Replace create / edit logic
content = content.replace(/<Button onClick=\{\(\) => setCreateOpen\(true\)\}>\n\s*<Plus className="h-4 w-4" \/> New subtask\n\s*<\/Button>/g, `<Button asChild>\n            <Link href="/dashboard/crm/projects/subtasks/new">\n              <Plus className="h-4 w-4" /> New subtask\n            </Link>\n          </Button>`);

content = content.replace(/<ZoruDropdownMenuItem onClick=\{\(\) => setEditTarget\(r\)\}>([\s\S]*?)<\/ZoruDropdownMenuItem>/, `<ZoruDropdownMenuItem asChild>\n                                <Link href={\`/dashboard/crm/projects/subtasks/\${r._id}/edit\`}>\n$1</Link>\n                              </ZoruDropdownMenuItem>`);

const helpers = `
  /* ── Selection helpers ───────────────────────────────────────── */
  const handleToggle = React.useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = React.useCallback((checked: boolean) => {
    setSelection(checked ? new Set(filtered.map((r) => r._id)) : new Set());
  }, [filtered]);

  /* ── Bulk complete ───────────────────────────────────────────── */
  const handleBulkComplete = React.useCallback(() => {
    const ids = Array.from(selection);
    startBulkTransition(async () => {
      const res = await bulkCompleteWsSubTasks(ids);
      if (res.updated > 0 || res.failed === 0) {
        toast({ title: \`Completed \${res.updated} subtask\${res.updated === 1 ? '' : 's'}\` });
        setSelection(new Set());
        setConfirmBulk(null);
        refresh();
      } else {
        toast({ title: 'Bulk complete failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selection, refresh, toast]);

  /* ── Bulk delete ─────────────────────────────────────────────── */
  const handleBulkDelete = React.useCallback(() => {
    const ids = Array.from(selection);
    startBulkTransition(async () => {
      const res = await bulkDeleteWsSubTasks(ids);
      if (res.deleted > 0 || res.failed === 0) {
        toast({ title: \`Deleted \${res.deleted} subtask\${res.deleted === 1 ? '' : 's'}\` });
        setSelection(new Set());
        setConfirmBulk(null);
        refresh();
      } else {
        toast({ title: 'Bulk delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selection, refresh, toast]);

  const [bulkAssignState, bulkAssignAction] = useActionState(async (_prev: any, formData: FormData) => {
    const assignedTo = formData.get('assignedTo') as string;
    const assignedToName = formData.get('assignedToName') as string;
    if (!assignedTo) return { error: 'Please select an assignee.' };
    
    const ids = Array.from(selection);
    const res = await bulkAssignWsSubTasks(ids, assignedTo, assignedToName);
    if (res.updated > 0 || res.failed === 0) {
      toast({ title: \`Assigned \${res.updated} subtask\${res.updated === 1 ? '' : 's'}\` });
      setSelection(new Set());
      setConfirmBulk(null);
      refresh();
      return { success: true };
    }
    return { error: res.error };
  }, null);
`;

content = content.replace(/return \(/, helpers + '\n  return (');

const bulkBar = `
        bulkBar={
          selection.size > 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-[13px]">
              <span className="font-medium text-zoru-ink">{selection.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulk('complete')} disabled={bulkPending}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Complete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulk('assign')} disabled={bulkPending}>
                <Edit className="mr-1 h-3.5 w-3.5" /> Assign
              </Button>
              <Button variant="outline" size="sm" className="text-zoru-danger" onClick={() => setConfirmBulk('delete')} disabled={bulkPending}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelection(new Set())}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null
        }`;

content = content.replace(/primaryAction=\{([\s\S]*?)\}/, `primaryAction={$1}\n${bulkBar}`);
content = content.replace(/import \{\n  AlertTriangle,/, `import { X, \nAlertTriangle,`);

// Table header modifications
content = content.replace(/<ZoruTableHead>Title<\/ZoruTableHead>/, `<ZoruTableHead className="w-10">
                      {(() => {
                        const allCk = filtered.length > 0 && filtered.every((r) => selection.has(r._id));
                        const someCk = !allCk && filtered.some((r) => selection.has(r._id));
                        return (
                          <Checkbox
                            checked={allCk || (someCk ? 'indeterminate' : false)}
                            onCheckedChange={(v) => handleToggleAll(!!v)}
                            aria-label="Select all"
                          />
                        );
                      })()}
                    </ZoruTableHead>
                    <ZoruTableHead>Title</ZoruTableHead>`);

// Table row modifications
content = content.replace(/<ZoruTableCell>\n\s*<EntityRowLink/, `<ZoruTableCell>
                          <Checkbox
                            checked={selection.has(r._id)}
                            onCheckedChange={() => handleToggle(r._id)}
                            aria-label={\`Select \${r.title ?? 'subtask'}\`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <EntityRowLink`);

// dependency/ordering UI in table
content = content.replace(/<ZoruTableHead>Parent task<\/ZoruTableHead>/, `<ZoruTableHead>Parent task</ZoruTableHead>\n                    <ZoruTableHead>Dependency</ZoruTableHead>`);
content = content.replace(/<ZoruTableCell className="text-\[12\.5px\]">\n\s*\{r\.taskId \? \([\s\S]*?\}\n\s*<\/ZoruTableCell>/, `$&
                        <ZoruTableCell className="text-[12.5px]">
                          {r.dependencyId ? (
                            <EntityPickerChip entity="subtask" id={String(r.dependencyId)} fallback="View Subtask" />
                          ) : (
                            '—'
                          )}
                        </ZoruTableCell>`);

// Remove dialog
const dialogRegex = /\{\/\* Create \/ Edit dialog \*\/\}[\s\S]*?(?=<ConfirmDialog)/;
content = content.replace(dialogRegex, '');

// Remove SubTaskDialog component definition at bottom
content = content.replace(/\/\* ───── Create \/ Edit dialog ───── \*\/[\s\S]*$/, '');

// Add bulk confirm dialogs
const bulkDialogs = `
      {/* Bulk complete confirm */}
      <ConfirmDialog
        open={confirmBulk === 'complete'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
        title={\`Mark \${selection.size} subtask\${selection.size === 1 ? '' : 's'} complete?\`}
        description="The selected subtasks will be marked as complete."
        confirmLabel="Mark complete"
        onConfirm={handleBulkComplete}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={confirmBulk === 'delete'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
        title={\`Delete \${selection.size} subtask\${selection.size === 1 ? '' : 's'}?\`}
        description="This permanently removes the selected subtasks. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      {/* Bulk assign dialog */}
      <Dialog open={confirmBulk === 'assign'} onOpenChange={(o) => !o && setConfirmBulk(null)}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Assign \${selection.size} subtask\${selection.size === 1 ? '' : 's'}</ZoruDialogTitle>
          </ZoruDialogHeader>
          <form action={bulkAssignAction} className="space-y-4 pt-4">
            <div>
              <Label>Assignee</Label>
              <EntityFormField
                entity="employee"
                name="assignedTo"
                dualWriteName="assignedToName"
                placeholder="Pick an assignee"
              />
            </div>
            {bulkAssignState?.error && <p className="text-sm text-zoru-danger-ink">{bulkAssignState.error}</p>}
            <ZoruDialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmBulk(null)}>Cancel</Button>
              <Button type="submit">Assign</Button>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </Dialog>
    </>
  );
}
`;

content = content.replace(/<\/>\n  \);\n\}/, bulkDialogs);

fs.writeFileSync(file, content);
console.log('done!');
