import * as React from 'react';
import { Textarea, Input } from '@/components/zoruui';
import { Field } from './Field';
import { AIBodyGenerator } from './AIBodyGenerator';
import { VariableExamples } from './VariableExamples';

interface BodyEditorProps {
  body: string;
  setBody: (v: string) => void;
  footer: string;
  setFooter: (v: string) => void;
}

export function BodyEditor({
  body,
  setBody,
  footer,
  setFooter,
}: BodyEditorProps) {
  const charCount = body.length;
  const varCount = (body.match(/{{\s*\d+\s*}}/g) || []).length;

  return (
    <>
      <Field
        label="Body"
        required
        hint={`${charCount}/1024 chars · ${varCount} variable(s)`}
      >
        <Textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hello {{1}}, your order #{{2}} is confirmed…"
          required
          rows={5}
        />
        <div className="mt-2">
          <AIBodyGenerator onGenerate={setBody} />
        </div>
        <VariableExamples text={body} prefix="body" />
      </Field>

      <Field label="Footer" hint="Optional, max 60 chars">
        <Input
          name="footer"
          value={footer}
          onChange={(e) => setFooter(e.target.value.slice(0, 60))}
          placeholder="e.g., Reply STOP to unsubscribe"
        />
      </Field>
    </>
  );
}
