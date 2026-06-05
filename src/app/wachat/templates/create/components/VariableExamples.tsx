import * as React from 'react';
import { Card, CardBody, Input } from '@/components/sabcrm/20ui';

export function VariableExamples({
  text,
  prefix,
}: {
  text: string;
  prefix: string;
}) {
  const matches = text.match(/{{\s*(\d+)\s*}}/g);
  if (!matches || matches.length === 0) return null;

  const vars = [
    ...new Set(
      matches.map((m) => parseInt(m.replace(/[{}]/g, '').trim())),
    ),
  ]
    .sort((a, b) => a - b)
    .filter((n) => n > 0);
  if (vars.length === 0) return null;

  const suggestions: Record<number, string> = {
    1: 'John',
    2: 'ORD-12345',
    3: 'confirmed',
    4: 'https://track.example.com',
  };

  return (
    <Card variant="outlined" padding="sm">
      <CardBody>
        <p className="text-[11px] font-semibold text-[var(--st-text)] mb-2">
          Variable examples required
        </p>
        <div className="space-y-1.5">
          {vars.map((v) => {
            const fieldId = `${prefix}_example_${v}`;
            return (
              <div key={v} className="flex items-center gap-2">
                <label
                  htmlFor={fieldId}
                  className="w-12 text-[11px] font-mono text-[var(--st-text-tertiary)]"
                >
                  {`{{${v}}}`}
                </label>
                <Input
                  id={fieldId}
                  name={fieldId}
                  placeholder={suggestions[v] || `Example for variable ${v}`}
                  required
                  className="h-8 flex-1 text-[12px]"
                />
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
