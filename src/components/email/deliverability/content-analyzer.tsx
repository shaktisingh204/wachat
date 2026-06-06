'use client';

import { useState } from 'react';
import { Wand2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Button,
  Textarea,
  Badge,
} from '@/components/sabcrm/20ui/compat';

export function ContentAnalyzer() {
  const [content, setContent] = useState('');
  const [spamScore, setSpamScore] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (!content.trim()) return;
    setAnalyzing(true);
    setTimeout(() => {
      // Mock score (0-10, lower is better)
      setSpamScore(Math.floor(Math.random() * 4)); 
      
      const base = content.slice(0, 30);
      setAiSuggestions([
        `🚀 Exclusive: ${base}...`,
        `You won't believe this update on ${base}`,
        `Action Required: ${base}`
      ]);
      setAnalyzing(false);
    }, 1500);
  };

  return (
    <Card>
      <ZoruCardHeader>
        <div className="flex items-start justify-between">
          <div>
            <ZoruCardTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Content Analysis & AI Subjects
            </ZoruCardTitle>
            <ZoruCardDescription>
              Check your email content for spam triggers and generate catchy subject lines.
            </ZoruCardDescription>
          </div>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-4">
        <Textarea 
          placeholder="Paste your email content or draft subject line here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <Button onClick={handleAnalyze} disabled={analyzing || !content.trim()}>
          {analyzing ? 'Analyzing...' : 'Analyze Content'}
        </Button>

        {spamScore !== null && (
          <div className="pt-4 border-t border-[var(--st-border)] grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                Spam Score 
                {spamScore < 3 ? <CheckCircle2 className="h-4 w-4 text-[var(--st-text)]" /> : <AlertTriangle className="h-4 w-4 text-[var(--st-text)]" />}
              </h4>
              <div className="text-2xl font-bold">
                {spamScore} <span className="text-sm text-[var(--st-text-secondary)] font-normal">/ 10</span>
              </div>
              <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                {spamScore < 3 ? 'Looking good! Unlikely to trigger spam filters.' : 'Some spam words detected. Consider revising.'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Wand2 className="h-4 w-4" /> AI Subject Suggestions
              </h4>
              <ul className="space-y-2">
                {aiSuggestions.map((s, i) => (
                  <li key={i} className="text-sm p-2 bg-[var(--st-bg-muted)] rounded border border-[var(--st-border)]">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}
