'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/sabcrm/20ui/compat';
import { Alert, ZoruAlertTitle, ZoruAlertDescription } from '@/components/zoruui/alert';
import { Switch } from '@/components/zoruui/switch';
import { Label } from '@/components/zoruui/label';
import { ZoruChartContainer, ZoruChartTooltip, ZoruChart, ZORU_CHART_PALETTE } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { fmtINR } from '@/lib/utils';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Info, TriangleAlert, Loader2 } from 'lucide-react';
import { getLiveCpcData } from './actions';

const COMMERCIAL = ['buy', 'best', 'price', 'cheap', 'deal', 'discount', 'purchase', 'order', 'shop', 'cost'];

function estimateCpc(kw: string): { low: number; high: number; intent: string } {
  const lc = kw.toLowerCase();
  const words = lc.split(/\s+/).filter(Boolean);
  let intentMultiplier = 0.5;
  let intent = 'Informational';
  for (const c of COMMERCIAL) {
    if (lc.includes(c)) {
      intentMultiplier = 2.5;
      intent = 'Commercial';
      break;
    }
  }
  const lengthFactor = Math.max(0.3, 1 - (words.length - 1) * 0.12);
  const base = 0.8 * intentMultiplier * lengthFactor;
  return {
    low: Math.max(0.05, +(base * 0.6).toFixed(2)),
    high: +(base * 2.2).toFixed(2),
    intent,
  };
}

export default function KeywordCpcPage() {
  const [kw, setKw] = useState('');
  const [useLiveApi, setUseLiveApi] = useState(false);
  const [location, setLocation] = useState('United States');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);
  
  const [heuristicResult, setHeuristicResult] = useState<ReturnType<typeof estimateCpc> | null>(null);
  const [apiResult, setApiResult] = useState<{
    cpc: number | null;
    search_volume: number | null;
    competition: number | null;
    competition_level: string | null;
    monthly_searches?: Array<{year: number, month: number, search_volume: number}>;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = async () => {
    const s = kw.trim();
    if (!s) return;

    setErrorMsg(null);
    setHeuristicResult(null);
    setApiResult(null);

    if (!useLiveApi) {
      setHeuristicResult(estimateCpc(s));
    } else {
      setLoading(true);
      const res = await getLiveCpcData(s, location, language);
      setLoading(false);
      
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.data) {
        setApiResult(res.data);
      }
    }
  };

  return (
    <ToolShell title="Keyword CPC Estimator" description="Estimate cost-per-click range for a keyword based on intent and length heuristics.">
      
      {!useLiveApi && (
        <Alert variant="warning" className="mb-4">
          <TriangleAlert className="h-4 w-4" />
          <ZoruAlertTitle>Simulated Heuristic Mode</ZoruAlertTitle>
          <ZoruAlertDescription>
            You are currently using a simulated heuristic based on commercial intent words and keyword length. 
            For production-grade estimates, please switch to <strong>Live Data API</strong> mode (requires DataForSEO API integration).
          </ZoruAlertDescription>
        </Alert>
      )}

      {useLiveApi && (
        <Alert variant="info" className="mb-4">
          <Info className="h-4 w-4" />
          <ZoruAlertTitle>Live Data API Mode</ZoruAlertTitle>
          <ZoruAlertDescription>
            Using real SERP API (DataForSEO) for production-grade estimates. Ensure your environment variables are configured.
          </ZoruAlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center">
        <div className="flex-1 flex gap-2 w-full">
          <Input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Enter a keyword"
            onKeyDown={(e) => e.key === 'Enter' && run()}
            disabled={loading}
          />
          {useLiveApi && (
            <>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (e.g., United States)"
                disabled={loading}
                className="w-40 hidden md:block"
                title="Location"
              />
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="Language (e.g., English)"
                disabled={loading}
                className="w-32 hidden lg:block"
                title="Language"
              />
            </>
          )}
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Estimate
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Switch 
            id="api-mode-toggle"
            checked={useLiveApi} 
            onCheckedChange={(v) => {
              setUseLiveApi(v);
              // Clear previous results when toggling
              setHeuristicResult(null);
              setApiResult(null);
              setErrorMsg(null);
            }} 
          />
          <Label htmlFor="api-mode-toggle">Live Data API</Label>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="mt-4">
          <TriangleAlert className="h-4 w-4" />
          <ZoruAlertTitle>Error fetching live data</ZoruAlertTitle>
          <ZoruAlertDescription>
            {errorMsg}
          </ZoruAlertDescription>
        </Alert>
      )}

      {heuristicResult && !useLiveApi && (
        <Card className="mt-4">
          <ZoruCardContent className="p-6 space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">${heuristicResult.low}</span>
              <span className="text-zoru-ink-muted">–</span>
              <span className="text-4xl font-bold">${heuristicResult.high}</span>
            </div>
            <div className="text-sm">
              <span className="text-zoru-ink-muted">Intent: </span>
              <span className="font-medium">{heuristicResult.intent}</span>
            </div>
            <p className="text-xs text-zoru-ink-muted">
              Heuristic estimate based on commercial intent words and keyword length. Switch to Live Data API for precise numbers.
            </p>
          </ZoruCardContent>
        </Card>
      )}

      {apiResult && useLiveApi && (
        <Card className="mt-4">
          <ZoruCardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-zoru-ink-muted mb-1">Average CPC</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{apiResult.cpc != null ? fmtINR(apiResult.cpc, 'USD') : fmtINR(0, 'USD')}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-zoru-ink-muted mb-1">Search Volume</p>
                <span className="text-2xl font-semibold">{apiResult.search_volume?.toLocaleString() ?? 'N/A'}</span>
              </div>
              <div>
                <p className="text-sm text-zoru-ink-muted mb-1">Competition Level</p>
                <span className="text-lg font-medium capitalize">{apiResult.competition_level?.toLowerCase() ?? 'Unknown'}</span>
              </div>
              <div>
                <p className="text-sm text-zoru-ink-muted mb-1">Competition Index</p>
                <span className="text-lg font-medium">{apiResult.competition ?? 'N/A'}</span>
              </div>
            </div>
            <p className="text-xs text-zoru-ink-muted mt-4 border-t pt-4">
              Production-grade estimate retrieved via DataForSEO Live API.
            </p>
          </ZoruCardContent>
        </Card>
      )}

      {apiResult && useLiveApi && apiResult.monthly_searches && apiResult.monthly_searches.length > 0 && (
        <Card className="mt-4">
          <ZoruCardContent className="p-6">
            <h4 className="text-sm font-semibold mb-4">Monthly Search Volume Trend</h4>
            <ZoruChartContainer height={300}>
              <ZoruChart.ResponsiveContainer>
                <ZoruChart.AreaChart
                  data={apiResult.monthly_searches.map(m => ({
                    date: `${m.month}/${m.year}`,
                    volume: m.search_volume
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--zoru-line))" />
                  <ZoruChart.XAxis 
                    dataKey="date" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--zoru-ink-muted))' }}
                    dy={10}
                  />
                  <ZoruChart.YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--zoru-ink-muted))' }}
                  />
                  <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                  <ZoruChart.Area
                    type="monotone"
                    dataKey="volume"
                    name="Search Volume"
                    stroke={ZORU_CHART_PALETTE[0]}
                    fill={ZORU_CHART_PALETTE[0]}
                    fillOpacity={0.1}
                  />
                </ZoruChart.AreaChart>
              </ZoruChart.ResponsiveContainer>
            </ZoruChartContainer>
          </ZoruCardContent>
        </Card>
      )}

    </ToolShell>
  );
}
