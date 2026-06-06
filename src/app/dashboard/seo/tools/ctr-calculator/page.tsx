'use client';

import { Input, Label, Card, ZoruCardContent, Button, cn } from '@/components/sabcrm/20ui/compat';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';
import { Copy, Download } from 'lucide-react';
import React, { useMemo, useState } from 'react';

void cn;

import { ToolShell } from '@/components/seo-tools/tool-shell';


function CalculatorContent() {
  const [imp, setImp] = useState(10000);
  const [clicks, setClicks] = useState(250);
  const [conversions, setConversions] = useState(12);
  const [cost, setCost] = useState(100);

  const { toast } = useZoruToast();

  const r = useMemo(() => ({
    ctr: imp ? (clicks / imp) * 100 : 0,
    cpc: clicks ? cost / clicks : 0,
    cvr: clicks ? (conversions / clicks) * 100 : 0,
    cpa: conversions ? cost / conversions : 0,
    cpm: imp ? (cost / imp) * 1000 : 0,
  }), [imp, clicks, conversions, cost]);

  const handleCopy = async () => {
    try {
      const text = `Impressions: ${imp}
Clicks: ${clicks}
Conversions: ${conversions}
Cost: $${cost}
---
CTR: ${r.ctr.toFixed(2)}%
CPC: $${r.cpc.toFixed(2)}
CVR: ${r.cvr.toFixed(2)}%
CPA: $${r.cpa.toFixed(2)}
CPM: $${r.cpm.toFixed(2)}`;
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard!', description: 'Metrics have been copied to your clipboard.' });
    } catch (e) {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.' });
    }
  };

  const handleExportCSV = () => {
    try {
      const rows = [
        ['Metric', 'Value'],
        ['Impressions', imp],
        ['Clicks', clicks],
        ['Conversions', conversions],
        ['Cost', cost],
        ['CTR (%)', r.ctr.toFixed(2)],
        ['CPC ($)', r.cpc.toFixed(2)],
        ['CVR (%)', r.cvr.toFixed(2)],
        ['CPA ($)', r.cpa.toFixed(2)],
        ['CPM ($)', r.cpm.toFixed(2)],
      ];
      const csvContent = rows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'ctr-calculator-results.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Exported', description: 'CSV file has been downloaded.' });
    } catch (e) {
      toast({ title: 'Export failed', description: 'Could not export to CSV.' });
    }
  };

  return (
    <ToolShell title="CTR / CPC / CVR Calculator" description="Compute CTR, CPC, CVR, CPA and CPM from your campaign numbers.">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1"><Label>Impressions</Label><Input type="number" min="0" value={imp} onChange={(e) => setImp(Number(e.target.value) || 0)} /></div>
          <div className="space-y-1"><Label>Clicks</Label><Input type="number" min="0" value={clicks} onChange={(e) => setClicks(Number(e.target.value) || 0)} /></div>
          <div className="space-y-1"><Label>Conversions</Label><Input type="number" min="0" value={conversions} onChange={(e) => setConversions(Number(e.target.value) || 0)} /></div>
          <div className="space-y-1"><Label>Cost</Label><Input type="number" min="0" value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} /></div>
        </div>

        <div className="flex justify-between items-center mt-2">
          <h3 className="text-lg font-semibold">Results</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{r.ctr.toFixed(2)}%</div><div className="text-xs text-zoru-ink-muted">CTR</div></ZoruCardContent></Card>
          <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">${r.cpc.toFixed(2)}</div><div className="text-xs text-zoru-ink-muted">CPC</div></ZoruCardContent></Card>
          <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{r.cvr.toFixed(2)}%</div><div className="text-xs text-zoru-ink-muted">CVR</div></ZoruCardContent></Card>
          <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">${r.cpa.toFixed(2)}</div><div className="text-xs text-zoru-ink-muted">CPA</div></ZoruCardContent></Card>
          <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">${r.cpm.toFixed(2)}</div><div className="text-xs text-zoru-ink-muted">CPM</div></ZoruCardContent></Card>
        </div>
      </div>
    </ToolShell>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("CTR Calculator Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-zoru-line bg-zoru-surface-2 text-zoru-ink rounded-md">
          <h2 className="text-lg font-bold">Something went wrong.</h2>
          <p className="text-sm">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CtrCalculatorPage() {
  return (
    <ErrorBoundary>
      <CalculatorContent />
    </ErrorBoundary>
  );
}
