'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { LoaderCircle, Plus, ShieldCheck, Trash2 } from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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

const inputClass =
  'h-10 rounded-lg border-border bg-card text-[13px]';

type Row = WsExpenseCategoryRole & { _id: string };

export default function ExpenseCategoryRolesPage() {
  const { toast } = useToast();
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

      <ClayCard>
        <form action={formAction} className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Add Permission
          </h3>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="expense_category_id" className="text-[13px] text-foreground">
                Category
              </Label>
              <Select
                name="expense_category_id"
                value={categoryId}
                onValueChange={setCategoryId}
              >
                <SelectTrigger
                  id="expense_category_id"
                  className={`mt-1.5 ${inputClass}`}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={String(c._id)} value={String(c._id)}>
                      {c.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="role_id" className="text-[13px] text-foreground">
                Role
              </Label>
              <Select name="role_id" value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="role_id" className={`mt-1.5 ${inputClass}`}>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={String(r._id)} value={String(r._id)}>
                      {r.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4">
              <Switch
                id="can_create"
                checked={canCreate}
                onCheckedChange={setCanCreate}
              />
              <Label htmlFor="can_create" className="text-[13px] text-foreground">
                Can create
              </Label>
              <input
                type="hidden"
                name="can_create"
                value={canCreate ? 'yes' : 'no'}
              />
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4">
              <Switch
                id="can_approve"
                checked={canApprove}
                onCheckedChange={setCanApprove}
              />
              <Label htmlFor="can_approve" className="text-[13px] text-foreground">
                Can approve
              </Label>
              <input
                type="hidden"
                name="can_approve"
                value={canApprove ? 'yes' : 'no'}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isSaving || !categoryId || !roleId}
              leading={
                isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )
              }
            >
              Add Permission
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      <ClayCard>
        {isLoading && rows.length === 0 ? (
          <Skeleton className="h-[200px] w-full" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">
            No permissions configured yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Create</TableHead>
                <TableHead>Approve</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const cat = categoryById.get(String(row.expense_category_id));
                const rl = roleById.get(String(row.role_id));
                return (
                  <TableRow key={String(row._id)}>
                    <TableCell>{cat?.category_name ?? '—'}</TableCell>
                    <TableCell>{rl?.display_name ?? '—'}</TableCell>
                    <TableCell>{row.can_create ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{row.can_approve ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting && deletingId === String(row._id)}
                        onClick={() => handleDelete(String(row._id))}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ClayCard>
    </div>
  );
}
