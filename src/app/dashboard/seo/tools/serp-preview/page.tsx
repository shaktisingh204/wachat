'use client';

import { useState, useEffect, useRef } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Globe } from 'lucide-react';
import { Field, Input, Switch, Card, CardBody, Textarea } from '@/components/sabcrm/20ui';

function useTextWidth() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
  }, []);

  const measureWidth = (text: string, font: string) => {
    if (!canvasRef.current) return 0;
    const context = canvasRef.current.getContext('2d');
    if (!context) return 0;
    context.font = font;
    return context.measureText(text).width;
  };

  const truncateByPixel = (text: string, font: string, maxWidth: number) => {
    if (!canvasRef.current) return text;
    const context = canvasRef.current.getContext('2d');
    if (!context) return text;

    context.font = font;
    if (context.measureText(text).width <= maxWidth) return text;

    const ellipsis = '...';
    const ellipsisWidth = context.measureText(ellipsis).width;

    let left = 0;
    let right = text.length;
    let result = text;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const substring = text.substring(0, mid);
      const width = context.measureText(substring).width;

      if (width + ellipsisWidth <= maxWidth) {
        result = substring;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result.trim() + ellipsis;
  };

  return { measureWidth, truncateByPixel };
}

export default function SerpPreviewPage() {
  const [title, setTitle] = useState('Best SEO Tools in 2024, A Complete Buyer Guide');
  const [url, setUrl] = useState('https://www.example.com/best-seo-tools');
  const [description, setDescription] = useState('This is an example of a meta description. It should be concise, informative, and engaging. A good meta description can improve your click-through rate dramatically if properly optimized.');

  const [showDate, setShowDate] = useState(false);
  const [dateStr, setDateStr] = useState('Oct 15, 2024');
  const [showStars, setShowStars] = useState(false);
  const [rating, setRating] = useState('4.8');
  const [votes, setVotes] = useState('125');

  const { measureWidth, truncateByPixel } = useTextWidth();

  // Truncation calculations
  const [truncatedTitle, setTruncatedTitle] = useState(title);
  const [truncatedUrl, setTruncatedUrl] = useState(url);
  const [hostname, setHostname] = useState('example.com');
  const [truncatedDesc, setTruncatedDesc] = useState(description);

  const [titleWidth, setTitleWidth] = useState(0);
  const [descWidth, setDescWidth] = useState(0);

  const MAX_TITLE_WIDTH = 600;
  const MAX_DESC_WIDTH = 960; // Approx 2 lines of description
  const TITLE_FONT = '20px arial, sans-serif';
  const DESC_FONT = '14px arial, sans-serif';

  useEffect(() => {
    setTitleWidth(measureWidth(title, TITLE_FONT));
    setTruncatedTitle(truncateByPixel(title, TITLE_FONT, MAX_TITLE_WIDTH));

    let availableDescWidth = MAX_DESC_WIDTH;

    if (showDate && dateStr) {
      const datePrefix = `${dateStr} - `;
      const dateWidth = measureWidth(datePrefix, DESC_FONT);
      availableDescWidth -= dateWidth;
    }

    setDescWidth(measureWidth(description, DESC_FONT));
    setTruncatedDesc(truncateByPixel(description, DESC_FONT, availableDescWidth));

    // Simple URL parsing for breadcrumb look
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      setHostname(u.hostname.replace('www.', ''));
      setTruncatedUrl(`${u.hostname.replace('www.', '')} › ${u.pathname.split('/').filter(Boolean).join(' › ')}`);
    } catch {
      setHostname('example.com');
      setTruncatedUrl(url);
    }

  }, [title, url, description, showDate, dateStr, measureWidth, truncateByPixel]);

  const titleOver = titleWidth > MAX_TITLE_WIDTH;
  const descOver = descWidth > MAX_DESC_WIDTH;

  return (
    <ToolShell
      title="SERP Preview & Simulator"
      description="Preview how your web page will look in Google's Search Engine Results Pages (SERP). We use pixel-width simulation for accurate truncation."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Editor Panel */}
        <Card>
          <CardBody className="space-y-6">
            <div className="space-y-4">
              <Field
                label={
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>Title Tag</span>
                    <span className={`text-xs font-normal ${titleOver ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}`}>
                      {Math.round(titleWidth)} / {MAX_TITLE_WIDTH}px
                    </span>
                  </span>
                }
              >
                <Input value={title} onChange={e => setTitle(e.target.value)} invalid={titleOver} />
                <div className="h-1.5 w-full bg-[var(--st-bg-muted)] rounded-[var(--st-radius-pill)] overflow-hidden">
                  <div
                    className={`h-full rounded-[var(--st-radius-pill)] ${titleOver ? 'bg-[var(--st-danger)]' : 'bg-[var(--st-accent)]'}`}
                    style={{ width: `${Math.min(100, (titleWidth / MAX_TITLE_WIDTH) * 100)}%` }}
                  />
                </div>
              </Field>

              <Field label="URL">
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
              </Field>

              <Field
                label={
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>Meta Description</span>
                    <span className={`text-xs font-normal ${descOver ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}`}>
                      {Math.round(descWidth)} / {MAX_DESC_WIDTH}px
                    </span>
                  </span>
                }
              >
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  invalid={descOver}
                />
                <div className="h-1.5 w-full bg-[var(--st-bg-muted)] rounded-[var(--st-radius-pill)] overflow-hidden">
                  <div
                    className={`h-full rounded-[var(--st-radius-pill)] ${descOver ? 'bg-[var(--st-danger)]' : 'bg-[var(--st-accent)]'}`}
                    style={{ width: `${Math.min(100, (descWidth / MAX_DESC_WIDTH) * 100)}%` }}
                  />
                </div>
              </Field>
            </div>

            <div className="pt-4 border-t border-[var(--st-border)] space-y-4">
              <h3 className="font-semibold text-sm text-[var(--st-text)]">Rich Snippets</h3>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--st-text)]">Show Date Snippet</span>
                <Switch checked={showDate} onCheckedChange={setShowDate} aria-label="Show date snippet" />
              </div>
              {showDate && (
                <Field label="Snippet date">
                  <Input
                    value={dateStr}
                    onChange={e => setDateStr(e.target.value)}
                    placeholder="e.g. Oct 15, 2024"
                  />
                </Field>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--st-text)]">Show Star Ratings</span>
                <Switch checked={showStars} onCheckedChange={setShowStars} aria-label="Show star ratings" />
              </div>
              {showStars && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Rating">
                    <Input type="number" step="0.1" value={rating} onChange={e => setRating(e.target.value)} />
                  </Field>
                  <Field label="Votes">
                    <Input type="number" value={votes} onChange={e => setVotes(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Preview Panel */}
        <div>
          <p className="mb-4 block text-lg font-semibold text-[var(--st-text)]">Google Desktop Preview</p>
          <Card padding="lg">
            <div className="font-[arial,sans-serif] text-[14px]">

              {/* URL & Breadcrumb */}
              <div className="flex items-center text-[var(--st-text)] text-[14px] leading-tight mb-1">
                <div className="w-7 h-7 bg-[var(--st-bg-muted)] rounded-full flex items-center justify-center mr-3 overflow-hidden">
                  {hostname !== 'example.com' ? (
                    <img src={`https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=32`} alt={`${hostname} favicon`} className="w-4 h-4" />
                  ) : (
                    <Globe className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[var(--st-text)] text-[14px]">{hostname}</span>
                  <span className="text-[var(--st-text-secondary)] text-[12px] mt-0.5">{truncatedUrl}</span>
                </div>
              </div>

              {/* Title */}
              <a href="#" className="group block mb-1">
                <h3 className="text-[var(--st-accent)] group-hover:underline text-[20px] leading-[1.3] font-normal m-0 p-0 break-words max-w-[600px]">
                  {truncatedTitle || 'Please enter a title'}
                </h3>
              </a>

              {/* Rich Snippets (Stars) */}
              {showStars && (
                <div className="flex items-center text-[14px] text-[var(--st-text-secondary)] mb-1">
                  <span className="text-[var(--st-warn)] mr-1" aria-hidden="true">
                    {'★'.repeat(Math.round(Number(rating)))}{'☆'.repeat(5 - Math.round(Number(rating)))}
                  </span>
                  <span>Rating: {rating} · {votes} votes</span>
                </div>
              )}

              {/* Description */}
              <div className="text-[var(--st-text)] text-[14px] leading-[1.58] max-w-[600px] break-words">
                {showDate && <span className="text-[var(--st-text-secondary)] font-bold mr-1">{dateStr} -</span>}
                <span>{truncatedDesc}</span>
              </div>

            </div>
          </Card>

          <div className="mt-8 text-sm text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <h4 className="font-semibold text-[var(--st-text)] mb-2">Why Pixel Width?</h4>
            <p className="mb-2">
              Google truncates SERP snippets based on the actual pixel width of characters, not strict character counts. For example, a "W" is much wider than an "i".
            </p>
            <p>
              This simulator accurately estimates widths: ~600px for titles and ~960px for descriptions (roughly two lines of text).
            </p>
          </div>
        </div>

      </div>
    </ToolShell>
  );
}
