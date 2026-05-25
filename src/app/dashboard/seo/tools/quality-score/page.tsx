'use client';

import { 
  Input, Label, Card, ZoruCardContent, cn,
  Tooltip, ZoruTooltipProvider, ZoruTooltipTrigger, ZoruTooltipContent,
  Button,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  ZoruCardHeader, ZoruCardTitle, ZoruCardDescription
} from '@/components/zoruui';
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
    <ZoruTooltipProvider>
      <ToolShell title="Quality Score Estimator" description="Composite Google Ads quality score from three signals. Evaluate expected CTR, ad relevance, and landing page experience.">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="space-y-6">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Score Signals</ZoruCardTitle>
                <ZoruCardDescription>Adjust the metrics below (1-10) to see how they affect your overall Quality Score.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-6">
                {/* CTR Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <MousePointerClick className="w-4 h-4 text-blue-500" />
                      Expected CTR
                      <Tooltip>
                        <ZoruTooltipTrigger type="button" tabIndex={-1}>
                          <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                        </ZoruTooltipTrigger>
                        <ZoruTooltipContent className="max-w-xs">
                          <p>How likely your ad is to be clicked when shown. Heavily weighted (40%). Improve by testing ad copy.</p>
                        </ZoruTooltipContent>
                      </Tooltip>
                    </Label>
                    <span className="font-semibold">{ctr}/10</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min={1} max={10} step={1} 
                      value={ctr} onChange={(e) => setCtr(e.target.value)}
                      className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
                      <Target className="w-4 h-4 text-purple-500" />
                      Ad relevance
                      <Tooltip>
                        <ZoruTooltipTrigger type="button" tabIndex={-1}>
                          <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                        </ZoruTooltipTrigger>
                        <ZoruTooltipContent className="max-w-xs">
                          <p>How closely your ad matches the intent behind a user's search (30%). Improve with tighter ad groups.</p>
                        </ZoruTooltipContent>
                      </Tooltip>
                    </Label>
                    <span className="font-semibold">{rel}/10</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min={1} max={10} step={1} 
                      value={rel} onChange={(e) => setRel(e.target.value)}
                      className="w-full accent-purple-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
                      <LayoutDashboard className="w-4 h-4 text-emerald-500" />
                      Landing page
                      <Tooltip>
                        <ZoruTooltipTrigger type="button" tabIndex={-1}>
                          <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                        </ZoruTooltipTrigger>
                        <ZoruTooltipContent className="max-w-xs">
                          <p>How relevant and useful your website's landing page is (30%). Improve by optimizing page speed and relevance.</p>
                        </ZoruTooltipContent>
                      </Tooltip>
                    </Label>
                    <span className="font-semibold">{lp}/10</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min={1} max={10} step={1} 
                      value={lp} onChange={(e) => setLp(e.target.value)}
                      className="w-full accent-emerald-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Save Campaign</ZoruCardTitle>
                <ZoruCardDescription>Record this score configuration for future reference.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="flex gap-3">
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
              </ZoruCardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="h-full flex flex-col justify-center">
              <ZoruCardContent className="p-8 text-center space-y-4">
                <div className="text-muted-foreground font-medium uppercase tracking-widest text-sm">Estimated Quality Score</div>
                <div className={cn(
                  "text-8xl font-black",
                  score >= 8 ? "text-emerald-500" : score >= 6 ? "text-amber-500" : "text-rose-500"
                )}>
                  {score.toFixed(1)}
                </div>
                <div className={cn(
                  "inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold",
                  score >= 8 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : 
                  score >= 6 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : 
                  "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                )}>
                  {label}
                </div>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" /> 
                  Improvement Suggestions
                </ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <span className="font-semibold block mb-0.5">Expected CTR:</span>
                    <span className="text-muted-foreground">{getCTRSuggestion(ctr)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 rounded-full bg-purple-500 shrink-0" />
                  <div>
                    <span className="font-semibold block mb-0.5">Ad Relevance:</span>
                    <span className="text-muted-foreground">{getRelSuggestion(rel)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="font-semibold block mb-0.5">Landing Page:</span>
                    <span className="text-muted-foreground">{getLPSuggestion(lp)}</span>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </div>

        {mounted && history.length > 0 && (
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" /> History
              </ZoruCardTitle>
              <ZoruCardDescription>Previously saved campaign estimates.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Exp. CTR</TableHead>
                      <TableHead className="text-right">Ad Rel.</TableHead>
                      <TableHead className="text-right">Land. Page</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.campaign}</TableCell>
                        <TableCell className="text-muted-foreground">{h.date}</TableCell>
                        <TableCell className="text-right">{h.ctr}</TableCell>
                        <TableCell className="text-right">{h.rel}</TableCell>
                        <TableCell className="text-right">{h.lp}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{h.score.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ZoruCardContent>
          </Card>
        )}

      </ToolShell>
    </ZoruTooltipProvider>
  );
}
