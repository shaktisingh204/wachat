'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function CtrCalculatorPage() {
  const [imp, setImp] = useState(10000);
  const [clicks, setClicks] = useState(250);
  const [conversions, setConversions] = useState(12);
  const [cost, setCost] = useState(100);

  const r = useMemo(() => ({
    ctr: imp ? (clicks / imp) * 100 : 0,
    cpc: clicks ? cost / clicks : 0,
    cvr: clicks ? (conversions / clicks) * 100 : 0,
    cpa: conversions ? cost / conversions : 0,
    cpm: imp ? (cost / imp) * 1000 : 0,
  }), [imp, clicks, conversions, cost]);

  return (
    <ToolShell title="CTR / CPC / CVR Calculator" description="Compute CTR, CPC, CVR, CPA and CPM from your campaign numbers.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1"><Label>Impressions</Label><Input type="number" value={imp} onChange={(e) => setImp(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><Label>Clicks</Label><Input type="number" value={clicks} onChange={(e) => setClicks(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><Label>Conversions</Label><Input type="number" value={conversions} onChange={(e) => setConversions(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><Label>Cost</Label><Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} /></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{r.ctr.toFixed(2)}%</div><div className="text-xs text-muted-foreground">CTR</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">${r.cpc.toFixed(2)}</div><div className="text-xs text-muted-foreground">CPC</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{r.cvr.toFixed(2)}%</div><div className="text-xs text-muted-foreground">CVR</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">${r.cpa.toFixed(2)}</div><div className="text-xs text-muted-foreground">CPA</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">${r.cpm.toFixed(2)}</div><div className="text-xs text-muted-foreground">CPM</div></CardContent></Card>
      </div>
    </ToolShell>
  );
}
