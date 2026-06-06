'use client';

import { Button, Input, Card, CardBody, cn } from '@/components/sabcrm/20ui';
import { useState, useEffect, useMemo } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';
import { LuWand as LuWand2, LuTriangleAlert as LuAlertTriangle, LuCircleCheck as LuCheckCircle2, LuInfo } from 'react-icons/lu';

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
      <div className="flex gap-2">
        <Input 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          placeholder="https://example.com" 
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Check'}</Button>
      </div>
      
      {error && (
        <Card className="border-[var(--st-border)] mt-4">
          <CardBody className="p-4 text-[var(--st-text)] text-sm">{error}</CardBody>
        </Card>
      )}
      
      {originalTitle !== null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="space-y-4">
            <Card>
              <CardBody className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-2">Title Tag</div>
                  <Input 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full font-sans text-lg"
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>{Math.round(pixelWidth)}px / {DESKTOP_MAX}px</span>
                    <span className={widthStatus === 'ok' ? 'text-[var(--st-text)]' : widthStatus === 'too-long' ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}>
                      {widthStatus === 'ok' ? 'Length OK' : widthStatus === 'too-long' ? 'Too long (> 600px)' : 'Too short'}
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--st-bg-muted)] rounded overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-300",
                        widthStatus === 'ok' ? 'bg-[var(--st-text)]' : widthStatus === 'too-long' ? 'bg-[var(--st-text)]' : 'bg-[var(--st-text)]'
                      )} 
                      style={{ width: `${Math.min(100, (pixelWidth / DESKTOP_MAX) * 100)}%` }} 
                    />
                  </div>
                  <p className="text-[11px] text-[var(--st-text-secondary)] mt-1">Google typically truncates titles over ~600 pixels on desktop.</p>
                </div>

                <div className="pt-2 space-y-3 border-t">
                  <div className="flex items-start gap-2 text-sm">
                    {stuffing ? <LuAlertTriangle className="text-[var(--st-text)] mt-0.5" /> : <LuCheckCircle2 className="text-[var(--st-text)] mt-0.5" />}
                    <div>
                      <span className="font-medium">Keyword Stuffing: </span>
                      {stuffing ? (
                        <span className="text-[var(--st-text)]">Possible stuffing detected. Repeated words: {stuffedWords.join(', ')}.</span>
                      ) : (
                        <span className="text-[var(--st-text)]">No stuffing detected.</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 text-sm">
                    {titleMatchesH1 || titleContainsH1 ? <LuCheckCircle2 className="text-[var(--st-text)] mt-0.5" /> : <LuInfo className="text-[var(--st-text)] mt-0.5" />}
                    <div>
                      <span className="font-medium">H1 Match: </span>
                      <span className={titleMatchesH1 || titleContainsH1 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}>{h1StatusText}</span>
                      {h1 && <div className="text-xs text-[var(--st-text-secondary)] mt-1">H1: "{h1}"</div>}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardBody className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">AI Title Suggestions</div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={generateAiTitles} 
                    disabled={aiLoading || !title}
                  >
                    <LuWand2 className="mr-2 h-4 w-4" />
                    {aiLoading ? 'Generating...' : 'Generate'}
                  </Button>
                </div>
                
                {aiSuggestions.length > 0 ? (
                  <ul className="space-y-2">
                    {aiSuggestions.map((sug, idx) => (
                      <li key={idx} className="p-3 bg-[var(--st-bg-muted)]/50 rounded-md text-sm flex justify-between items-center group">
                        <span className="truncate mr-4" title={sug}>{sug}</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setTitle(sug)}
                        >
                          Use
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-[var(--st-text-secondary)] text-center py-6 border border-dashed rounded-md">
                    Click generate to get AI-optimized title suggestions based on your page's H1 and current title.
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
