'use client';

import { Card, ZoruCardContent, Textarea, cn, Progress, Badge } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { 
  countParagraphs, 
  countSentences, 
  countWords, 
  countCharacters,
  readingTimeMinutes,
  fleschReadingEase,
  fleschKincaidGrade,
  ngramDensity
} from '@/lib/seo-tools/text-utils';

export default function ParagraphCounterPage() {
  const [text, setText] = useState('');
  
  const p = useMemo(() => countParagraphs(text), [text]);
  const s = useMemo(() => countSentences(text), [text]);
  const w = useMemo(() => countWords(text), [text]);
  
  const charsWithSpaces = useMemo(() => countCharacters(text, true), [text]);
  const charsWithoutSpaces = useMemo(() => countCharacters(text, false), [text]);
  
  const readTime = useMemo(() => readingTimeMinutes(text), [text]);
  const readingEase = useMemo(() => fleschReadingEase(text), [text]);
  const gradeLevel = useMemo(() => fleschKincaidGrade(text), [text]);

  const keywords = useMemo(() => {
    if (!text.trim()) return [];
    return ngramDensity(text, 1, true).slice(0, 10);
  }, [text]);

  const bigrams = useMemo(() => {
    if (!text.trim()) return [];
    return ngramDensity(text, 2, false).slice(0, 10);
  }, [text]);

  const getReadabilityFeedback = (score: number): { label: string; tone: "green" | "amber" | "red" | "neutral" } => {
    if (!text.trim()) return { label: 'N/A', tone: 'neutral' };
    if (score >= 80) return { label: 'Easy', tone: 'green' };
    if (score >= 60) return { label: 'Standard', tone: 'green' };
    if (score >= 50) return { label: 'Fairly Difficult', tone: 'amber' };
    if (score >= 30) return { label: 'Difficult', tone: 'red' };
    return { label: 'Very Confusing', tone: 'red' };
  };

  const readingFeedback = getReadabilityFeedback(readingEase);

  return (
    <ToolShell title="Content Analyzer" description="Count paragraphs, sentences, words, characters, estimate reading time, and analyze readability & keyword density.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Paste your text here to analyze..." 
            className="min-h-[400px] text-base resize-y" 
          />
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <ZoruCardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <div className="text-3xl font-bold text-primary">{p}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Paragraphs</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <div className="text-3xl font-bold text-primary">{s}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Sentences</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <div className="text-3xl font-bold text-primary">{w}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Words</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <div className="text-3xl font-bold text-primary">{readTime}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">Min Read</div>
              </ZoruCardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             <Card>
              <ZoruCardContent className="p-4 flex justify-between items-center h-full">
                <div className="text-sm font-medium text-muted-foreground">Characters (no spaces)</div>
                <div className="text-xl font-bold">{charsWithoutSpaces}</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4 flex justify-between items-center h-full">
                <div className="text-sm font-medium text-muted-foreground">Characters (with spaces)</div>
                <div className="text-xl font-bold">{charsWithSpaces}</div>
              </ZoruCardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <ZoruCardContent className="p-5">
              <h3 className="text-lg font-semibold mb-4">Readability</h3>
              
              <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                  <div className="text-sm font-medium">Flesch Reading Ease</div>
                  <div className="text-2xl font-bold">{text ? readingEase.toFixed(1) : 0}</div>
                </div>
                <Progress value={text ? Math.min(100, Math.max(0, readingEase)) : 0} className="h-2 mb-3" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">0-100 (Higher is easier)</span>
                  <Badge tone={readingFeedback.tone}>{readingFeedback.label}</Badge>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="text-sm font-medium">Flesch-Kincaid Grade Level</div>
                  <div className="text-2xl font-bold">{text ? Math.max(0, gradeLevel).toFixed(1) : 0}</div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approximate years of schooling required to understand the text.
                </p>
              </div>
            </ZoruCardContent>
          </Card>

          <Card className="flex-1">
            <ZoruCardContent className="p-5 h-full">
              <h3 className="text-lg font-semibold mb-4">Keyword Density</h3>
              {keywords.length > 0 ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Top Words</h4>
                    <div className="space-y-2.5">
                      {keywords.slice(0, 5).map((kw, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate max-w-[120px]" title={kw.word}>{kw.word}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4 text-right">{kw.count}</span>
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 w-12 justify-center">{kw.density.toFixed(1)}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {bigrams.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">Top 2-Word Phrases</h4>
                      <div className="space-y-2.5">
                        {bigrams.slice(0, 5).map((bg, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate max-w-[120px]" title={bg.word}>{bg.word}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4 text-right">{bg.count}</span>
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 w-12 justify-center">{bg.density.toFixed(1)}%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Paste some text to see keyword density.
                </div>
              )}
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </ToolShell>
  );
}
