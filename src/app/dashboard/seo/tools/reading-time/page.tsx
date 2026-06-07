'use client';

import { Card, CardBody, Textarea, Input, Label, cn } from '@/components/sabcrm/20ui';
import {
  cn as _ui20Cn,
  useMemo,
  useState } from 'react';

void _ui20Cn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countWords } from '@/lib/seo-tools/text-utils';

export default function ReadingTimePage() {
  const [text, setText] = useState('');
  const [readingWpm, setReadingWpm] = useState(200);
  const [speakingWpm, setSpeakingWpm] = useState(150);
  const [imageCount, setImageCount] = useState(0);

  const words = useMemo(() => countWords(text), [text]);
  const chars = text.length;
  
  // Base reading time in seconds
  const baseReadingTimeSeconds = words && readingWpm > 0 ? (words / readingWpm) * 60 : 0;
  // Base speaking time in seconds
  const speakingTimeSeconds = words && speakingWpm > 0 ? (words / speakingWpm) * 60 : 0;
  
  // Image time in seconds (12 seconds per image)
  const imageTimeSeconds = imageCount * 12;

  const totalReadingTimeSeconds = baseReadingTimeSeconds + imageTimeSeconds;

  const formatTime = (totalSeconds: number) => {
    if (totalSeconds === 0) return '0 sec';
    if (totalSeconds < 60) return `${Math.ceil(totalSeconds)} sec`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.ceil(totalSeconds % 60);
    return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`;
  };

  const readingDisplay = formatTime(totalReadingTimeSeconds);
  const speakingDisplay = formatTime(speakingTimeSeconds);

  return (
    <ToolShell title="Reading Time & Content Analyzer" description="Comprehensive content analyzer that estimates reading time, speaking time, and accounts for images.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste content…" className="min-h-[220px]" />
      
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Reading (WPM)</Label>
          <Input type="number" value={readingWpm} onChange={(e) => setReadingWpm(Math.max(0, Number(e.target.value) || 0))} className="w-32" />
        </div>
        <div className="space-y-1">
          <Label>Speaking (WPM)</Label>
          <Input type="number" value={speakingWpm} onChange={(e) => setSpeakingWpm(Math.max(0, Number(e.target.value) || 0))} className="w-32" />
        </div>
        <div className="space-y-1">
          <Label>Number of Images</Label>
          <Input type="number" min="0" value={imageCount} onChange={(e) => setImageCount(Math.max(0, Number(e.target.value) || 0))} className="w-32" />
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardBody className="p-4"><div className="text-2xl font-bold">{words}</div><div className="text-xs text-[var(--st-text-secondary)]">Words</div></CardBody></Card>
        <Card><CardBody className="p-4"><div className="text-2xl font-bold">{chars}</div><div className="text-xs text-[var(--st-text-secondary)]">Characters</div></CardBody></Card>
        <Card><CardBody className="p-4"><div className="text-2xl font-bold">{readingDisplay}</div><div className="text-xs text-[var(--st-text-secondary)]">Reading time (w/ images)</div></CardBody></Card>
        <Card><CardBody className="p-4"><div className="text-2xl font-bold">{speakingDisplay}</div><div className="text-xs text-[var(--st-text-secondary)]">Speaking / TTS time</div></CardBody></Card>
      </div>
    </ToolShell>
  );
}
