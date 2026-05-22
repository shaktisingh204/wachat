'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import type {
  EmailFilterGroup,
  EmailFilterLeaf,
  EmailFilterNode,
  EmailFilterOp,
  EmailFilterTree,
  FilterCombinator,
} from '@/lib/email/types';

const FIELD_OPTIONS = [
  { value: 'email',                  label: 'Email' },
  { value: 'firstName',              label: 'First name' },
  { value: 'lastName',               label: 'Last name' },
  { value: 'tags',                   label: 'Tag' },
  { value: 'status',                 label: 'Status' },
  { value: 'engagement.openCount',   label: 'Open count' },
  { value: 'engagement.clickCount',  label: 'Click count' },
  { value: 'engagement.lastOpenedAt',label: 'Last opened at' },
  { value: 'createdAt',              label: 'Joined at' },
];

const OP_OPTIONS: Array<{ value: EmailFilterOp; label: string }> = [
  { value: 'eq',           label: 'is' },
  { value: 'ne',           label: 'is not' },
  { value: 'contains',     label: 'contains' },
  { value: 'starts_with',  label: 'starts with' },
  { value: 'ends_with',    label: 'ends with' },
  { value: 'gt',           label: '>' },
  { value: 'gte',          label: '>=' },
  { value: 'lt',           label: '<' },
  { value: 'lte',          label: '<=' },
  { value: 'in',           label: 'in (csv)' },
  { value: 'nin',          label: 'not in (csv)' },
  { value: 'exists',       label: 'is set' },
  { value: 'not_exists',   label: 'is not set' },
  { value: 'within_days',  label: 'within last N days' },
  { value: 'before',       label: 'before date' },
  { value: 'after',        label: 'after date' },
];

function makeLeaf(): EmailFilterLeaf {
  return { field: 'email', op: 'contains', value: '' };
}

function makeGroup(): EmailFilterGroup {
  return { combinator: 'AND', filters: [makeLeaf()] };
}

export function emptyFilterTree(): EmailFilterTree {
  return makeGroup();
}

interface EmailSegmentBuilderProps {
  value: EmailFilterTree;
  onChange: (next: EmailFilterTree) => void;
}

export function EmailSegmentBuilder({ value, onChange }: EmailSegmentBuilderProps) {
  return (
    <FilterGroupEditor group={value} onChange={onChange} depth={0} />
  );
}

interface GroupProps {
  group: EmailFilterGroup;
  onChange: (next: EmailFilterGroup) => void;
  depth: number;
  onRemove?: () => void;
}

function FilterGroupEditor({ group, onChange, depth, onRemove }: GroupProps) {
  const updateChild = (index: number, next: EmailFilterNode) => {
    const filters = [...group.filters];
    filters[index] = next;
    onChange({ ...group, filters });
  };
  const removeChild = (index: number) => {
    onChange({ ...group, filters: group.filters.filter((_, i) => i !== index) });
  };

  return (
    <div className={depth === 0 ? 'space-y-3' : 'rounded-lg border border-zoru-line bg-zoru-surface-raised p-3 space-y-3'}>
      <div className="flex items-center gap-2">
        <ZoruLabel className="text-xs uppercase tracking-wide text-zoru-ink-muted">
          Match
        </ZoruLabel>
        <ZoruSelect
          value={group.combinator}
          onValueChange={(v) => onChange({ ...group, combinator: v as FilterCombinator })}
        >
          <ZoruSelectTrigger className="w-28">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="AND">all</ZoruSelectItem>
            <ZoruSelectItem value="OR">any</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
        <ZoruBadge variant="outline" className="text-xs">
          {group.filters.length} rule{group.filters.length === 1 ? '' : 's'}
        </ZoruBadge>
        {onRemove ? (
          <ZoruButton type="button" variant="ghost" size="icon" onClick={onRemove} className="ml-auto">
            <Trash2 className="h-4 w-4" />
          </ZoruButton>
        ) : null}
      </div>

      <div className="space-y-2">
        {group.filters.map((node, i) => {
          if ('combinator' in node) {
            return (
              <FilterGroupEditor
                key={i}
                group={node as EmailFilterGroup}
                depth={depth + 1}
                onChange={(next) => updateChild(i, next)}
                onRemove={() => removeChild(i)}
              />
            );
          }
          return (
            <FilterLeafEditor
              key={i}
              leaf={node as EmailFilterLeaf}
              onChange={(next) => updateChild(i, next)}
              onRemove={() => removeChild(i)}
            />
          );
        })}
      </div>

      <div className="flex gap-2">
        <ZoruButton
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...group, filters: [...group.filters, makeLeaf()] })}
        >
          <Plus className="h-3 w-3" /> Add rule
        </ZoruButton>
        <ZoruButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...group, filters: [...group.filters, makeGroup()] })}
        >
          <Plus className="h-3 w-3" /> Add group
        </ZoruButton>
      </div>
    </div>
  );
}

interface LeafProps {
  leaf: EmailFilterLeaf;
  onChange: (next: EmailFilterLeaf) => void;
  onRemove: () => void;
}

function FilterLeafEditor({ leaf, onChange, onRemove }: LeafProps) {
  const needsValue = !['exists', 'not_exists'].includes(leaf.op);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ZoruSelect
        value={leaf.field}
        onValueChange={(v) => onChange({ ...leaf, field: v })}
      >
        <ZoruSelectTrigger className="w-48">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {FIELD_OPTIONS.map((opt) => (
            <ZoruSelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </ZoruSelect>

      <ZoruSelect
        value={leaf.op}
        onValueChange={(v) => onChange({ ...leaf, op: v as EmailFilterOp })}
      >
        <ZoruSelectTrigger className="w-44">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {OP_OPTIONS.map((opt) => (
            <ZoruSelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </ZoruSelect>

      {needsValue ? (
        <ZoruInput
          className="w-56"
          value={typeof leaf.value === 'string' || typeof leaf.value === 'number' ? String(leaf.value) : ''}
          onChange={(e) => onChange({ ...leaf, value: e.target.value })}
          placeholder="value"
        />
      ) : null}

      <ZoruButton type="button" variant="ghost" size="icon" onClick={onRemove} className="ml-auto">
        <Trash2 className="h-4 w-4" />
      </ZoruButton>
    </div>
  );
}
