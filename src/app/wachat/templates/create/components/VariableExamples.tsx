import * as React from 'react';
import { Input } from '@/components/zoruui';

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
    <div className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <p className="text-[11px] font-semibold text-zoru-ink">
        Variable examples required
      </p>
      <div className="space-y-1.5">
        {vars.map((v) => (
          <div key={v} className="flex items-center gap-2">
            <span className="w-12 font-mono text-[11px] text-zoru-ink-muted">
              {`{{${v}}}`}
            </span>
            <Input
              name={`${prefix}_example_${v}`}
              placeholder={
                suggestions[v] || `Example for variable ${v}`
              }
              required
              className="h-8 text-[12px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
