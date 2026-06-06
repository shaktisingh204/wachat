'use client';

import { Card, CardBody, Textarea, cn } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import * as sbd from 'sbd';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countWords } from '@/lib/seo-tools/text-utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SentenceCounterPage() {
  const [text, setText] = useState('');

  // Use sbd to tokenize sentences using advanced NLP boundary detection
  const parsedSentences = useMemo(() => {
    if (!text.trim()) return [];
    return sbd.sentences(text, { newline_boundaries: true, html_boundaries: false });
  }, [text]);

  const sentencesCount = parsedSentences.length;
  const wordsCount = useMemo(() => countWords(text), [text]);
  const avg = sentencesCount ? (wordsCount / sentencesCount).toFixed(1) : '0';

  // Identify "hard to read" sentences (> 20 words)
  const hardToReadSentences = parsedSentences.filter((s) => countWords(s) > 20);
  const hasHardToRead = hardToReadSentences.length > 0;

  // Reconstruct original text to preserve whitespaces and newlines perfectly
  const renderHighlightedText = () => {
    const elements: React.ReactNode[] = [];
    let remainingText = text;

    parsedSentences.forEach((s, i) => {
      const index = remainingText.indexOf(s);
      if (index === -1) return; // Fallback, should not happen

      // Push preceding whitespace
      const precedingWhitespace = remainingText.substring(0, index);
      if (precedingWhitespace) {
        elements.push(<span key={`ws-${i}`}>{precedingWhitespace}</span>);
      }

      // Analyze sentence
      const wordsInSent = countWords(s);
      const isVeryLong = wordsInSent > 25;
      const isLong = wordsInSent > 20 && !isVeryLong;

      elements.push(
        <span
          key={`s-${i}`}
          className={cn(
            'transition-colors duration-200 rounded-[2px]',
            isVeryLong
              ? 'bg-[var(--st-bg-muted)]/60 dark:bg-[var(--st-text)]/40 border-b border-[var(--st-border)] dark:border-[var(--st-border)]'
              : '',
            isLong
              ? 'bg-[var(--st-bg-muted)]/60 dark:bg-[var(--st-text)]/40 border-b border-[var(--st-border)] dark:border-[var(--st-border)]'
              : ''
          )}
          title={
            isVeryLong
              ? `Very hard to read (${wordsInSent} words)`
              : isLong
              ? `Hard to read (${wordsInSent} words)`
              : `${wordsInSent} words`
          }
        >
          {s}
        </span>
      );

      remainingText = remainingText.substring(index + s.length);
    });

    if (remainingText) {
      elements.push(<span key="ws-end">{remainingText}</span>);
    }

    return elements;
  };

  return (
    <ToolShell title="Sentence Counter" description="Count sentences and average words per sentence.">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your text here to analyze sentences…"
        className="min-h-[240px]"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        <Card>
          <CardBody className="p-4 flex flex-col justify-center items-center">
            <div className="text-3xl font-bold text-[var(--st-text)]">{sentencesCount}</div>
            <div className="text-sm text-[var(--st-text-tertiary)] font-medium mt-1">Sentences</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4 flex flex-col justify-center items-center">
            <div className="text-3xl font-bold text-[var(--st-text)]">{wordsCount}</div>
            <div className="text-sm text-[var(--st-text-tertiary)] font-medium mt-1">Words</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4 flex flex-col justify-center items-center">
            <div className="text-3xl font-bold text-[var(--st-text)]">{avg}</div>
            <div className="text-sm text-[var(--st-text-tertiary)] font-medium mt-1">Words / sentence</div>
          </CardBody>
        </Card>
      </div>

      {text.trim() && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold text-[var(--st-text)]">Analysis</h3>
            {hasHardToRead ? (
              <span className="inline-flex items-center text-xs bg-[var(--st-bg-muted)] text-[var(--st-text)] px-2 py-1 rounded-full font-medium">
                <AlertCircle className="w-3 h-3 mr-1" />
                {hardToReadSentences.length} hard to read {hardToReadSentences.length === 1 ? 'sentence' : 'sentences'}
              </span>
            ) : (
              <span className="inline-flex items-center text-xs bg-[var(--st-bg-muted)] text-[var(--st-text)] px-2 py-1 rounded-full font-medium">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Easy to read
              </span>
            )}
          </div>

          <Card className="bg-[var(--st-bg)] overflow-hidden border-[var(--st-border)]">
            <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {renderHighlightedText()}
            </div>
          </Card>

          {hasHardToRead && (
            <div className="mt-4 flex gap-4 text-xs text-[var(--st-text-tertiary)]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[var(--st-bg-muted)]/60 border border-[var(--st-border)]"></div>
                <span>Hard to read (&gt;20 words)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[var(--st-bg-muted)]/60 border border-[var(--st-border)]"></div>
                <span>Very hard to read (&gt;25 words)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
