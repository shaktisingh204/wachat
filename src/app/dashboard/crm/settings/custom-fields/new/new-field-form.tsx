'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getCustomFieldGroups,
  getCustomFieldById,
  saveCustomField,
} from '@/app/actions/worksuite/meta.actions';
import type {
  WsCustomField,
  WsCustomFieldGroup,
} from '@/lib/worksuite/meta-types';

type GroupRow = WsCustomFieldGroup & { _id: string };
type FieldRow = WsCustomField & { _id: string };

/** Create/edit form for a single custom field, driven by search params. */
export function NewCustomFieldForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const groupParam = sp.get('group') || '';
  const idParam = sp.get('id') || '';

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [existing, setExisting] = useState<FieldRow | null>(null);
  const [loaded, setLoaded] = useState(false);

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
        if (doc) setExisting(doc);
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
      <div className="text-[13px] text-clay-ink-muted">Loading…</div>
    );
  }

  const defaultGroup = existing?.group_id
    ? String(existing.group_id)
    : groupParam;

  return (
    <ClayCard>
      <form action={formAction} className="space-y-4">
        {existing?._id ? (
          <input type="hidden" name="_id" value={existing._id} />
        ) : null}

        <div>
          <Label htmlFor="group_id" className="text-clay-ink">
            Group <span className="text-clay-red">*</span>
          </Label>
          <Select name="group_id" defaultValue={defaultGroup} required>
            <SelectTrigger
              id="group_id"
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            >
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g._id} value={g._id}>
                  {g.name} ({g.belongs_to})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="label" className="text-clay-ink">
              Label <span className="text-clay-red">*</span>
            </Label>
            <Input
              id="label"
              name="label"
              required
              defaultValue={existing?.label || ''}
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div>
            <Label htmlFor="name" className="text-clay-ink">
              Slug (optional)
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={existing?.name || ''}
              placeholder="auto-generated from label"
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="type" className="text-clay-ink">
              Type
            </Label>
            <Select name="type" defaultValue={existing?.type || 'text'}>
              <SelectTrigger
                id="type"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="textarea">Textarea</SelectItem>
                <SelectItem value="select">Select</SelectItem>
                <SelectItem value="radio">Radio</SelectItem>
                <SelectItem value="checkbox">Checkbox</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="url">URL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="position" className="text-clay-ink">
              Position
            </Label>
            <Input
              id="position"
              name="position"
              type="number"
              defaultValue={String(existing?.position ?? 0)}
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="values" className="text-clay-ink">
            Options (comma or newline separated)
          </Label>
          <Textarea
            id="values"
            name="values"
            rows={3}
            defaultValue={(existing?.values || []).join('\n')}
            placeholder="Used for select / radio / checkbox types"
            className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="is_required" className="text-clay-ink">
              Required
            </Label>
            <Select
              name="is_required"
              defaultValue={existing?.is_required ? 'true' : 'false'}
            >
              <SelectTrigger
                id="is_required"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="display_in_table" className="text-clay-ink">
              Show in tables
            </Label>
            <Select
              name="display_in_table"
              defaultValue={existing?.display_in_table ? 'true' : 'false'}
            >
              <SelectTrigger
                id="display_in_table"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <ClayButton
            type="button"
            variant="pill"
            onClick={() =>
              router.push('/dashboard/crm/settings/custom-fields')
            }
          >
            Cancel
          </ClayButton>
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
            Save
          </ClayButton>
        </div>
      </form>
    </ClayCard>
  );
}
