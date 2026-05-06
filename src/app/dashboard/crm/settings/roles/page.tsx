'use client';

import * as React from 'react';
import Link from 'next/link';
import { Shield, Plus, Pencil, Trash2, Users, LoaderCircle } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
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
  const { toast } = useZoruToast();
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
          <ZoruButton asChild>
            <Link href="/dashboard/crm/settings/roles/new">
              <Plus className="h-4 w-4" />
              Add Role
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-0">
        <div className="overflow-x-auto rounded-lg">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Role</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Slug</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Members</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                <ZoruTableHead className="w-[180px] text-right text-zoru-ink-muted">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No roles yet — click Add Role to get started.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow key={row._id}>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      <Link
                        href={`/dashboard/crm/settings/roles/${row._id}`}
                        className="hover:underline"
                      >
                        {row.display_name || row.name}
                      </Link>
                      {row.description ? (
                        <div className="text-[12px] text-zoru-ink-muted">
                          {row.description}
                        </div>
                      ) : null}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                      <code>{row.name}</code>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant="ghost">
                        <Users className="h-3 w-3" />
                        {row.memberCount}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex gap-1">
                        {row.is_admin ? (
                          <ZoruBadge variant="default">Admin</ZoruBadge>
                        ) : null}
                        {row.is_system ? (
                          <ZoruBadge variant="ghost">System</ZoruBadge>
                        ) : null}
                        {!row.is_admin && !row.is_system ? (
                          <ZoruBadge variant="success">Custom</ZoruBadge>
                        ) : null}
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ZoruButton variant="ghost" size="sm" asChild aria-label="Edit">
                          <Link href={`/dashboard/crm/settings/roles/${row._id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          disabled={!!row.is_system}
                          onClick={() => setDeletingId(row._id)}
                          aria-label="Delete"
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

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete role?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              All member assignments and permission grants for this role will
              be removed. This cannot be undone.
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
