'use client';

import * as React from 'react';
import Link from 'next/link';
import { Shield, Plus, Pencil, Trash2, Users, LoaderCircle } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
  getRolesWithCounts,
  deleteRole,
} from '@/app/actions/worksuite/rbac.actions';
import type { WsRole } from '@/lib/worksuite/rbac-types';

type Row = WsRole & { _id: string; memberCount: number };

/**
 * Tenant-admin facing list of CRM roles. Each row shows the member
 * count (via aggregation over `crm_role_users`) and deep-links to the
 * detail page where permissions and members are edited.
 */
export default function RolesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getRolesWithCounts()) as Row[];
        setRows(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load roles:', e);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteRole(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Role removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Roles"
        subtitle="Define custom roles for your CRM and assign the permissions they grant."
        icon={Shield}
        actions={
          <Link href="/dashboard/crm/settings/roles/new">
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              Add Role
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Role</TableHead>
                <TableHead className="text-clay-ink-muted">Slug</TableHead>
                <TableHead className="text-clay-ink-muted">Members</TableHead>
                <TableHead className="text-clay-ink-muted">Type</TableHead>
                <TableHead className="w-[180px] text-right text-clay-ink-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-clay-ink-muted"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-clay-ink-muted"
                  >
                    No roles yet — click Add Role to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="border-clay-border">
                    <TableCell className="text-[13px] font-medium text-clay-ink">
                      <Link
                        href={`/dashboard/crm/settings/roles/${row._id}`}
                        className="hover:underline"
                      >
                        {row.display_name || row.name}
                      </Link>
                      {row.description ? (
                        <div className="text-[12px] text-clay-ink-muted">
                          {row.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-[12px] text-clay-ink-muted">
                      <code>{row.name}</code>
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone="neutral">
                        <Users className="mr-1 inline h-3 w-3" />
                        {row.memberCount}
                      </ClayBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {row.is_admin ? (
                          <ClayBadge tone="rose-soft">Admin</ClayBadge>
                        ) : null}
                        {row.is_system ? (
                          <ClayBadge tone="neutral">System</ClayBadge>
                        ) : null}
                        {!row.is_admin && !row.is_system ? (
                          <ClayBadge tone="green">Custom</ClayBadge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/dashboard/crm/settings/roles/${row._id}`}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!row.is_system}
                          onClick={() => setDeletingId(row._id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-clay-ink">
              Delete role?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              All member assignments and permission grants for this role will
              be removed. This cannot be undone.
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
