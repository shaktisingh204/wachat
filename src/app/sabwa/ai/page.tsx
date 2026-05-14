import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

export const metadata = { title: 'AI Assistant — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Per-chat AI inbox tools for suggested replies, summarisation, translation, tone control, and optional auto-pilot.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Bring LLM assistance into every conversation with credit-metered tools and a strict human-takeover audit log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Suggest reply — 3 candidate replies based on conversation context.</li>
            <li>Summarise chat — last 24 hours, last 7 days, or all-time.</li>
            <li>Translate — auto-detect source, choose target language.</li>
            <li>Tone — rewrite a draft as casual, formal, or friendly.</li>
            <li>Auto-pilot — AI replies to whitelisted contacts autonomously.</li>
            <li>Audit log and instant human takeover for every AI action.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
