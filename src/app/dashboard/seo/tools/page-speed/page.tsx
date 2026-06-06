'use client';

import { 
  Button, 
  Input, 
  Card, 
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem,
  Accordion,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruAccordionContent,
  Badge,
  cn 
} from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

interface AuditDetails {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
  details?: {
    type: string;
    items?: any[];
  };
}

interface CoreWebVitals {
  performanceScore: number;
  lcp: string;
  fid: string;
  cls: string;
  ttfb: string;
  fcp: string;
  tbt: string;
  speedIndex: string;
  opportunities: AuditDetails[];
}

export default function PageSpeedPage() {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [strategy, setStrategy] = useState<'desktop' | 'mobile'>('desktop');
  const [data, setData] = useState<CoreWebVitals | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!url) return;
    
    let targetUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      targetUrl = 'https://' + url;
    }

    setIsLoading(true);
    setError('');
    setData(null);

    try {
      let fetchUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=${strategy}`;
      if (apiKey) {
        fetchUrl += `&key=${encodeURIComponent(apiKey)}`;
      }
      
      const response = await fetch(fetchUrl);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error?.message || 'Failed to fetch data');
      }
      
      const lighthouseResult = json.lighthouseResult;
      if (!lighthouseResult) {
        throw new Error('No Lighthouse result available');
      }

      const audits = lighthouseResult.audits;
      
      const opportunities = Object.values(audits).filter(
        (audit: any) => audit.details?.type === 'opportunity' && audit.score !== null && audit.score < 1
      ) as AuditDetails[];

      setData({
        performanceScore: Math.round(lighthouseResult.categories.performance.score * 100),
        lcp: audits['largest-contentful-paint']?.displayValue || 'N/A',
        fid: audits['max-potential-fid']?.displayValue || 'N/A',
        cls: audits['cumulative-layout-shift']?.displayValue || 'N/A',
        ttfb: audits['server-response-time']?.displayValue || 'N/A',
        fcp: audits['first-contentful-paint']?.displayValue || 'N/A',
        tbt: audits['total-blocking-time']?.displayValue || 'N/A',
        speedIndex: audits['speed-index']?.displayValue || 'N/A',
        opportunities
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-zoru-ink dark:text-zoru-ink-muted';
    if (score >= 50) return 'text-zoru-ink dark:text-zoru-ink-muted';
    return 'text-zoru-ink dark:text-zoru-ink-muted';
  };

  return (
    <ToolShell title="Page Speed Insights" description="Analyze page speed and Core Web Vitals with real Google PSI data.">
      <Card className="border-zoru-line bg-zoru-surface dark:bg-zoru-surface">
        <ZoruCardContent className="p-3 text-xs text-zoru-ink-muted">
          For production use, provide a Google PageSpeed Insights API key to avoid rate limits. Without a key, requests may be limited.
        </ZoruCardContent>
      </Card>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Input 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          placeholder="https://example.com" 
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Select value={strategy} onValueChange={(v: 'desktop' | 'mobile') => setStrategy(v)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Strategy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
        <Input 
          value={apiKey} 
          onChange={(e) => setApiKey(e.target.value)} 
          placeholder="API Key (Optional)" 
          className="w-full sm:w-[200px]"
          type="password"
        />
        <Button onClick={run} disabled={isLoading || !url} className="w-full sm:w-auto">
          {isLoading ? 'Analyzing...' : 'Measure'}
        </Button>
      </div>

      {error && (
        <Card className="border-zoru-line bg-zoru-surface-2 dark:bg-zoru-ink/30">
          <ZoruCardContent className="p-3 text-sm text-zoru-ink dark:text-zoru-ink-muted">
            {error}
          </ZoruCardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-6 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="col-span-2 md:col-span-4 border-zoru-line flex flex-col items-center justify-center p-6">
              <div className="text-sm font-medium text-zoru-ink-muted mb-2">Performance Score</div>
              <div className={cn("text-6xl font-black", getScoreColor(data.performanceScore))}>
                {data.performanceScore}
              </div>
            </Card>
            <MetricCard title="LCP (Largest Contentful Paint)" value={data.lcp} />
            <MetricCard title="FID (Max Potential)" value={data.fid} />
            <MetricCard title="CLS (Cumulative Layout Shift)" value={data.cls} />
            <MetricCard title="TTFB (Server Response)" value={data.ttfb} />
            <MetricCard title="FCP (First Contentful Paint)" value={data.fcp} />
            <MetricCard title="TBT (Total Blocking Time)" value={data.tbt} />
            <MetricCard title="Speed Index" value={data.speedIndex} />
          </div>
          
          {data.opportunities.length > 0 && (
            <Card className="border-zoru-line">
              <ZoruCardHeader>
                <ZoruCardTitle className="text-lg">Opportunities to Improve</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent>
                <Accordion type="single" collapsible className="w-full">
                  {data.opportunities.map((opp) => (
                    <ZoruAccordionItem key={opp.id} value={opp.id}>
                      <ZoruAccordionTrigger className="text-left font-medium">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            (opp.score !== null && opp.score < 0.5) ? 'bg-zoru-ink' : 'bg-zoru-ink'
                          )} />
                          {opp.title}
                          {opp.displayValue && (
                            <Badge variant="outline" className="ml-2 font-mono text-xs">{opp.displayValue}</Badge>
                          )}
                        </div>
                      </ZoruAccordionTrigger>
                      <ZoruAccordionContent className="text-sm text-zoru-ink-muted leading-relaxed">
                        <div dangerouslySetInnerHTML={{ __html: formatDescription(opp.description) }} />
                      </ZoruAccordionContent>
                    </ZoruAccordionItem>
                  ))}
                </Accordion>
              </ZoruCardContent>
            </Card>
          )}
        </div>
      )}
    </ToolShell>
  );
}

function MetricCard({ title, value }: { title: string, value: string }) {
  return (
    <Card className="border-zoru-line">
      <ZoruCardContent className="p-4 flex flex-col justify-between h-full">
        <div className="text-2xl font-bold text-zoru-ink break-words">{value}</div>
        <div className="text-xs text-zoru-ink-muted mt-2">{title}</div>
      </ZoruCardContent>
    </Card>
  );
}

function formatDescription(desc: string) {
  // Simple markdown link replacement to HTML
  return desc.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-zoru-ink hover:underline">$1</a>');
}
