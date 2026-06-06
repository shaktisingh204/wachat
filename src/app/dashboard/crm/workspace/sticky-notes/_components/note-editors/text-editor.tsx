'use client';

/**
 * Text note kind — minimal markdown-friendly editor (plain textarea today;
 * a real MDX/Tiptap surface is a follow-up). `value` is serialized into the
 * note's `blocksJson` as `{ kind: 'text', body: string }`.
 */

import * as React from 'react';
import { Textarea } from '@/components/sabcrm/20ui/compat';

export interface TextEditorProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function TextEditor({ value, onChange, disabled }: TextEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={16}
      disabled={disabled}
      placeholder="Start writing… (Markdown supported)"
      className="font-mono text-[14px]"
    />
  );
}
