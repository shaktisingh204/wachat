'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCard,
  ZoruColorPicker,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getTicketTypes,
  saveTicketType,
  deleteTicketType,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketType } from '@/lib/worksuite/tickets-ext-types';

type Row = WsTicketType & { _id: string };

export default function TicketTypesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [color, setColor] = useState('#6B7280');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveTicketType,
    { message: '', error: '' } as any,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const data = await getTicketTypes();
      setRows(data as unknown as Row[]);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
  }, [saveState, refresh, toast]);

  const openAdd = () => {
    setEditing(null);
    setColor('#6B7280');
    setDialogOpen(true);
  };
  const openEdit = (row: Row) => {
    setEditing(row);
    setColor(row.color || '#6B7280');
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteTicketType(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Type removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  return (
    <EntityListShell
      title="Ticket Types"
      subtitle="Ticket categorisation types with colour coding."
      primaryAction={
        <ZoruButton onClick={openAdd}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Type
        </ZoruButton>
      }
    >

      <ZoruCard className="p-6">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Colour</ZoruTableHead>
                <ZoruTableHead className="w-[120px] text-right text-zoru-ink-muted">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <ZoruTableRow key={i} className="border-zoru-line">
                    <ZoruTableCell colSpan={3}>
                      <ZoruSkeleton className="h-8 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={3}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No types yet — click Add Type to get started.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow key={row._id} className="border-zoru-line">
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {row.type}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-sm border border-zoru-line"
                          style={{ backgroundColor: row.color || '#6B7280' }}
                          aria-label={`Colour ${row.color || ''}`}
                        />
                        <code className="text-[12px] text-zoru-ink-muted">
                          {row.color || '—'}
                        </code>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ZoruButton variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(row._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                        </ZoruButton>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">
              {editing ? 'Edit Type' : 'Add Type'}
            </ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Assign a colour hex code to visually distinguish the type.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? <input type="hidden" name="_id" value={editing._id} /> : null}
            <div>
              <ZoruLabel htmlFor="type" className="text-zoru-ink">
                Type <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="type"
                name="type"
                required
                defaultValue={editing?.type || ''}
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel className="text-zoru-ink">Colour</ZoruLabel>
              <input type="hidden" name="color" value={color} />
              <div className="mt-1.5">
                <ZoruColorPicker value={color} onChange={setColor} />
              </div>
            </div>
            <ZoruDialogFooter className="gap-2">
              <ZoruButton type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : null}
                Save
              </ZoruButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-zoru-ink">Delete Type?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-zoru-ink-muted">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}
