'use client';

import { Card, ZoruCardContent, Input, Label } from '@/components/zoruui';
import { useMemo, useState } from 'react';

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
        <div className="space-y-1"><ZoruLabel>Budget</ZoruLabel><ZoruInput type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><ZoruLabel>CPC</ZoruLabel><ZoruInput type="number" step="0.01" value={cpc} onChange={(e) => setCpc(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><ZoruLabel>Conversion rate %</ZoruLabel><ZoruInput type="number" step="0.1" value={cvr} onChange={(e) => setCvr(Number(e.target.value) || 0)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl text-zoru-ink">{clicks.toFixed(0)}</div><div className="text-xs text-zoru-ink-muted">Clicks</div></ZoruCardContent></ZoruCard>
        <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl text-zoru-ink">{conversions.toFixed(1)}</div><div className="text-xs text-zoru-ink-muted">Conversions</div></ZoruCardContent></ZoruCard>
        <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl text-zoru-ink">${cpa.toFixed(2)}</div><div className="text-xs text-zoru-ink-muted">Cost per acquisition</div></ZoruCardContent></ZoruCard>
      </div>
    </ToolShell>
  );
}
