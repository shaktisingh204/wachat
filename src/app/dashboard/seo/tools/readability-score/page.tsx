'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { fleschKincaidGrade, fleschReadingEase } from '@/lib/seo-tools/text-utils';

function easeLabel(score: number): string {
  if (score >= 90) return 'Very easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly easy (7th grade)';
  if (score >= 60) return 'Standard (8–9th grade)';
  if (score >= 50) return 'Fairly difficult (10–12th grade)';
  if (score >= 30) return 'Difficult (college)';
  return 'Very difficult (graduate)';
}

export default function ReadabilityScorePage() {
  const [text, setText] = useState('');
  const ease = useMemo(() => fleschReadingEase(text), [text]);
  const grade = useMemo(() => fleschKincaidGrade(text), [text]);

  return (
    <ToolShell title="Readability Score" description="Flesch Reading Ease and Flesch–Kincaid grade level.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste content…" className="min-h-[260px]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ZoruCard>
          <ZoruCardContent className="p-4">
            <div className="text-2xl font-bold">{ease.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Flesch Reading Ease</div>
            <div className="text-xs mt-2">{easeLabel(ease)}</div>
          </ZoruCardContent>
        </ZoruCard>
        <ZoruCard>
          <ZoruCardContent className="p-4">
            <div className="text-2xl font-bold">{grade.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Flesch–Kincaid Grade Level</div>
          </ZoruCardContent>
        </ZoruCard>
      </div>
    </ToolShell>
  );
}
