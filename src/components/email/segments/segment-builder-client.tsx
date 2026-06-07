'use client';

/**
 * Segment builder, a visual AND/OR rule-group composer.
 *
 * Persists via the existing `email-audience` Rust crate
 * (`actionCreateEmailSegment`); this component is the rule-builder UX
 * the spec calls out.
 */

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Sigma } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  IconButton,
  Input,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import type {
  EmailFilterGroup,
  EmailFilterLeaf,
  EmailFilterNode,
  EmailFilterOp,
  FilterCombinator,
} from '@/lib/email/types';
import { actionCreateEmailSegment } from '@/app/actions/email/audience.actions';

const OPS: Array<{ value: EmailFilterOp; label: string }> = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'in', label: 'in' },
  { value: 'nin', label: 'not in' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'does not exist' },
  { value: 'within_days', label: 'within days' },
  { value: 'before', label: 'before' },
  { value: 'after', label: 'after' },
];

const FIELD_SUGGESTIONS = [
  'email',
  'firstName',
  'lastName',
  'tags',
  'status',
  'engagement.openCount',
  'engagement.clickCount',
  'customFields.country',
  'customFields.plan',
  'createdAt',
];

function newLeaf(): EmailFilterLeaf {
  return { field: 'email', op: 'eq', value: '' };
}

function newGroup(combinator: FilterCombinator = 'AND'): EmailFilterGroup {
  return { combinator, filters: [newLeaf()] };
}

export function SegmentBuilderClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [listId, setListId] = useState('');
  const [tree, setTree] = useState<EmailFilterGroup>(newGroup('AND'));

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    startTransition(async () => {
      const res = await actionCreateEmailSegment({
        name,
        description: description || undefined,
        listId: listId || undefined,
        filter: tree,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Segment created');
      router.push('/dashboard/email/audience/segments');
    });
  }, [description, listId, name, router, toast, tree]);

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>New segment</PageTitle>
          <PageDescription>
            Define a dynamic audience using AND/OR rule groups on contact attributes.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Card className="p-6">
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Scope to list (optional)">
              <Input
                placeholder="list_xxx"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
        </CardBody>
      </Card>

      <Card className="p-6">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Filter rules</CardTitle>
            <CardDescription>Nest groups to combine AND with OR.</CardDescription>
          </div>
          <Badge variant="outline">
            <Sigma className="mr-1 h-3 w-3" aria-hidden="true" />
            Live count refreshes on save
          </Badge>
        </CardHeader>
        <Separator className="my-4" />
        <CardBody>
          <GroupNode group={tree} onChange={setTree} depth={0} />
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={pending || !name.trim()}>
          Save segment
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recursive group renderer
// ---------------------------------------------------------------------------

function GroupNode({
  group,
  onChange,
  depth,
}: {
  group: EmailFilterGroup;
  onChange: (g: EmailFilterGroup) => void;
  depth: number;
}) {
  const setCombinator = (c: FilterCombinator) => onChange({ ...group, combinator: c });

  const setChild = (idx: number, node: EmailFilterNode) => {
    const filters = group.filters.slice();
    filters[idx] = node;
    onChange({ ...group, filters });
  };

  const removeChild = (idx: number) => {
    const filters = group.filters.slice();
    filters.splice(idx, 1);
    onChange({ ...group, filters });
  };

  const addLeaf = () => onChange({ ...group, filters: [...group.filters, newLeaf()] });
  const addGroup = () => onChange({ ...group, filters: [...group.filters, newGroup('OR')] });

  return (
    <div
      className={`rounded-[var(--st-radius)] border border-[var(--st-border)] p-4 ${
        depth > 0 ? 'border-dashed bg-[var(--st-bg-muted)]/30' : ''
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Select value={group.combinator} onValueChange={(v) => setCombinator(v as FilterCombinator)}>
          <SelectTrigger className="w-24" aria-label="Combinator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-[var(--st-text-secondary)]">
          {group.combinator === 'AND'
            ? 'All of the following must match'
            : 'Any of the following can match'}
        </span>
      </div>

      <div className="space-y-2">
        {group.filters.map((child, idx) =>
          'combinator' in child ? (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1">
                <GroupNode group={child} onChange={(g) => setChild(idx, g)} depth={depth + 1} />
              </div>
              <IconButton
                label="Remove group"
                icon={Trash2}
                variant="ghost"
                onClick={() => removeChild(idx)}
              />
            </div>
          ) : (
            <LeafRow
              key={idx}
              leaf={child}
              onChange={(leaf) => setChild(idx, leaf)}
              onRemove={() => removeChild(idx)}
            />
          ),
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" iconLeft={Plus} onClick={addLeaf}>
          Add rule
        </Button>
        <Button size="sm" variant="ghost" iconLeft={Plus} onClick={addGroup}>
          Add group
        </Button>
      </div>
    </div>
  );
}

function LeafRow({
  leaf,
  onChange,
  onRemove,
}: {
  leaf: EmailFilterLeaf;
  onChange: (l: EmailFilterLeaf) => void;
  onRemove: () => void;
}) {
  const noValueOps: EmailFilterOp[] = ['exists', 'not_exists'];
  const showValue = !noValueOps.includes(leaf.op);
  return (
    <div className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2">
      <Select value={leaf.field} onValueChange={(v) => onChange({ ...leaf, field: v })}>
        <SelectTrigger className="w-56" aria-label="Field">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_SUGGESTIONS.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={leaf.op} onValueChange={(v) => onChange({ ...leaf, op: v as EmailFilterOp })}>
        <SelectTrigger className="w-40" aria-label="Operator">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showValue && (
        <Input
          className="flex-1"
          placeholder="value"
          value={typeof leaf.value === 'string' ? leaf.value : JSON.stringify(leaf.value ?? '')}
          onChange={(e) => onChange({ ...leaf, value: e.target.value })}
        />
      )}
      <IconButton
        label="Remove rule"
        icon={Trash2}
        variant="ghost"
        onClick={onRemove}
      />
    </div>
  );
}
