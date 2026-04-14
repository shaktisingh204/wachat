'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, LoaderCircle, ArrowLeft } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { saveRole } from '@/app/actions/worksuite/rbac.actions';

/**
 * Create a new role. On success we navigate to the detail page so
 * the admin can immediately assign members and toggle permissions.
 */
export default function NewRolePage() {
  const router = useRouter();
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Role"
        subtitle="Create a role that can be assigned to users, then configure its permissions."
        icon={Shield}
        actions={
          <Link href="/dashboard/crm/settings/roles">
            <ClayButton
              variant="pill"
              leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back to roles
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <form action={formAction} className="max-w-xl space-y-4 p-6">
          <div>
            <Label htmlFor="display_name" className="text-clay-ink">
              Display name <span className="text-clay-red">*</span>
            </Label>
            <Input
              id="display_name"
              name="display_name"
              required
              placeholder="e.g. Sales Manager"
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>

          <div>
            <Label htmlFor="name" className="text-clay-ink">
              Slug
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="auto-generated from display name"
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
            <p className="mt-1 text-[12px] text-clay-ink-muted">
              Lowercase identifier used in permission checks.
            </p>
          </div>

          <div>
            <Label htmlFor="description" className="text-clay-ink">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="is_admin" name="is_admin" value="true" />
            <Label htmlFor="is_admin" className="text-[13px] text-clay-ink">
              Admin role — grants all permissions automatically
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Link href="/dashboard/crm/settings/roles">
              <ClayButton type="button" variant="pill">
                Cancel
              </ClayButton>
            </Link>
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isPending}
              leading={
                isPending ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null
              }
            >
              Create Role
            </ClayButton>
          </div>
        </form>
      </ClayCard>
    </div>
  );
}
