'use client';

import { Card, CardBody, Input, Label, Button } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { fmtINR } from '@/lib/utils';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function AdwordsCpcPage() {
  const [budget, setBudget] = useState<number | string>(100);
  const [cpc, setCpc] = useState<number | string>(0.5);
  const [cvr, setCvr] = useState<number | string>(2);
  const [copied, setCopied] = useState(false);

  const numBudget = Number(budget) || 0;
  const numCpc = Number(cpc) || 0;
  const numCvr = Number(cvr) || 0;

  const { clicks, conversions, cpa } = useMemo(() => {
    const clicks = numCpc > 0 ? numBudget / numCpc : 0;
    const conversions = clicks * (numCvr / 100);
    const cpa = conversions > 0 ? numBudget / conversions : 0;
    return { clicks, conversions, cpa };
  }, [numBudget, numCpc, numCvr]);

  const handleCopy = () => {
const text = `AdWords CPC Estimation:
Budget: ${fmtINR(numBudget)}
CPC: ${fmtINR(numCpc)}
Conversion Rate: ${numCvr}%
---
Estimated Clicks: ${clicks.toFixed(0)}
Estimated Conversions: ${conversions.toFixed(1)}
Estimated Cost Per Acquisition (CPA): ${fmtINR(cpa)}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const csvContent = `Metric,Value
Budget,${numBudget}
CPC,${numCpc}
Conversion Rate (%),${numCvr}
Estimated Clicks,${clicks.toFixed(0)}
Estimated Conversions,${conversions.toFixed(1)}
Estimated CPA,${cpa.toFixed(2)}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'adwords_cpc_estimation.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <ToolShell title="AdWords CPC Calculator" description="Estimate clicks, conversions, and CPA from budget + CPC.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label>Budget (₹)</Label>
          <Input 
            type="number" 
            min="0"
            value={budget} 
            onChange={(e) => setBudget(e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label>CPC (₹)</Label>
          <Input 
            type="number" 
            step="0.01" 
            min="0"
            value={cpc} 
            onChange={(e) => setCpc(e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label>Conversion rate (%)</Label>
          <Input 
            type="number" 
            step="0.1" 
            min="0"
            max="100"
            value={cvr} 
            onChange={(e) => setCvr(e.target.value)} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <Card>
          <CardBody className="p-6">
            <div className="text-3xl font-semibold text-[var(--st-text)]">{clicks.toFixed(0)}</div>
            <div className="text-sm text-[var(--st-text-secondary)] mt-1">Estimated Clicks</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-6">
            <div className="text-3xl font-semibold text-[var(--st-text)]">{conversions.toFixed(1)}</div>
            <div className="text-sm text-[var(--st-text-secondary)] mt-1">Estimated Conversions</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-6">
            <div className="text-3xl font-semibold text-[var(--st-text)]">{fmtINR(cpa)}</div>
            <div className="text-sm text-[var(--st-text-secondary)] mt-1">Cost per acquisition (CPA)</div>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <Button variant="outline" onClick={handleCopy}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? 'Copied' : 'Copy Results'}
        </Button>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </ToolShell>
  );
}
