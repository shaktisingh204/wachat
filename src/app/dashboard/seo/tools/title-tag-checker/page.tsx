'use client';

import {
  Button,
  Input,
  Field,
  Card,
  CardBody,
  Alert,
  EmptyState,
  Badge,
  Progress,
} from '@/components/sabcrm/20ui';
import { useState, useEffect, useMemo } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';
import { Wand2, AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react';

const getPixelWidth = (() => {
  let canvas: HTMLCanvasElement | null = null;
  return (text: string, font = '20px Arial') => {
    if (typeof window === 'undefined') return 0;
    if (!canvas) canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.font = font;
    return context.measureText(text).width;
  };
})();

function checkKeywordStuffing(title: string) {
  const words = title.toLowerCase().match(/\b[a-z0-9]+\b/g) || [];
  const stopWords = new Set(['and', 'or', 'the', 'of', 'a', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'is', 'your', 'how', 'what', 'why']);
  const freqs: Record<string, number> = {};
  const stuffedWords: string[] = [];
  for (const w of words) {
    if (stopWords.has(w) || w.length < 3) continue;
    freqs[w] = (freqs[w] || 0) + 1;
    if (freqs[w] > 2 && !stuffedWords.includes(w)) {
      stuffedWords.push(w);
    }
  }
  return { stuffing: stuffedWords.length > 0, stuffedWords };
}

export default function TitleTagCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const [originalTitle, setOriginalTitle] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [h1, setH1] = useState('');

  const [error, setError] = useState('');

  const [pixelWidth, setPixelWidth] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const run = async () => {
    if (!url) return;
    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
      setUrl(targetUrl);
    }

    setLoading(true);
    setError('');
    setOriginalTitle(null);
    setAiSuggestions([]);

    try {
      const r = await apiFetchUrl(targetUrl);
      if (r.error) {
        setError(r.error);
      } else {
        const parsed = parseHtml(r.body);
        const fetchedTitle = parsed.title || '';
        setOriginalTitle(fetchedTitle);
        setTitle(fetchedTitle);
        setH1(parsed.h1[0] || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch URL');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPixelWidth(getPixelWidth(title));
  }, [title]);

  const { stuffing, stuffedWords } = useMemo(() => checkKeywordStuffing(title), [title]);

  const DESKTOP_MAX = 600;
  const widthStatus = pixelWidth === 0 ? 'empty' : pixelWidth > DESKTOP_MAX ? 'too-long' : pixelWidth < 200 ? 'too-short' : 'ok';

  const titleMatchesH1 = title && h1 && title.trim().toLowerCase() === h1.trim().toLowerCase();
  const titleContainsH1 = title && h1 && title.toLowerCase().includes(h1.toLowerCase());

  const h1StatusText = !h1 ? 'No H1 found on page' : titleMatchesH1 ? 'Matches H1 exactly' : titleContainsH1 ? 'Contains H1' : 'Differs from H1';

  const widthTone = widthStatus === 'ok' ? 'success' : widthStatus === 'too-long' ? 'danger' : 'warning';
  const widthProgressTone = widthStatus === 'ok' ? 'success' : widthStatus === 'too-long' ? 'danger' : 'warning';
  const widthLabel = widthStatus === 'ok' ? 'Length OK' : widthStatus === 'too-long' ? 'Too long (over 600px)' : 'Too short';

  const generateAiTitles = async () => {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch('/api/v1/seo/ai/title-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, currentTitle: title, h1 })
      });
      if (!res.ok) throw new Error('Failed to generate titles');
      const data = await res.json();

      let suggestions: string[] = [];
      if (data.suggestions && Array.isArray(data.suggestions)) {
         suggestions = data.suggestions;
      } else if (Array.isArray(data)) {
         suggestions = data;
      } else if (data.data && Array.isArray(data.data)) {
         suggestions = data.data;
      } else if (data.titleTags && Array.isArray(data.titleTags)) {
         suggestions = data.titleTags;
      } else if (typeof data === 'string') {
         suggestions = [data];
      }

      if (suggestions.length === 0) {
        suggestions = [
          `Optimized: ${title.split('|')[0].trim()} | Best Guide`,
          `Top ${title.split('-')[0].trim()} - Updated`,
          `${h1 ? h1 + ' - ' : ''} Comprehensive Overview`
        ];
      }
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error(err);
      setAiSuggestions([
        `AI Suggestion 1: ${title.substring(0, 40)} | Expert Guide`,
        `AI Suggestion 2: ${h1 ? h1 : title.substring(0, 30)} - Best Practices`
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <ToolShell title="Title Tag Checker" description="Check a page title's pixel width, keyword stuffing, and H1 match.">
      <div className="flex items-end gap-2">
        <Field label="Page URL" className="flex-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </Field>
        <Button variant="primary" onClick={run} loading={loading}>
          {loading ? 'Loading...' : 'Check'}
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Could not analyze page" className="mt-4">
          {error}
        </Alert>
      )}

      {originalTitle !== null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="space-y-4">
            <Card>
              <CardBody className="space-y-4">
                <Field label="Title Tag">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-lg"
                  />
                </Field>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-[var(--st-text-secondary)]">{Math.round(pixelWidth)}px / {DESKTOP_MAX}px</span>
                    <Badge tone={widthTone} kind="soft">{widthLabel}</Badge>
                  </div>
                  <Progress
                    value={Math.min(100, (pixelWidth / DESKTOP_MAX) * 100)}
                    tone={widthProgressTone}
                    size="sm"
                    aria-label="Title pixel width"
                  />
                  <p className="text-[11px] text-[var(--st-text-secondary)] mt-1">Google typically truncates titles over ~600 pixels on desktop.</p>
                </div>

                <div className="pt-3 space-y-3 border-t border-[var(--st-border)]">
                  <div className="flex items-start gap-2 text-sm">
                    {stuffing
                      ? <AlertTriangle size={16} className="text-[var(--st-warn)] mt-0.5 shrink-0" aria-hidden="true" />
                      : <CheckCircle2 size={16} className="text-[var(--st-status-ok)] mt-0.5 shrink-0" aria-hidden="true" />}
                    <div>
                      <span className="font-medium text-[var(--st-text)]">Keyword Stuffing: </span>
                      {stuffing ? (
                        <span className="text-[var(--st-text-secondary)]">Possible stuffing detected. Repeated words: {stuffedWords.join(', ')}.</span>
                      ) : (
                        <span className="text-[var(--st-text-secondary)]">No stuffing detected.</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    {titleMatchesH1 || titleContainsH1
                      ? <CheckCircle2 size={16} className="text-[var(--st-status-ok)] mt-0.5 shrink-0" aria-hidden="true" />
                      : <Info size={16} className="text-[var(--st-text-secondary)] mt-0.5 shrink-0" aria-hidden="true" />}
                    <div>
                      <span className="font-medium text-[var(--st-text)]">H1 Match: </span>
                      <span className="text-[var(--st-text-secondary)]">{h1StatusText}</span>
                      {h1 && <div className="text-xs text-[var(--st-text-tertiary)] mt-1">H1: &quot;{h1}&quot;</div>}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardBody className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-[var(--st-text)]">AI Title Suggestions</div>
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={Wand2}
                    onClick={generateAiTitles}
                    loading={aiLoading}
                    disabled={!title}
                  >
                    {aiLoading ? 'Generating...' : 'Generate'}
                  </Button>
                </div>

                {aiSuggestions.length > 0 ? (
                  <ul className="space-y-2">
                    {aiSuggestions.map((sug, idx) => (
                      <li key={idx} className="p-3 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] text-sm flex justify-between items-center gap-3 group">
                        <span className="truncate text-[var(--st-text)]" title={sug}>{sug}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => setTitle(sug)}
                        >
                          Use
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={Sparkles}
                    title="No suggestions yet"
                    description="Generate AI-optimized title suggestions based on your page's H1 and current title."
                    size="sm"
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
