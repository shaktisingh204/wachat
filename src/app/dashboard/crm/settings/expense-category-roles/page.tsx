'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruSwitch,
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
  useMemo,
  useState,
  useTransition,
  } from 'react';
import { LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2 } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  getExpenseCategoryRoles,
  saveExpenseCategoryRole,
  deleteExpenseCategoryRole,
} from '@/app/actions/worksuite/module-settings.actions';
import { getExpenseCategoriesExt } from '@/app/actions/worksuite/meta.actions';
import { getRoles } from '@/app/actions/worksuite/rbac.actions';
import type { WsExpenseCategoryRole } from '@/lib/worksuite/module-settings-types';
import type { WsExpenseCategoryExt } from '@/lib/worksuite/meta-types';
import type { WsRole } from '@/lib/worksuite/rbac-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

type Row = WsExpenseCategoryRole & { _id: string };

export default function ExpenseCategoryRolesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<
    (WsExpenseCategoryExt & { _id: string })[]
  >([]);
  const [roles, setRoles] = useState<(WsRole & { _id: string })[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [canApprove, setCanApprove] = useState(false);
  const [canCreate, setCanCreate] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const [saveState, formAction, isSaving] = useActionState(
    saveExpenseCategoryRole,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [r, c, rl] = await Promise.all([
        getExpenseCategoryRoles(),
        getExpenseCategoriesExt(),
        getRoles(),
      ]);
      setRows(r as unknown as Row[]);
      setCategories(c as unknown as (WsExpenseCategoryExt & { _id: string })[]);
      setRoles(rl as unknown as (WsRole & { _id: string })[]);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refresh();
      setCategoryId('');
      setRoleId('');
      setCanApprove(false);
      setCanCreate(true);
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const categoryById = useMemo(() => {
    const m = new Map<string, WsExpenseCategoryExt & { _id: string }>();
    categories.forEach((c) => m.set(String(c._id), c));
    return m;
  }, [categories]);

  const roleById = useMemo(() => {
    const m = new Map<string, WsRole & { _id: string }>();
    roles.forEach((r) => m.set(String(r._id), r));
    return m;
  }, [roles]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startDeleting(async () => {
      const r = await deleteExpenseCategoryRole(id);
      setDeletingId(null);
      if (r.success) {
        toast({ title: 'Deleted', description: 'Permission removed.' });
        refresh();
      } else {
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Expense Category Roles"
        subtitle="Grant roles permission to create or approve expenses in specific categories."
        icon={ShieldCheck}
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="space-y-4">
          <h3 className="text-[13px] uppercase tracking-wide text-zoru-ink-muted">
            Add Permission
          </h3>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <ZoruLabel htmlFor="expense_category_id" className="text-[13px] text-zoru-ink">
                Category
              </ZoruLabel>
              <ZoruSelect
                name="expense_category_id"
                value={categoryId}
                onValueChange={setCategoryId}
              >
                <ZoruSelectTrigger id="expense_category_id" className="mt-1.5">
                  <ZoruSelectValue placeholder="Select category" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {categories.map((c) => (
                    <ZoruSelectItem key={String(c._id)} value={String(c._id)}>
                      {c.category_name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div>
              <ZoruLabel htmlFor="role_id" className="text-[13px] text-zoru-ink">
                Role
              </ZoruLabel>
              <ZoruSelect name="role_id" value={roleId} onValueChange={setRoleId}>
                <ZoruSelectTrigger id="role_id" className="mt-1.5">
                  <ZoruSelectValue placeholder="Select role" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {roles.map((r) => (
                    <ZoruSelectItem key={String(r._id)} value={String(r._id)}>
                      {r.display_name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-surface px-4">
              <ZoruSwitch
                id="can_create"
                checked={canCreate}
                onCheckedChange={setCanCreate}
              />
              <ZoruLabel htmlFor="can_create" className="text-[13px] text-zoru-ink">
                Can create
              </ZoruLabel>
              <input
                type="hidden"
                name="can_create"
                value={canCreate ? 'yes' : 'no'}
              />
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-surface px-4">
              <ZoruSwitch
                id="can_approve"
                checked={canApprove}
                onCheckedChange={setCanApprove}
              />
              <ZoruLabel htmlFor="can_approve" className="text-[13px] text-zoru-ink">
                Can approve
              </ZoruLabel>
              <input
                type="hidden"
                name="can_approve"
                value={canApprove ? 'yes' : 'no'}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <ZoruButton type="submit" disabled={isSaving || !categoryId || !roleId}>
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Permission
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>

      <ZoruCard className="p-6">
        {isLoading && rows.length === 0 ? (
          <ZoruSkeleton className="h-[200px] w-full" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-zoru-ink-muted">
            No permissions configured yet.
          </div>
        ) : (
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Category</ZoruTableHead>
                <ZoruTableHead>Role</ZoruTableHead>
                <ZoruTableHead>Create</ZoruTableHead>
                <ZoruTableHead>Approve</ZoruTableHead>
                <ZoruTableHead className="w-[80px] text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.map((row) => {
                const cat = categoryById.get(String(row.expense_category_id));
                const rl = roleById.get(String(row.role_id));
                return (
                  <ZoruTableRow key={String(row._id)}>
                    <ZoruTableCell>{cat?.category_name ?? '—'}</ZoruTableCell>
                    <ZoruTableCell>{rl?.display_name ?? '—'}</ZoruTableCell>
                    <ZoruTableCell>{row.can_create ? 'Yes' : 'No'}</ZoruTableCell>
                    <ZoruTableCell>{row.can_approve ? 'Yes' : 'No'}</ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting && deletingId === String(row._id)}
                        onClick={() => handleDelete(String(row._id))}
                      >
                        <Trash2 className="h-4 w-4 text-zoru-ink-muted" />
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </ZoruTable>
        )}
      </ZoruCard>
    </div>
  );
}
