'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const WORDS =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');

function generate(paragraphs: number, sentencesPerPara: number): string {
  const out: string[] = [];
  for (let p = 0; p < paragraphs; p++) {
    const sentences: string[] = [];
    for (let s = 0; s < sentencesPerPara; s++) {
      const len = 8 + Math.floor(Math.random() * 12);
      const words: string[] = [];
      for (let w = 0; w < len; w++) words.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
      const sentence = words.join(' ');
      sentences.push(sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.');
    }
    out.push(sentences.join(' '));
  }
  return out.join('\n\n');
}

export default function LoremIpsumPage() {
  const [paragraphs, setParagraphs] = useState(3);
  const [sentences, setSentences] = useState(5);
  const [text, setText] = useState(() => generate(3, 5));

  return (
    <ToolShell title="Lorem Ipsum Generator" description="Generate placeholder content.">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Paragraphs</Label>
          <Input type="number" min={1} max={50} value={paragraphs} onChange={(e) => setParagraphs(Number(e.target.value) || 1)} className="w-24" />
        </div>
        <div className="space-y-1">
          <Label>Sentences / paragraph</Label>
          <Input type="number" min={1} max={30} value={sentences} onChange={(e) => setSentences(Number(e.target.value) || 1)} className="w-32" />
        </div>
        <Button onClick={() => setText(generate(paragraphs, sentences))}>Generate</Button>
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(text)}>Copy</Button>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[320px] font-mono text-xs" />
    </ToolShell>
  );
}
