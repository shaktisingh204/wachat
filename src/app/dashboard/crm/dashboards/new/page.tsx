'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ArrowLeft,
  Save,
  LoaderCircle,
  LayoutDashboard,
  } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { saveDashboard } from '@/app/actions/crm-dashboards.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

const initialState = { message: '', error: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Save Dashboard
    </ZoruButton>
  );
}

export default function NewDashboardPage() {
  const [state, formAction] = useActionState(saveDashboard, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      router.push('/dashboard/crm/dashboards');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, router, toast]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Dashboard"
        subtitle="Create a custom dashboard and add widgets after saving."
        icon={LayoutDashboard}
        actions={
          <Link href="/dashboard/crm/dashboards">
            <ZoruButton variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboards
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="space-y-6">
          {/* Name + Description */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="name" className="text-zoru-ink">
              Dashboard Name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="name"
              name="name"
              placeholder="e.g. Sales Overview, Weekly KPIs"
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="description" className="text-zoru-ink">
              Description (Optional)
            </ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              placeholder="What does this dashboard track?"
              maxLength={500}
            />
          </div>

          {/* Layout + Visibility */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="layout" className="text-zoru-ink">
                Layout
              </ZoruLabel>
              <ZoruSelect name="layout" defaultValue="2col">
                <ZoruSelectTrigger id="layout">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="1col">1 Column</ZoruSelectItem>
                  <ZoruSelectItem value="2col">2 Columns</ZoruSelectItem>
                  <ZoruSelectItem value="3col">3 Columns</ZoruSelectItem>
                  <ZoruSelectItem value="masonry">Masonry</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="space-y-1.5">
              <ZoruLabel htmlFor="sharedWith" className="text-zoru-ink">
                Visibility
              </ZoruLabel>
              <ZoruSelect name="sharedWith" defaultValue="private">
                <ZoruSelectTrigger id="sharedWith">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="private">Private</ZoruSelectItem>
                  <ZoruSelectItem value="team">Team</ZoruSelectItem>
                  <ZoruSelectItem value="workspace">Workspace</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <ZoruLabel className="text-zoru-ink">Owner</ZoruLabel>
            <EntityFormField
              entity="user"
              name="ownerId"
              placeholder="Select owner…"
            />
          </div>

          {/* Auto-refresh */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="refreshInterval" className="text-zoru-ink">
              Auto-refresh every (Optional)
            </ZoruLabel>
            <div className="flex items-center gap-2">
              <ZoruInput
                id="refreshInterval"
                name="refreshInterval"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 60"
                className="w-40"
              />
              <span className="text-sm text-zoru-ink-muted">seconds</span>
            </div>
            <p className="text-[11.5px] text-zoru-ink-muted">
              Leave blank or set to 0 for manual refresh only.
            </p>
          </div>

          {/* Set as default */}
          <div className="flex items-center gap-2">
            <input
              id="isDefault"
              name="isDefault"
              type="checkbox"
              className="h-4 w-4 rounded border-zoru-border accent-zoru-ink"
            />
            <ZoruLabel htmlFor="isDefault" className="cursor-pointer text-zoru-ink">
              Set as default dashboard
            </ZoruLabel>
          </div>

          <div className="flex justify-end pt-2">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
