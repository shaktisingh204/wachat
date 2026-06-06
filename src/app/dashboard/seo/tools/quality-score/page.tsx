'use client';

import { Input, Label, Card, CardBody, cn, Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, Button, Table, THead, TBody, Tr, Th, Td, CardHeader, CardTitle, CardDescription } from '@/components/sabcrm/20ui';
import { useMemo, useState, useEffect } from 'react';
import { Info, Save, History, TrendingUp, MousePointerClick, Target, LayoutDashboard } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { fmtDate } from '@/lib/utils';

interface HistoryItem {
  id: string;
  campaign: string;
  date: string;
  ctr: number;
  rel: number;
  lp: number;
  score: number;
}

export default function QualityScorePage() {
  const [campaignName, setCampaignName] = useState('');
  const [ctrRaw, setCtr] = useState<number | string>(7);
  const [relRaw, setRel] = useState<number | string>(7);
  const [lpRaw, setLp] = useState<number | string>(7);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('sabnode_qs_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('sabnode_qs_history', JSON.stringify(history));
    }
  }, [history, mounted]);

  // Safely parse and clamp
  const clamp = (val: number | string) => Math.min(10, Math.max(1, Number(val) || 1));
  const ctr = clamp(ctrRaw);
  const rel = clamp(relRaw);
  const lp = clamp(lpRaw);

  const score = useMemo(() => Math.round((ctr * 0.4 + rel * 0.3 + lp * 0.3) * 10) / 10, [ctr, rel, lp]);

  const label = score >= 8 ? 'Great' : score >= 6 ? 'Good' : score >= 4 ? 'Average' : 'Needs work';

  const handleSave = () => {
    if (!campaignName.trim()) return;
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      campaign: campaignName,
      date: fmtDate(new Date()),
      ctr, rel, lp, score
    };
    setHistory(prev => [newItem, ...prev]);
    setCampaignName('');
  };

  const getCTRSuggestion = (val: number) => {
    if (val <= 4) return "Your expected CTR is below average. Try testing different ad copy, adding strong calls to action, or ensuring your ads closely match user intent.";
    if (val <= 7) return "Your expected CTR is average. Refine ad extensions, and test specific benefits in your headlines.";
    return "Your expected CTR is excellent. Keep it up!";
  };
  const getRelSuggestion = (val: number) => {
    if (val <= 4) return "Ad relevance is low. Ensure your ad text contains the exact keywords you are bidding on, and use tighter ad groups.";
    if (val <= 7) return "Ad relevance is average. Consider breaking out broader ad groups into specific themes.";
    return "Ad relevance is high. Your keywords match your ad text well.";
  };
  const getLPSuggestion = (val: number) => {
    if (val <= 4) return "Landing page experience needs work. Improve page load speed, mobile-friendliness, and ensure the content directly answers the user's query.";
    if (val <= 7) return "Landing page experience is average. Clear up navigation and ensure a seamless path to conversion.";
    return "Landing page experience is great. Users find your page highly relevant and easy to use.";
  };

  return (
    <TooltipProvider>
      <ToolShell title="Quality Score Estimator" description="Composite Google Ads quality score from three signals. Evaluate expected CTR, ad relevance, and landing page experience.">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Score Signals</CardTitle>
                <CardDescription>Adjust the metrics below (1-10) to see how they affect your overall Quality Score.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-6">
                {/* CTR Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <MousePointerClick className="w-4 h-4 text-[var(--st-text)]" />
                      Expected CTR
                      <Tooltip>
                        <TooltipTrigger type="button" tabIndex={-1}>
                          <Info className="w-4 h-4 text-[var(--st-text-secondary)] cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>How likely your ad is to be clicked when shown. Heavily weighted (40%). Improve by testing ad copy.</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <span className="font-semibold">{ctr}/10</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min={1} max={10} step={1} 
                      value={ctr} onChange={(e) => setCtr(e.target.value)}
                      className="w-full accent-[var(--st-text)] h-2 bg-[var(--st-bg-muted)] rounded-lg appearance-none cursor-pointer"
                    />
                    <Input 
                      type="number" min={1} max={10} 
                      value={ctrRaw} 
                      onChange={(e) => setCtr(e.target.value)}
                      onBlur={() => setCtr(ctr)}
                      className="w-20"
                    />
                  </div>
                </div>

                {/* Ad Relevance Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[var(--st-text)]" />
                      Ad relevance
                      <Tooltip>
                        <TooltipTrigger type="button" tabIndex={-1}>
                          <Info className="w-4 h-4 text-[var(--st-text-secondary)] cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>How closely your ad matches the intent behind a user's search (30%). Improve with tighter ad groups.</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <span className="font-semibold">{rel}/10</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min={1} max={10} step={1} 
                      value={rel} onChange={(e) => setRel(e.target.value)}
                      className="w-full accent-[var(--st-text)] h-2 bg-[var(--st-bg-muted)] rounded-lg appearance-none cursor-pointer"
                    />
                    <Input 
                      type="number" min={1} max={10} 
                      value={relRaw} 
                      onChange={(e) => setRel(e.target.value)}
                      onBlur={() => setRel(rel)}
                      className="w-20"
                    />
                  </div>
                </div>

                {/* Landing Page Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-[var(--st-text)]" />
                      Landing page
                      <Tooltip>
                        <TooltipTrigger type="button" tabIndex={-1}>
                          <Info className="w-4 h-4 text-[var(--st-text-secondary)] cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>How relevant and useful your website's landing page is (30%). Improve by optimizing page speed and relevance.</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <span className="font-semibold">{lp}/10</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min={1} max={10} step={1} 
                      value={lp} onChange={(e) => setLp(e.target.value)}
                      className="w-full accent-[var(--st-text)] h-2 bg-[var(--st-bg-muted)] rounded-lg appearance-none cursor-pointer"
                    />
                    <Input 
                      type="number" min={1} max={10} 
                      value={lpRaw} 
                      onChange={(e) => setLp(e.target.value)}
                      onBlur={() => setLp(lp)}
                      className="w-20"
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Save Campaign</CardTitle>
                <CardDescription>Record this score configuration for future reference.</CardDescription>
              </CardHeader>
              <CardBody className="flex gap-3">
                <Input 
                  placeholder="Campaign name..." 
                  value={campaignName} 
                  onChange={(e) => setCampaignName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <Button onClick={handleSave} disabled={!campaignName.trim()}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="h-full flex flex-col justify-center">
              <CardBody className="p-8 text-center space-y-4">
                <div className="text-[var(--st-text-secondary)] font-medium uppercase tracking-widest text-sm">Estimated Quality Score</div>
                <div className={cn(
                  "text-8xl font-black",
                  score >= 8 ? "text-[var(--st-text)]" : score >= 6 ? "text-[var(--st-text)]" : "text-[var(--st-text)]"
                )}>
                  {score.toFixed(1)}
                </div>
                <div className={cn(
                  "inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold",
                  score >= 8 ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]" : 
                  score >= 6 ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]" : 
                  "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]"
                )}>
                  {label}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[var(--st-text)]" /> 
                  Improvement Suggestions
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="w-1.5 rounded-full bg-[var(--st-text)] shrink-0" />
                  <div>
                    <span className="font-semibold block mb-0.5">Expected CTR:</span>
                    <span className="text-[var(--st-text-secondary)]">{getCTRSuggestion(ctr)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 rounded-full bg-[var(--st-text)] shrink-0" />
                  <div>
                    <span className="font-semibold block mb-0.5">Ad Relevance:</span>
                    <span className="text-[var(--st-text-secondary)]">{getRelSuggestion(rel)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 rounded-full bg-[var(--st-text)] shrink-0" />
                  <div>
                    <span className="font-semibold block mb-0.5">Landing Page:</span>
                    <span className="text-[var(--st-text-secondary)]">{getLPSuggestion(lp)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {mounted && history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" /> History
              </CardTitle>
              <CardDescription>Previously saved campaign estimates.</CardDescription>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Campaign</Th>
                      <Th>Date</Th>
                      <Th className="text-right">Exp. CTR</Th>
                      <Th className="text-right">Ad Rel.</Th>
                      <Th className="text-right">Land. Page</Th>
                      <Th className="text-right">Score</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {history.map((h) => (
                      <Tr key={h.id}>
                        <Td className="font-medium">{h.campaign}</Td>
                        <Td className="text-[var(--st-text-secondary)]">{h.date}</Td>
                        <Td className="text-right">{h.ctr}</Td>
                        <Td className="text-right">{h.rel}</Td>
                        <Td className="text-right">{h.lp}</Td>
                        <Td className="text-right font-bold text-[var(--st-text)]">{h.score.toFixed(1)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </CardBody>
          </Card>
        )}

      </ToolShell>
    </TooltipProvider>
  );
}
