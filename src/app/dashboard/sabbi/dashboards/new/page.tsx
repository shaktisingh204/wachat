'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
  Checkbox,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Save,
  LoaderCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { saveDashboard } from '@/app/actions/crm-dashboards.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

const initialState = { message: '', error: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Save Dashboard
    </Button>
  );
}

export default function NewDashboardPage() {
  const [state, formAction] = useActionState(saveDashboard, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      router.push('/dashboard/sabbi/dashboards');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, router, toast]);

  return (
    <EntityDetailShell
      eyebrow="DASHBOARD"
      title="New Dashboard"
      back={{ href: '/dashboard/sabbi/dashboards', label: 'Dashboards' }}
    >

      <Card className="p-6">
        <form action={formAction} className="space-y-6">
          {/* Name + Description */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[var(--st-text)]">
              Dashboard Name <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Sales Overview, Weekly KPIs"
              required
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-[var(--st-text)]">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What does this dashboard track?"
              maxLength={500}
            />
          </div>

          {/* Layout + Visibility */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="layout" className="text-[var(--st-text)]">
                Layout
              </Label>
              <Select name="layout" defaultValue="2col">
                <ZoruSelectTrigger id="layout">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="1col">1 Column</ZoruSelectItem>
                  <ZoruSelectItem value="2col">2 Columns</ZoruSelectItem>
                  <ZoruSelectItem value="3col">3 Columns</ZoruSelectItem>
                  <ZoruSelectItem value="masonry">Masonry</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sharedWith" className="text-[var(--st-text)]">
                Visibility
              </Label>
              <Select name="sharedWith" defaultValue="private">
                <ZoruSelectTrigger id="sharedWith">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="private">Private</ZoruSelectItem>
                  <ZoruSelectItem value="team">Team</ZoruSelectItem>
                  <ZoruSelectItem value="workspace">Workspace</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label className="text-[var(--st-text)]">Owner</Label>
            <EntityFormField
              entity="user"
              name="ownerId"
              placeholder="Select owner…"
            />
          </div>

          {/* Auto-refresh */}
          <div className="space-y-1.5">
            <Label htmlFor="refreshInterval" className="text-[var(--st-text)]">
              Auto-refresh every (Optional)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="refreshInterval"
                name="refreshInterval"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 60"
                className="w-40"
              />
              <span className="text-sm text-[var(--st-text-secondary)]">seconds</span>
            </div>
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
              Leave blank or set to 0 for manual refresh only.
            </p>
          </div>

          {/* Set as default */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="isDefault"
              name="isDefault"
            />
            <Label htmlFor="isDefault" className="cursor-pointer text-[var(--st-text)]">
              Set as default dashboard
            </Label>
          </div>

          <div className="flex justify-end pt-2">
            <SubmitButton />
          </div>
        </form>
      </Card>
    </EntityDetailShell>
  );
}
