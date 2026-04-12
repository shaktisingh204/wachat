'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function QualityScorePage() {
  const [ctr, setCtr] = useState(7);
  const [rel, setRel] = useState(7);
  const [lp, setLp] = useState(7);

  const score = useMemo(() => Math.round((ctr * 0.4 + rel * 0.3 + lp * 0.3) * 10) / 10, [ctr, rel, lp]);

  const label = score >= 8 ? 'Great' : score >= 6 ? 'Good' : score >= 4 ? 'Average' : 'Needs work';

  return (
    <ToolShell title="Quality Score Estimator" description="Composite Google Ads quality score from three signals.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1"><Label>Expected CTR (1-10)</Label><Input type="number" min={1} max={10} value={ctr} onChange={(e) => setCtr(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><Label>Ad relevance (1-10)</Label><Input type="number" min={1} max={10} value={rel} onChange={(e) => setRel(Number(e.target.value) || 0)} /></div>
        <div className="space-y-1"><Label>Landing page (1-10)</Label><Input type="number" min={1} max={10} value={lp} onChange={(e) => setLp(Number(e.target.value) || 0)} /></div>
      </div>
      <Card><CardContent className="p-6 text-center">
        <div className="text-6xl font-bold">{score}</div>
        <div className="text-sm text-muted-foreground mt-2">{label}</div>
      </CardContent></Card>
    </ToolShell>
  );
}
