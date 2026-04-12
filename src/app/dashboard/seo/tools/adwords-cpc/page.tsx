'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function AdwordsCpcPage() {
  const [budget, setBudget] = useState(100);
  const [cpc, setCpc] = useState(0.5);
  const [cvr, setCvr] = useState(2);

  const { clicks, conversions, cpa } = useMemo(() => {
    const clicks = cpc > 0 ? budget / cpc : 0;
    const conversions = clicks * (cvr / 100);
    const cpa = conversions > 0 ? budget / conversions : 0;
    return { clicks, conversions, cpa };
  }, [budget, cpc, cvr]);

  return (
    <ToolShell title="AdWords CPC Calculator" description="Estimate clicks, conversions, and CPA from budget + CPC.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1"><Label>Budget</Label><Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><Label>CPC</Label><Input type="number" step="0.01" value={cpc} onChange={(e) => setCpc(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><Label>Conversion rate %</Label><Input type="number" step="0.1" value={cvr} onChange={(e) => setCvr(Number(e.target.value) || 0)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{clicks.toFixed(0)}</div><div className="text-xs text-muted-foreground">Clicks</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{conversions.toFixed(1)}</div><div className="text-xs text-muted-foreground">Conversions</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">${cpa.toFixed(2)}</div><div className="text-xs text-muted-foreground">Cost per acquisition</div></CardContent></Card>
      </div>
    </ToolShell>
  );
}
