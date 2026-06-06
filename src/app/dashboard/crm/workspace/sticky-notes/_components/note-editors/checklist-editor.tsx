'use client';

/**
 * Checklist note kind — todo items with checkbox + text.
 * Serializes as `{ kind: 'checklist', items: [{ id, text, done }] }`.
 */

import * as React from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

import { Button, Checkbox, Input } from '@/components/sabcrm/20ui';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (next: ChecklistItem[]) => void;
  disabled?: boolean;
}

function genId(): string {
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChecklistEditor({
  items,
  onChange,
  disabled,
}: ChecklistEditorProps) {
  const updateItem = React.useCallback(
    (id: string, patch: Partial<ChecklistItem>) => {
      onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [items, onChange],
  );

  const removeItem = React.useCallback(
    (id: string) => {
      onChange(items.filter((it) => it.id !== id));
    },
    [items, onChange],
  );

  const addItem = React.useCallback(() => {
    onChange([...items, { id: genId(), text: '', done: false }]);
  }, [items, onChange]);

  return (
    <div className="flex flex-col gap-1.5">
      {items.length === 0 && (
        <p className="text-sm text-[var(--st-text-secondary)]">
          No items yet. Click &ldquo;Add item&rdquo; to start a checklist.
        </p>
      )}
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-[var(--st-text-secondary)]" />
          <Checkbox
            checked={it.done}
            onCheckedChange={(v) => updateItem(it.id, { done: v === true })}
            disabled={disabled}
            aria-label="Toggle done"
          />
          <Input
            value={it.text}
            onChange={(e) => updateItem(it.id, { text: e.target.value })}
            placeholder="Item…"
            disabled={disabled}
            className={
              it.done
                ? 'flex-1 line-through text-[var(--st-text-secondary)]'
                : 'flex-1'
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeItem(it.id)}
            disabled={disabled}
            aria-label="Remove item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </div>
    </div>
  );
}
