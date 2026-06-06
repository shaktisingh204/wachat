'use client';

import { Card, ZoruCardContent, Textarea, cn } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { 
  fleschKincaidGrade, 
  fleschReadingEase, 
  gunningFogIndex, 
  smogIndex,
  countWords,
  countSyllablesInWord 
} from '@/lib/seo-tools/text-utils';

function easeLabel(score: number): string {
  if (score >= 90) return 'Very easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly diff.';
  if (score >= 30) return 'Difficult';
  return 'Very diff.';
}

function HighlightedPreview({ text }: { text: string }) {
  if (!text) return null;

  const parts = text.split(/([.!?]+\s*)/);
  const chunks = [];
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i];
    const delim = parts[i + 1] || '';
    if (sentence + delim) {
      chunks.push(sentence + delim);
    }
  }

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--st-text)]">
      {chunks.map((chunk, idx) => {
        const words = countWords(chunk);
        let bgColor = 'transparent';
        
        // Highlighting for long sentences
        if (words > 30) {
          bgColor = 'rgba(252, 165, 165, 0.4)'; // red-300 with opacity
        } else if (words > 20) {
          bgColor = 'rgba(253, 224, 71, 0.4)'; // yellow-300 with opacity
        }

        // Split chunk into words to highlight complex words
        const wordRegex = /([a-zA-Z]+)/g;
        let wordMatch;
        const elements = [];
        let lastIndex = 0;

        while ((wordMatch = wordRegex.exec(chunk)) !== null) {
          if (wordMatch.index > lastIndex) {
            elements.push(<span key={`s_${lastIndex}`}>{chunk.slice(lastIndex, wordMatch.index)}</span>);
          }
          
          const word = wordMatch[0];
          const syllables = countSyllablesInWord(word);
          const isComplex = syllables >= 3;
          
          elements.push(
            <span 
              key={`w_${wordMatch.index}`} 
              className={cn(isComplex && "bg-[var(--st-bg-muted)] text-[var(--st-text)] font-medium px-0.5 rounded-sm")}
            >
              {word}
            </span>
          );
          
          lastIndex = wordRegex.lastIndex;
        }
        
        if (lastIndex < chunk.length) {
          elements.push(<span key={`s_${lastIndex}`}>{chunk.slice(lastIndex)}</span>);
        }

        return (
          <span 
            key={idx} 
            style={{ backgroundColor: bgColor }} 
            className={cn(bgColor !== 'transparent' && 'rounded-sm transition-colors duration-200')}
          >
            {elements}
          </span>
        );
      })}
    </div>
  );
}

export default function ReadabilityScorePage() {
  const [text, setText] = useState('');
  
  const ease = useMemo(() => fleschReadingEase(text), [text]);
  const grade = useMemo(() => fleschKincaidGrade(text), [text]);
  const gunningFog = useMemo(() => gunningFogIndex(text), [text]);
  const smog = useMemo(() => smogIndex(text), [text]);

  const distribution = useMemo(() => {
    if (!text) return [];
    const parts = text.split(/([.!?]+\s*)/);
    const bins = {
      '1-10': 0,
      '11-20': 0,
      '21-30': 0,
      '31+': 0
    };
    
    for (let i = 0; i < parts.length; i += 2) {
      const sentence = parts[i];
      if (!sentence.trim()) continue;
      const count = countWords(sentence);
      if (count <= 10) bins['1-10']++;
      else if (count <= 20) bins['11-20']++;
      else if (count <= 30) bins['21-30']++;
      else bins['31+']++;
    }

    return [
      { name: '1-10 words', count: bins['1-10'] },
      { name: '11-20 words', count: bins['11-20'] },
      { name: '21-30 words', count: bins['21-30'] },
      { name: '31+ words', count: bins['31+'] },
    ];
  }, [text]);

  return (
    <ToolShell title="Readability Score" description="Analyze text readability and pinpoint complex sentences and words.">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <Textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Paste content here to see real-time analysis..." 
            className="min-h-[260px] text-base p-4 resize-y" 
          />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <ZoruCardContent className="p-4 flex flex-col items-center text-center justify-center">
                <div className="text-3xl font-bold">{ease.toFixed(1)}</div>
                <div className="text-xs text-[var(--st-text-secondary)] mt-1">Flesch Ease</div>
                <div className="text-[10px] text-[var(--st-text-secondary)] mt-1 font-medium bg-[var(--st-bg-muted)] px-2 py-0.5 rounded-full">{easeLabel(ease)}</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4 flex flex-col items-center text-center justify-center">
                <div className="text-3xl font-bold">{grade.toFixed(1)}</div>
                <div className="text-xs text-[var(--st-text-secondary)] mt-1">Flesch-Kincaid</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4 flex flex-col items-center text-center justify-center">
                <div className="text-3xl font-bold">{gunningFog.toFixed(1)}</div>
                <div className="text-xs text-[var(--st-text-secondary)] mt-1">Gunning Fog</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4 flex flex-col items-center text-center justify-center">
                <div className="text-3xl font-bold">{smog.toFixed(1)}</div>
                <div className="text-xs text-[var(--st-text-secondary)] mt-1">SMOG Index</div>
              </ZoruCardContent>
            </Card>
          </div>

          <Card>
            <ZoruCardContent className="p-4">
              <div className="text-sm font-semibold mb-4">Sentence Length Distribution</div>
              <div className="h-[200px] w-full">
                {distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{fill: 'var(--st-text-secondary)'}} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tick={{fill: 'var(--st-text-secondary)'}} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--st-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--st-text-secondary)]">
                    Add text to see distribution
                  </div>
                )}
              </div>
            </ZoruCardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex-1 min-h-[500px] shadow-sm border-[var(--st-border)]">
            <ZoruCardContent className="p-0 h-full flex flex-col">
              <div className="p-4 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-t-lg">
                <div className="text-sm font-semibold text-[var(--st-text)]">Real-time Analysis Preview</div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--st-text)]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[var(--st-bg-muted)] border border-[var(--st-border)]"></div> 
                    Long (&gt;20w)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[var(--st-bg-muted)] border border-[var(--st-border)]"></div> 
                    Very Long (&gt;30w)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[var(--st-bg-muted)] border border-[var(--st-border)]"></div> 
                    Complex
                  </div>
                </div>
              </div>
              <div className="p-5 overflow-y-auto flex-1 max-h-[700px]">
                <HighlightedPreview text={text} />
                {!text && (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--st-text-secondary)]/60 text-center">
                    Start typing or paste text in the editor<br/>to see the highlighted analysis...
                  </div>
                )}
              </div>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </ToolShell>
  );
}
