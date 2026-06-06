'use client';

import { Button, Card, Checkbox, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <RoleForm /> — create + edit form for a tenant-scoped role.
 *
 * Mirrors the email-templates pattern: a single client component bound
 * to `saveRole` via `useActionState`, reused by both `roles/new` and
 * `roles/[id]/edit`. The full permission matrix + member assignment
 * stays on `roles/[id]` (the detail page) — this form only edits the
 * role's own metadata.
 */

import { saveRole } from '@/app/actions/worksuite/rbac.actions';
import type { WsRole } from '@/lib/worksuite/rbac-types';

const BASE = '/dashboard/crm/settings/roles';

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

export function RoleForm({
  initialData,
}: {
  initialData?: (WsRole & { _id: string }) | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!initialData?._id;

  const [state, formAction, isPending] = useActionState(saveRole, initialState);

  useEffect(() => {
    if (state?.message) {
      toast({
        title: isEditing ? 'Role updated' : 'Role created',
        description: state.message,
      });
      const targetId = state.id ?? initialData?._id;
      if (targetId) {
        router.push(`${BASE}/${targetId}`);
      } else {
        router.push(BASE);
      }
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router, isEditing, initialData]);

  return (
    <Card className="p-0">
      <form action={formAction} className="w-full space-y-4 p-6">
        {isEditing ? (
          <input type="hidden" name="_id" value={initialData!._id} />
        ) : null}

        <div>
          <Label htmlFor="display_name">
            Display name <span className="text-[var(--st-danger)]">*</span>
          </Label>
          <Input
            id="display_name"
            name="display_name"
            required
            placeholder="e.g. Sales Manager"
            defaultValue={initialData?.display_name ?? ''}
          />
        </div>

        <div>
          <Label htmlFor="name">Slug</Label>
          <Input
            id="name"
            name="name"
            placeholder="auto-generated from display name"
            defaultValue={initialData?.name ?? ''}
            readOnly={isEditing}
            className={isEditing ? 'cursor-not-allowed opacity-70' : undefined}
          />
          <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">
            Lowercase identifier used in permission checks.
            {isEditing ? ' Slug is locked once a role is created.' : null}
          </p>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={initialData?.description ?? ''}
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="is_admin"
            name="is_admin"
            value="true"
            defaultChecked={initialData?.is_admin ?? false}
            disabled={initialData?.is_system ?? false}
          />
          <div className="space-y-1">
            <Label htmlFor="is_admin" className="text-[13px] text-[var(--st-text)]">
              Admin role — grants all permissions automatically
            </Label>
            {initialData?.is_system ? (
              <p className="text-[12px] text-[var(--st-text-secondary)]">
                System roles cannot have their admin flag changed.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" asChild>
            <Link href={isEditing ? `${BASE}/${initialData!._id}` : BASE}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
