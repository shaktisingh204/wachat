'use client';

import { CornerDownRight, FolderTree } from 'lucide-react';
import type { Block, Group, Variable } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  EmptyState,
  Callout,
} from '@/components/sabcrm/20ui';
import { PanelHeader } from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  /** All groups in the current flow - used to populate the target selector */
  groups?: Group[];
  variables?: Variable[];
};

export function JumpSettings({ block, onBlockChange, groups = [], variables: _variables = [] }: Props) {
  const options = block.options ?? {};
  const targetGroupId = typeof options.targetGroupId === 'string' ? options.targetGroupId : '';
  const blockLabel = typeof options.blockLabel === 'string' ? options.blockLabel : '';

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <PanelHeader icon={CornerDownRight} title="Jump" />

      {/* Target group dropdown */}
      <Field label="Jump to group">
        {groups.length > 0 ? (
          <Select
            value={targetGroupId}
            onValueChange={(v) => update({ targetGroupId: v })}
          >
            <SelectTrigger aria-label="Jump to group">
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.title || `Group ${g.id.slice(0, 6)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <EmptyState
            icon={FolderTree}
            size="sm"
            title="No groups yet"
            description="This flow has no groups to jump to."
          />
        )}
      </Field>

      {/* Optional block label / note */}
      <Field label="Block label (optional)">
        <Input
          type="text"
          value={blockLabel}
          onChange={(e) => update({ blockLabel: e.target.value })}
          placeholder="Describe the jump destination"
          aria-label="Block label"
        />
      </Field>

      <Callout tone="info">
        Execution jumps to the start of the selected group. Use this to create loops or shortcuts in your flow.
      </Callout>
    </div>
  );
}
