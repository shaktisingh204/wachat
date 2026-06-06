'use client';

import { Button, Input, Card, CardBody } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';

import { Check, X, Info } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function MobileFriendlyPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<{ label: string; pass: boolean; details?: string }[]>([]);
  const [method, setMethod] = useState<'pagespeed' | 'fallback' | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    setChecks([]);
    setScore(null);
    setMethod(null);

    try {
      let psiSuccess = false;

      // 1. Try Google PageSpeed Insights API first
      try {
        const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
          url
        )}&category=seo&strategy=mobile`;
        const res = await fetch(psiUrl);
        const data = await res.json();

        if (data.lighthouseResult) {
          const audits = data.lighthouseResult.audits;
          const seo = data.lighthouseResult.categories.seo;

          if (seo?.score !== undefined) {
            setScore(Math.round(seo.score * 100));
          }

          setChecks([
            {
              label: 'Has viewport meta tag',
              pass: audits.viewport?.score === 1,
            },
            {
              label: 'Legible font sizes',
              pass: audits['font-size']?.score >= 0.9,
              details: audits['font-size']?.displayValue,
            },
            {
              label: 'Appropriately sized tap targets',
              pass: audits['tap-targets']?.score >= 0.9,
            },
            {
              label: 'Content scales correctly to viewport',
              pass: audits['content-width']?.score === 1,
            },
          ]);
          setMethod('pagespeed');
          psiSuccess = true;
        }
      } catch (err) {
        // Silently fail and use fallback
        console.warn('PageSpeed API failed, falling back to manual checks', err);
      }

      // 2. Fallback to manual checking and fetching CSS
      if (!psiSuccess) {
        const r = await apiFetchUrl(url);
        if (r.error) {
          setError(r.error);
          return;
        }

        const html = r.body;
        const lowerHtml = html.toLowerCase();
        const p = parseHtml(html);

        // Extract inline styles
        const inlineStyles: string[] = [];
        for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
          inlineStyles.push(m[1]);
        }

        // Extract external stylesheets
        const links: string[] = [];
        for (const m of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
          const attrMatch = m[0].match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
          const href = attrMatch?.[1] || attrMatch?.[2] || attrMatch?.[3];
          if (href) links.push(href);
        }

        // Fetch up to 3 external stylesheets to avoid hanging
        const finalUrl = r.finalUrl || url;
        const cssFilesToFetch = links
          .slice(0, 3)
          .map((href) => {
            try {
              return new URL(href, finalUrl).href;
            } catch {
              return null;
            }
          })
          .filter(Boolean) as string[];

        const cssContents = await Promise.all(
          cssFilesToFetch.map(async (cssUrl) => {
            try {
              const cssRes = await apiFetchUrl(cssUrl);
              return cssRes.body || '';
            } catch {
              return '';
            }
          })
        );

        const combinedCss = [...inlineStyles, ...cssContents].join('\n').toLowerCase();

        setChecks([
          { label: 'Has viewport meta tag', pass: !!p.viewport },
          {
            label: 'Viewport includes width=device-width',
            pass: /width\s*=\s*device-width/.test(p.viewport.toLowerCase()),
          },
          {
            label: 'Responsive CSS (media queries)',
            pass: /@media/.test(combinedCss) || /@media/.test(lowerHtml),
            details: 'Checked HTML and up to 3 external stylesheets',
          },
          { label: 'No Flash content', pass: !/<object[^>]*flash|\.swf/.test(lowerHtml) },
          {
            label: 'Readable font size (uses rem/em or ≥14px)',
            pass:
              /font-size:\s*(\d{2,})(px|rem|em)/.test(combinedCss) ||
              /font-size:\s*(\d{2,})(px|rem|em)/.test(lowerHtml) ||
              !/font-size/.test(combinedCss),
          },
        ]);
        setMethod('fallback');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const passed = checks.filter((c) => c.pass).length;

  return (
    <ToolShell
      title="Mobile-Friendly Test"
      description="Check if a page is mobile-friendly using Google PageSpeed Insights (with a manual CSS fallback)."
    >
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Testing…' : 'Test'}
        </Button>
      </div>

      {error && (
        <Card className="border-[var(--st-border)]">
          <CardBody className="p-4 text-[var(--st-text)] text-sm">{error}</CardBody>
        </Card>
      )}

      {method === 'pagespeed' && score !== null && (
        <Card>
          <CardBody className="p-4 flex items-center gap-4">
            <div
              className={`text-4xl font-bold ${
                score >= 90 ? 'text-[var(--st-text)]' : score >= 50 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'
              }`}
            >
              {score}
            </div>
            <div>
              <div className="font-semibold text-lg">Mobile SEO Score</div>
              <div className="text-sm text-[var(--st-text-secondary)]">Powered by Google PageSpeed Insights</div>
            </div>
          </CardBody>
        </Card>
      )}

      {method === 'fallback' && checks.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] p-2 rounded-md">
          <Info className="h-4 w-4" />
          <span>Google PageSpeed API unavailable. Used fallback manual CSS extraction.</span>
        </div>
      )}

      {checks.length > 0 && (
        <Card>
          <CardBody className="p-4 space-y-2">
            <div className="text-sm font-semibold">
              Passed: {passed} / {checks.length}
            </div>
            {checks.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                <div className="flex items-center gap-2">
                  {c.pass ? (
                    <Check className="h-4 w-4 text-[var(--st-text)]" />
                  ) : (
                    <X className="h-4 w-4 text-[var(--st-text)]" />
                  )}
                  <span className="font-medium">{c.label}</span>
                </div>
                {c.details && <span className="text-xs text-[var(--st-text-secondary)]">{c.details}</span>}
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
