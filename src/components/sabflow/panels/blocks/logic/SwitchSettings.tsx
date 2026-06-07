'use client';

import { createId } from '@paralleldrive/cuid2';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import {
  Field,
  Input,
  Label,
  Button,
  IconButton,
  Card,
  CardBody,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import type { Block, SwitchCase, SwitchOptions } from '@/lib/sabflow/types';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables: string[];
};

const OPERATORS: Array<{ value: NonNullable<SwitchCase['operator']>; label: string }> = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'greaterThan', label: 'greater than' },
  { value: 'lessThan', label: 'less than' },
];

export function SwitchSettings({ block, onUpdate }: Props) {
  const options = (block.options ?? {}) as SwitchOptions;
  const cases: SwitchCase[] = options.cases ?? [];

  const update = (patch: Partial<SwitchOptions>) =>
    onUpdate({ options: { ...options, ...patch } });

  const addCase = () => {
    const index = cases.length + 1;
    update({
      cases: [
        ...cases,
        {
          id: createId(),
          pinId: `case_${index}`,
          label: `Case ${index}`,
          operator: 'equals',
          value: '',
        },
      ],
    });
  };

  const updateCase = (id: string, patch: Partial<SwitchCase>) => {
    update({ cases: cases.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const removeCase = (id: string) => {
    update({ cases: cases.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-4">
      <Field label="Expression">
        <Input
          type="text"
          value={options.expression ?? ''}
          onChange={(e) => update({ expression: e.target.value })}
          placeholder="{{status}} or $json.country"
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Cases</Label>
          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addCase}>
            Add case
          </Button>
        </div>

        {cases.length === 0 ? (
          <EmptyState
            size="sm"
            icon={GitBranch}
            title="No cases yet"
            description="Add a case to route the input based on its value."
          />
        ) : null}

        {cases.map((c) => (
          <Card key={c.id}>
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    value={c.label ?? ''}
                    onChange={(e) => updateCase(c.id, { label: e.target.value })}
                    placeholder="Label"
                  />
                </div>
                <IconButton
                  label="Remove case"
                  icon={Trash2}
                  variant="danger"
                  size="sm"
                  onClick={() => removeCase(c.id)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={c.operator ?? 'equals'}
                  onValueChange={(value) =>
                    updateCase(c.id, {
                      operator: value as SwitchCase['operator'],
                    })
                  }
                >
                  <SelectTrigger aria-label="Operator">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  value={c.value ?? ''}
                  onChange={(e) => updateCase(c.id, { value: e.target.value })}
                  placeholder="Compare to"
                />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
