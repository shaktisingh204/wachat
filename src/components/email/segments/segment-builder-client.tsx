'use client';

/**
 * Segment builder — visual AND/OR rule-group composer.
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
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Textarea,
  zoruToast,
} from '@/components/sabcrm/20ui/compat';
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
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [listId, setListId] = useState('');
  const [tree, setTree] = useState<EmailFilterGroup>(newGroup('AND'));

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      zoruToast.error('Name is required');
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
        zoruToast.error(res.error);
        return;
      }
      zoruToast.success('Segment created');
      router.push('/dashboard/email/audience/segments');
    });
  }, [description, listId, name, router, tree]);

  return (
    <div className="zoruui space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>New segment</ZoruPageTitle>
          <ZoruPageDescription>
            Define a dynamic audience using AND/OR rule groups on contact attributes.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="segment-name">Name</Label>
            <Input id="segment-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="segment-list">Scope to list (optional)</Label>
            <Input
              id="segment-list"
              placeholder="list_xxx"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="segment-desc">Description</Label>
          <Textarea
            id="segment-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Filter rules</h2>
            <p className="text-sm text-[color:var(--zoru-muted-foreground)]">
              Nest groups to combine AND with OR.
            </p>
          </div>
          <Badge variant="outline">
            <Sigma className="mr-1 h-3 w-3" />
            Live count refreshes on save
          </Badge>
        </div>
        <Separator />
        <GroupNode
          group={tree}
          onChange={setTree}
          depth={0}
        />
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={pending || !name.trim()}>
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
      className={`rounded-lg border p-4 ${
        depth > 0 ? 'border-dashed bg-[color:var(--zoru-muted)]/30' : ''
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Select value={group.combinator} onValueChange={(v) => setCombinator(v as FilterCombinator)}>
          <ZoruSelectTrigger className="w-24">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="AND">AND</ZoruSelectItem>
            <ZoruSelectItem value="OR">OR</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>
        <span className="text-xs text-[color:var(--zoru-muted-foreground)]">
          {group.combinator === 'AND' ? 'All of the following must match' : 'Any of the following can match'}
        </span>
      </div>

      <div className="space-y-2">
        {group.filters.map((child, idx) =>
          'combinator' in child ? (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1">
                <GroupNode group={child} onChange={(g) => setChild(idx, g)} depth={depth + 1} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeChild(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
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
        <Button size="sm" variant="outline" onClick={addLeaf}>
          <Plus className="mr-1 h-3 w-3" />
          Add rule
        </Button>
        <Button size="sm" variant="ghost" onClick={addGroup}>
          <Plus className="mr-1 h-3 w-3" />
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
    <div className="flex items-center gap-2 rounded border bg-[color:var(--zoru-card)] p-2">
      <Select value={leaf.field} onValueChange={(v) => onChange({ ...leaf, field: v })}>
        <ZoruSelectTrigger className="w-56">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {FIELD_SUGGESTIONS.map((f) => (
            <ZoruSelectItem key={f} value={f}>
              {f}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </Select>
      <Select value={leaf.op} onValueChange={(v) => onChange({ ...leaf, op: v as EmailFilterOp })}>
        <ZoruSelectTrigger className="w-40">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {OPS.map((o) => (
            <ZoruSelectItem key={o.value} value={o.value}>
              {o.label}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </Select>
      {showValue && (
        <Input
          className="flex-1"
          placeholder="value"
          value={typeof leaf.value === 'string' ? leaf.value : JSON.stringify(leaf.value ?? '')}
          onChange={(e) => onChange({ ...leaf, value: e.target.value })}
        />
      )}
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
