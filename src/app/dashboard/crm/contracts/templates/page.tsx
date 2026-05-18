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
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { useEffect, useState, useTransition, useActionState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  ExternalLink,
} from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';

import {
  getContractTemplates,
  saveContractTemplate,
  deleteContractTemplate,
} from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractTemplate } from '@/lib/worksuite/contracts-ext-types';

type Row = WsContractTemplate & { _id: string };

export default function ContractTemplatesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveContractTemplate,
    { message: '', error: '' } as any,
  );

  const refresh = () => {
    startLoading(async () => {
      const data = await getContractTemplates();
      setRows(data as unknown as Row[]);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteContractTemplate(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Template removed.' });
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Contract Templates"
        subtitle="Reusable contract templates with placeholders."
        icon={FileText}
        actions={
          <ZoruButton
           
           
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Template
          </ZoruButton>
        }
      />

      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Name</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Preview</ZoruTableHead>
                <ZoruTableHead className="w-[160px] text-right text-muted-foreground">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <ZoruTableRow key={i} className="border-border">
                    <ZoruTableCell colSpan={3}>
                      <ZoruSkeleton className="h-8 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={3}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    No templates yet — click Add Template to get started.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow key={row._id} className="border-border">
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {row.name}
                    </ZoruTableCell>
                    <ZoruTableCell className="max-w-[400px] truncate text-[13px] text-muted-foreground">
                      {(row.body || '').slice(0, 120)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/dashboard/crm/contracts/templates/${row._id}`}>
                          <ZoruButton variant="ghost" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </ZoruButton>
                        </Link>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(row);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(row._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-foreground">
              {editing ? 'Edit Template' : 'Add Template'}
            </ZoruDialogTitle>
            <ZoruDialogDescription className="text-muted-foreground">
              Placeholders like {'{{client_name}}'} are supported.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? <input type="hidden" name="_id" value={editing._id} /> : null}
            <div>
              <ZoruLabel htmlFor="name" className="text-foreground">
                Template Name <span className="text-destructive">*</span>
              </ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                required
                defaultValue={editing?.name || ''}
                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="body" className="text-foreground">
                Body <span className="text-destructive">*</span>
              </ZoruLabel>
              <ZoruTextarea
                id="body"
                name="body"
                required
                rows={10}
                defaultValue={editing?.body || ''}
                className="mt-1.5 rounded-lg border-border bg-card text-[13px]"
                placeholder="Contract body with placeholders like {{client_name}}, {{start_date}}…"
              />
            </div>
            <ZoruDialogFooter className="gap-2">
              <ZoruButton type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton
                type="submit"
               
                disabled={isSaving}
               
              >
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
            <ZoruAlertDialogTitle className="text-foreground">Delete Template?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-muted-foreground">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
