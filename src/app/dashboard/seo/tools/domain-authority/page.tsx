'use client';

import { Button, Input, Card, CardBody, cn, Progress } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';
import { Loader2, Copy, Download, AlertCircle, ExternalLink, ShieldAlert, Link as LinkIcon, Activity } from 'lucide-react';
import { useToast } from '@/components/sabcrm/20ui/compat';

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export default function DomainAuthorityPage() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<{
    da: number;
    pa: number;
    backlinks: number;
    linkingDomains: number;
    spamScore: number;
    trustFlow: number;
    checkedUrl: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const run = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    let targetUrl = domain.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      // Use apiFetchUrl proxy to bypass CORS
      const r = await apiFetchUrl(targetUrl);
      if (r.error) {
        throw new Error(r.error);
      }

      // Generate deterministic placeholders based on the reachable domain
      const h = hash(targetUrl);
      
      const da = (h % 70) + 20; // 20 to 89
      const pa = Math.max(10, da - (h % 15));
      const backlinks = (h % 500000) + 1000;
      const linkingDomains = Math.floor(backlinks / ((h % 20) + 2));
      const spamScore = h % 100 < 80 ? (h % 5) : (h % 30) + 5; // Mostly low, sometimes high
      const trustFlow = Math.max(10, da - (h % 25));

      setResult({
        da,
        pa,
        backlinks,
        linkingDomains,
        spamScore,
        trustFlow,
        checkedUrl: targetUrl,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to check domain authority. Please ensure the domain is accessible.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `URL: ${result.checkedUrl}\nDomain Authority: ${result.da}\nPage Authority: ${result.pa}\nEst. Backlinks: ${result.backlinks.toLocaleString()}\nLinking Domains: ${result.linkingDomains.toLocaleString()}\nSpam Score: ${result.spamScore}%\nTrust Flow: ${result.trustFlow}`;
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Domain authority metrics have been copied.",
    });
  };

  const exportCSV = () => {
    if (!result) return;
    const csvContent = `URL,Domain Authority,Page Authority,Est. Backlinks,Linking Domains,Spam Score,Trust Flow\n"${result.checkedUrl}",${result.da},${result.pa},${result.backlinks},${result.linkingDomains},${result.spamScore},${result.trustFlow}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `domain_authority_${domain.replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Successful",
      description: "Your CSV file is downloading.",
    });
  };

  const getColorByScore = (score: number, inverse = false) => {
    if (inverse) {
      if (score < 10) return "text-[var(--st-text)]";
      if (score < 30) return "text-[var(--st-text)]";
      return "text-[var(--st-text)]";
    }
    if (score >= 60) return "text-[var(--st-text)]";
    if (score >= 30) return "text-[var(--st-text)]";
    return "text-[var(--st-text)]";
  };

  const getProgressColor = (score: number, inverse = false) => {
    if (inverse) {
      if (score < 10) return "bg-[var(--st-text)]";
      if (score < 30) return "bg-[var(--st-text)]";
      return "bg-[var(--st-text)]";
    }
    if (score >= 60) return "bg-[var(--st-text)]";
    if (score >= 30) return "bg-[var(--st-text)]";
    return "bg-[var(--st-text)]";
  };

  return (
    <ToolShell title="Domain Authority Checker" description="Comprehensive DA/PA metrics and link profile analysis.">
      <Card className="border-[var(--st-border)] bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/30 mb-6">
        <CardBody className="p-4 text-sm flex items-start gap-3 text-[var(--st-text)] dark:text-white">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            <strong>Note:</strong> Production Domain Authority and Page Authority require Moz or Ahrefs API credentials. 
            The values shown here are deterministic placeholders for demonstration purposes. This tool utilizes a backend proxy to verify domain accessibility and CORS before calculation.
          </p>
        </CardBody>
      </Card>
      
      <div className="flex gap-2 mb-8">
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Enter a domain (e.g. example.com)"
          className="max-w-md text-lg px-4 py-6"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={loading} size="lg" className="px-8 h-auto">
          {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Activity className="mr-2 h-5 w-5" />}
          Analyze
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 text-sm text-[var(--st-text)] bg-[var(--st-text)]/10 border border-destructive/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--st-bg-muted)]/30 p-4 rounded-lg border">
            <div className="flex items-center gap-2 overflow-hidden w-full">
              <ExternalLink className="h-5 w-5 text-[var(--st-text-secondary)] shrink-0" />
              <span className="font-medium truncate text-lg">{result.checkedUrl}</span>
            </div>
            <div className="flex shrink-0 gap-2 w-full sm:w-auto">
              <Button variant="secondary" size="sm" onClick={copyToClipboard} className="flex-1 sm:flex-none">
                <Copy className="h-4 w-4 mr-2" /> Copy
              </Button>
              <Button variant="secondary" size="sm" onClick={exportCSV} className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="overflow-hidden">
              <CardBody className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-sm font-medium text-[var(--st-text-secondary)]">Domain Authority</div>
                  <Activity className="h-4 w-4 text-[var(--st-text-secondary)]" />
                </div>
                <div className={cn("text-4xl font-bold tracking-tight mb-2", getColorByScore(result.da))}>
                  {result.da}
                  <span className="text-lg font-normal text-[var(--st-text-secondary)]">/100</span>
                </div>
                <Progress value={result.da} indicatorClassName={getProgressColor(result.da)} className="h-2" />
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardBody className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-sm font-medium text-[var(--st-text-secondary)]">Page Authority</div>
                  <Activity className="h-4 w-4 text-[var(--st-text-secondary)]" />
                </div>
                <div className={cn("text-4xl font-bold tracking-tight mb-2", getColorByScore(result.pa))}>
                  {result.pa}
                  <span className="text-lg font-normal text-[var(--st-text-secondary)]">/100</span>
                </div>
                <Progress value={result.pa} indicatorClassName={getProgressColor(result.pa)} className="h-2" />
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardBody className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-sm font-medium text-[var(--st-text-secondary)]">Trust Flow</div>
                  <ShieldAlert className="h-4 w-4 text-[var(--st-text-secondary)]" />
                </div>
                <div className={cn("text-4xl font-bold tracking-tight mb-2", getColorByScore(result.trustFlow))}>
                  {result.trustFlow}
                  <span className="text-lg font-normal text-[var(--st-text-secondary)]">/100</span>
                </div>
                <Progress value={result.trustFlow} indicatorClassName={getProgressColor(result.trustFlow)} className="h-2" />
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardBody className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-sm font-medium text-[var(--st-text-secondary)]">Spam Score</div>
                  <ShieldAlert className="h-4 w-4 text-[var(--st-text-secondary)]" />
                </div>
                <div className={cn("text-4xl font-bold tracking-tight mb-2", getColorByScore(result.spamScore, true))}>
                  {result.spamScore}%
                </div>
                <Progress value={result.spamScore} indicatorClassName={getProgressColor(result.spamScore, true)} className="h-2" />
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardBody className="p-6 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--st-text-secondary)] mb-1">Total Backlinks</div>
                  <div className="text-3xl font-bold">{result.backlinks.toLocaleString()}</div>
                </div>
                <div className="p-4 bg-[var(--st-text)]/10 rounded-full">
                  <LinkIcon className="h-6 w-6 text-[var(--st-text)]" />
                </div>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody className="p-6 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--st-text-secondary)] mb-1">Linking Domains</div>
                  <div className="text-3xl font-bold">{result.linkingDomains.toLocaleString()}</div>
                </div>
                <div className="p-4 bg-[var(--st-text)]/10 rounded-full">
                  <Activity className="h-6 w-6 text-[var(--st-text)]" />
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
