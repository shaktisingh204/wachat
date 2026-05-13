'use client';
import { ZoruAlertDialog, ZoruAlertDialogAction, ZoruAlertDialogCancel, ZoruAlertDialogContent, ZoruAlertDialogDescription, ZoruAlertDialogFooter, ZoruAlertDialogHeader, ZoruAlertDialogTitle, ZoruBadge, ZoruButton, ZoruCard, ZoruDialog, ZoruDialogContent, ZoruDialogDescription, ZoruDialogFooter, ZoruDialogHeader, ZoruDialogTitle, ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruSkeleton, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useActionState,
} from 'react';
import Link from 'next/link';
import {
  FileSignature,
  Plus,
  Pencil,
  Trash2,
  Eye,
  LoaderCircle,
} from 'lucide-react';
import {
  getContracts,
  saveContract,
  deleteContract,
} from '@/app/actions/crm-services.actions';
import type { HrContract } from '@/lib/hr-types';

import { CrmPageHeader } from '../_components/crm-page-header';
import { EntityFormField } from '@/components/crm/entity-form-field';

type Contract = HrContract & { _id: string };

const STATUS_TONES: Record<string, 'neutral' | 'amber' | 'green' | 'red'> = {
  draft: 'neutral',
  sent: 'amber',
  signed: 'green',
  expired: 'red',
  terminated: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ContractsPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Contract[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [saveState, saveFormAction, isSaving] = useActionState(saveContract, {
    message: '',
    error: '',
  } as any);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const list = await getContracts();
      setRows((list as Contract[]) || []);
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
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteContract(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Contract removed.' });
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
        title="Contracts"
        subtitle="Prepare, send, and e-sign client contracts."
        icon={FileSignature}
        actions={
          <ZoruButton
           
           
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Contract
          </ZoruButton>
        }
      />

      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="text-muted-foreground">Title</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Client</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Value</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Start</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">End</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                <ZoruTableHead className="w-[200px] text-right text-muted-foreground">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <ZoruTableRow key={i} className="border-border">
                    <ZoruTableCell colSpan={7}>
                      <ZoruSkeleton className="h-8 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    No contracts yet — click Add Contract to get started.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow key={row._id} className="border-border">
                    <ZoruTableCell className="text-[13px] font-medium text-foreground">
                      <Link
                        href={`/dashboard/crm/contracts/${row._id}`}
                        className="hover:underline"
                      >
                        {row.title}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {row.clientName || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {row.value != null
                        ? new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: row.currency || 'INR',
                          }).format(row.value)
                        : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {fmtDate(row.startDate)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {fmtDate(row.endDate)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={(STATUS_TONES[row.status] || 'neutral') as any}>
                        {row.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/dashboard/crm/contracts/${row._id}`}>
                          <ZoruButton
                            variant="outline"
                            size="sm"
                           
                          >
                            {row.status === 'signed' ? 'View' : 'Sign'}
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
              {editing ? 'Edit Contract' : 'Add Contract'}
            </ZoruDialogTitle>
            <ZoruDialogDescription className="text-muted-foreground">
              Fill in the details below.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <ZoruLabel className="text-foreground">
                  Title <span className="text-destructive">*</span>
                </ZoruLabel>
                <ZoruInput
                  name="title"
                  required
                  defaultValue={editing?.title || ''}
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-foreground">Client</ZoruLabel>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="client"
                    name="clientId"
                    dualWriteName="clientName"
                    initialId={(editing as any)?.clientId ?? null}
                    initialLabel={editing?.clientName || ''}
                    placeholder="Select client…"
                  />
                </div>
              </div>
              <div>
                <ZoruLabel className="text-foreground">
                  Status <span className="text-destructive">*</span>
                </ZoruLabel>
                <ZoruSelect
                  name="status"
                  defaultValue={editing?.status || 'draft'}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                    <ZoruSelectItem value="sent">Sent</ZoruSelectItem>
                    <ZoruSelectItem value="signed">Signed</ZoruSelectItem>
                    <ZoruSelectItem value="expired">Expired</ZoruSelectItem>
                    <ZoruSelectItem value="terminated">Terminated</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel className="text-foreground">Value</ZoruLabel>
                <ZoruInput
                  type="number"
                  name="value"
                  defaultValue={editing?.value ?? ''}
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-foreground">Currency</ZoruLabel>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="currency"
                    name="currency"
                    initialId={editing?.currency || 'INR'}
                    placeholder="Select currency…"
                  />
                </div>
              </div>
              <div>
                <ZoruLabel className="text-foreground">Start Date</ZoruLabel>
                <ZoruInput
                  type="date"
                  name="startDate"
                  defaultValue={
                    editing?.startDate
                      ? new Date(editing.startDate as any)
                          .toISOString()
                          .slice(0, 10)
                      : ''
                  }
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-foreground">End Date</ZoruLabel>
                <ZoruInput
                  type="date"
                  name="endDate"
                  defaultValue={
                    editing?.endDate
                      ? new Date(editing.endDate as any)
                          .toISOString()
                          .slice(0, 10)
                      : ''
                  }
                  className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
              <div className="md:col-span-2">
                <ZoruLabel className="text-foreground">Body</ZoruLabel>
                <ZoruTextarea
                  name="body"
                  rows={6}
                  defaultValue={editing?.body || ''}
                  className="mt-1.5 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <ZoruDialogFooter className="gap-2">
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
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
            <ZoruAlertDialogTitle className="text-foreground">
              Delete contract?
            </ZoruAlertDialogTitle>
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
