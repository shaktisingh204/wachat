'use client';

import { Button, Input, Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import { ToolShell } from '@/components/seo-tools/tool-shell';

import { getKeywordTrends } from './actions';

export default function KeywordTrendsPage() {
  const [kw, setKw] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<{ month: string; interest: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    if (!kw) return;
    setSubmitted(kw);
    setIsLoading(true);
    setError(null);
    try {
      const res = await getKeywordTrends(kw);
      if (res.error) {
        setError(res.error);
        setData([]);
      } else {
        const chartData = (res.data || []).map((val: number, idx: number) => ({
          month: res.months?.[idx] || '',
          interest: val,
        }));
        setData(chartData);
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ToolShell title="Keyword Trends" description="12-month global interest trend for a keyword using Google Trends.">
      <div className="flex gap-2 mb-4">
        <Input 
          value={kw} 
          onChange={(e) => setKw(e.target.value)} 
          onKeyDown={(e) => { if (e.key === 'Enter') fetchTrends(); }}
          placeholder="e.g. ai tools" 
        />
        <Button onClick={fetchTrends} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Show trend'}
        </Button>
      </div>
      {error && <div className="text-zoru-ink mb-4">{error}</div>}
      {submitted && data.length > 0 && !isLoading && !error && (
        <Card>
          <ZoruCardContent className="p-4">
            <div className="text-lg font-semibold mb-6">Trend for "{submitted}"</div>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickMargin={10} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="interest" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
