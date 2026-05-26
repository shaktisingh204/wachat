'use client';

import { Button, Card, Checkbox, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { saveRole } from '@/app/actions/worksuite/rbac.actions';

/**
 * Create a new role. On success we navigate to the detail page so
 * the admin can immediately assign members and toggle permissions.
 */
export default function NewRolePage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction, isPending] = useActionState(saveRole, {
    message: '',
    error: '',
  } as any);

  useEffect(() => {
    if (state?.message && state?.id) {
      toast({ title: 'Role created', description: state.message });
      router.push(`/dashboard/crm/settings/roles/${state.id}`);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  return (
    <EntityDetailShell
      eyebrow="ROLE"
      title="New Role"
      back={{ href: '/dashboard/crm/settings/roles', label: 'Roles' }}
    >
      <Card className="p-0">
        <form action={formAction} className="w-full space-y-4 p-6">
          <div>
            <Label htmlFor="display_name">
              Display name <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="display_name"
              name="display_name"
              required
              placeholder="e.g. Sales Manager"
            />
          </div>

          <div>
            <Label htmlFor="name">Slug</Label>
            <Input
              id="name"
              name="name"
              placeholder="auto-generated from display name"
            />
            <p className="mt-1 text-[12px] text-zoru-ink-muted">
              Lowercase identifier used in permission checks.
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="is_admin" name="is_admin" value="true" />
            <Label htmlFor="is_admin" className="text-[13px] text-zoru-ink">
              Admin role — grants all permissions automatically
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/crm/settings/roles">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Create Role
            </Button>
          </div>
        </form>
      </Card>
    </EntityDetailShell>
  );
}
