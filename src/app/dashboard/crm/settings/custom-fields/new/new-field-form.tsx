'use client';

import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Checkbox,
  Card,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState,
  useEffect,
  useState } from 'react';
import { LoaderCircle } from 'lucide-react';

import * as React from 'react';

import {
  getCustomFieldGroups,
  getCustomFieldById,
  saveCustomField,
} from '@/app/actions/worksuite/meta.actions';
import type {
  WsCustomField,
  WsCustomFieldGroup,
} from '@/lib/worksuite/meta-types';
import { ENTITY_KEYS, type EntityKey } from '@/lib/lookup-registry';

/** Friendly labels for the `targetEntity` dropdown — keep aligned with `ENTITY_KEYS`. */
const ENTITY_LABELS: Record<EntityKey, string> = {
  account: 'Chart of Accounts',
  bankAccount: 'Bank Account',
  branch: 'Branch',
  category: 'Product Category',
  city: 'City',
  client: 'Client',
  contact: 'Contact',
  country: 'Country',
  currency: 'Currency',
  deal: 'Deal',
  department: 'Department',
  designation: 'Designation',
  employee: 'Employee',
  enum: 'Named enum option',
  industry: 'Industry',
  invoice: 'Invoice',
  issue: 'Issue',
  item: 'Item / Product',
  jobTitle: 'Job Title',
  language: 'Language',
  lead: 'Lead',
  leadSource: 'Lead Source',
  location: 'Location',
  pipeline: 'Pipeline',
  project: 'Project',
  purchaseOrder: 'Purchase Order',
  quotation: 'Quotation',
  rfq: 'RFQ',
  sla: 'SLA',
  salutation: 'Salutation',
  stage: 'Pipeline Stage',
  state: 'State / Region',
  tag: 'Tag',
  taxRate: 'Tax Rate',
  timezone: 'Timezone',
  user: 'User',
  vendor: 'Vendor',
  warehouse: 'Warehouse',
  brand: 'Brand',
  unit: 'Unit of Measure',
  vendorType: 'Vendor Type',
  subtask: 'Subtask',
  task: 'Task',
  asset: 'Asset',
  ticket: 'Ticket',
  ticketGroup: 'Ticket Group',
  vendorBill: 'Vendor Bill',
};

type GroupRow = WsCustomFieldGroup & { _id: string };
type FieldRow = WsCustomField & { _id: string };

/** Create/edit form for a single custom field, driven by search params. */
export function NewCustomFieldForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const { toast } = useZoruToast();

  const groupParam = sp.get('group') || '';
  const idParam = sp.get('id') || '';

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [existing, setExisting] = useState<FieldRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Track the currently-selected type and entity_ref config in local
  // state so we can conditionally render the `targetEntity` / `multi`
  // controls without round-tripping through the form. The hidden
  // inputs below mirror this state into FormData on submit.
  const [type, setType] = useState<string>('text');
  const [targetEntity, setTargetEntity] = useState<string>('');
  const [multi, setMulti] = useState<boolean>(false);

  const [state, formAction, isPending] = useActionState(saveCustomField, {
    message: '',
    error: '',
  } as any);

  useEffect(() => {
    (async () => {
      const g = (await getCustomFieldGroups()) as GroupRow[];
      setGroups(Array.isArray(g) ? g : []);
      if (idParam) {
        const doc = (await getCustomFieldById(idParam)) as FieldRow | null;
        if (doc) {
          setExisting(doc);
          setType(doc.type || 'text');
          setTargetEntity(doc.targetEntity || '');
          setMulti(Boolean(doc.multi));
        }
      }
      setLoaded(true);
    })();
  }, [idParam]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/settings/custom-fields');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  if (!loaded) {
    return (
      <div className="text-[13px] text-[var(--st-text-secondary)]">Loading…</div>
    );
  }

  const defaultGroup = existing?.group_id
    ? String(existing.group_id)
    : groupParam;

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        {existing?._id ? (
          <input type="hidden" name="_id" value={existing._id} />
        ) : null}

        <div>
          <Label htmlFor="group_id" className="text-[var(--st-text)]">
            Group <span className="text-[var(--st-danger)]">*</span>
          </Label>
          <Select name="group_id" defaultValue={defaultGroup} required>
            <ZoruSelectTrigger
              id="group_id"
              className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
            >
              <ZoruSelectValue placeholder="Select a group" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {groups.map((g) => (
                <ZoruSelectItem key={g._id} value={g._id}>
                  {g.name} ({g.belongs_to})
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="label" className="text-[var(--st-text)]">
              Label <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="label"
              name="label"
              required
              defaultValue={existing?.label || ''}
              className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
            />
          </div>
          <div>
            <Label htmlFor="name" className="text-[var(--st-text)]">
              Slug (optional)
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={existing?.name || ''}
              placeholder="auto-generated from label"
              className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="type" className="text-[var(--st-text)]">
              Type
            </Label>
            {/* TODO §1E: type needs enumName="customFieldType" — pending label/value alignment
                between this form (radio, checkbox) and the CRM_ENUMS set (boolean, multiselect, etc.) */}
            <Select name="type" value={type} onValueChange={setType}>
              <ZoruSelectTrigger
                id="type"
                className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              >
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="text">Text</ZoruSelectItem>
                <ZoruSelectItem value="textarea">Long text</ZoruSelectItem>
                <ZoruSelectItem value="select">Select (single)</ZoruSelectItem>
                <ZoruSelectItem value="radio">Radio</ZoruSelectItem>
                <ZoruSelectItem value="checkbox">Checkbox</ZoruSelectItem>
                <ZoruSelectItem value="number">Number</ZoruSelectItem>
                <ZoruSelectItem value="date">Date</ZoruSelectItem>
                <ZoruSelectItem value="email">Email</ZoruSelectItem>
                <ZoruSelectItem value="url">URL</ZoruSelectItem>
                <ZoruSelectItem value="entity_ref">Linked record</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="position" className="text-[var(--st-text)]">
              Position
            </Label>
            <Input
              id="position"
              name="position"
              type="number"
              defaultValue={String(existing?.position ?? 0)}
              className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="values" className="text-[var(--st-text)]">
            Options (comma or newline separated)
          </Label>
          <Textarea
            id="values"
            name="values"
            rows={3}
            defaultValue={(existing?.values || []).join('\n')}
            placeholder="Used for select / radio / checkbox types"
            className="rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
          />
        </div>

        {type === 'entity_ref' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="targetEntity" className="text-[var(--st-text)]">
                Linked entity <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Select
                name="targetEntity"
                value={targetEntity}
                onValueChange={setTargetEntity}
                required
              >
                <ZoruSelectTrigger
                  id="targetEntity"
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                >
                  <ZoruSelectValue placeholder="Pick an entity to link" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {ENTITY_KEYS.map((k) => (
                    <ZoruSelectItem key={k} value={k}>
                      {ENTITY_LABELS[k]}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                Renders as a searchable picker for the chosen entity.
              </p>
            </div>
            <div>
              <Label htmlFor="multi" className="text-[var(--st-text)]">
                Multiple values
              </Label>
              <Select
                name="multi"
                value={multi ? 'true' : 'false'}
                onValueChange={(v) => setMulti(v === 'true')}
              >
                <ZoruSelectTrigger
                  id="multi"
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                >
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="false">Single</ZoruSelectItem>
                  <ZoruSelectItem value="true">Multiple</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="is_required" className="text-[var(--st-text)]">
              Required
            </Label>
            <Select
              name="is_required"
              defaultValue={existing?.is_required ? 'true' : 'false'}
            >
              <ZoruSelectTrigger
                id="is_required"
                className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              >
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="false">No</ZoruSelectItem>
                <ZoruSelectItem value="true">Yes</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="display_in_table" className="text-[var(--st-text)]">
              Show in tables
            </Label>
            <Select
              name="display_in_table"
              defaultValue={existing?.display_in_table ? 'true' : 'false'}
            >
              <ZoruSelectTrigger
                id="display_in_table"
                className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
              >
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="false">No</ZoruSelectItem>
                <ZoruSelectItem value="true">Yes</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="pill"
            onClick={() =>
              router.push('/dashboard/crm/settings/custom-fields')
            }
          >
            Cancel
          </Button>
          <Button
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
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
