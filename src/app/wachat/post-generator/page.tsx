'use client';

import * as React from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Copy,
  Lightbulb,
  Loader2,
  Sparkles,
  Facebook,
  MessageCircle,
  TrendingUp,
  FileText,
  Send,
  Hash,
} from 'lucide-react';
import { useChat } from '@ai-sdk/react';

import { mockFacebookDataString } from '@/lib/mock-data';
import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const seedHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

const predictEngagement = (text: string) => {
  const base = seedHash(text);
  const score = 35 + (base % 60);
  const reach = 200 + (base % 4800);
  const reactions = Math.floor(reach * (0.04 + ((base >> 4) % 100) / 1000));
  return { score, reach, reactions };
};

const extractTopic = (text: string) => {
  const words = text.split(/\s+/).filter((w) => w.length > 4 && !/^[\d\W]+$/.test(w));
  return words[seedHash(text) % Math.max(words.length, 1)] || 'general';
};

const PARSE_PREVIEW_LIMIT = 280;

export default function PostGeneratorPage() {
  const reduce = useReducedMotion();
  const { toast } = useZoruToast();
  const [publishTarget, setPublishTarget] = React.useState<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/wachat/post-generator/api',
    initialInput: mockFacebookDataString,
    onError: (error) => {
      toast({
        title: 'Error generating suggestions',
        description: error.message || 'The AI provider might be slow or unavailable.',
        variant: 'destructive',
      });
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const handlePublishWhatsApp = () => {
    if (publishTarget) toast({ title: 'Published to WhatsApp Status', description: 'Your status has been updated (simulated).' });
    setPublishTarget(null);
  };

  const handlePublishFacebook = () => {
    if (publishTarget) toast({ title: 'Published to Facebook page', description: 'Your post has been published (simulated).' });
    setPublishTarget(null);
  };

  const lastMessage = messages[messages.length - 1];
  const suggestions =
    lastMessage?.role === 'assistant'
      ? lastMessage.content.split('---').map((s) => s.trim()).filter(Boolean)
      : [];

  const stats = React.useMemo(() => {
    const total = messages.filter((m) => m.role === 'assistant').reduce((s, m) => s + m.content.split('---').filter((c) => c.trim()).length, 0);
    const allText = suggestions.join(' ');
    const avgScore = suggestions.length > 0
      ? Math.round(suggestions.reduce((s, sg) => s + predictEngagement(sg).score, 0) / suggestions.length)
      : 0;
    return {
      generatedWeek: total,
      currentBatch: suggestions.length,
      topTopic: allText ? extractTopic(allText) : '-',
      avgEngagement: avgScore ? `${avgScore}%` : '-',
    };
  }, [messages, suggestions]);

  const parsePreview = input.length > PARSE_PREVIEW_LIMIT
    ? `${input.slice(0, PARSE_PREVIEW_LIMIT)}...`
    : input;
  const inputLines = input.split('\n').length;
  const inputWords = input.trim().split(/\s+/).filter(Boolean).length;

  return (
    <WaPage>
      <PageHeader
        title="AI post generator"
        description="Paste your Facebook page data, and our AI drafts post ideas you can copy or repurpose for WhatsApp campaigns."
        kicker="Wachat · AI"
        eyebrowIcon={Sparkles}
      />

      {/* Stats strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Posts this week" value={stats.generatedWeek.toLocaleString('en-IN')} icon={FileText} delay={0.02} />
        <MetricTile label="Current batch" value={stats.currentBatch.toLocaleString('en-IN')} icon={Sparkles} delay={0.04} />
        <MetricTile label="Top topic" value={stats.topTopic} icon={Hash} delay={0.06} />
        <MetricTile label="Avg engagement" value={stats.avgEngagement} icon={TrendingUp} delay={0.08} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section
          title={<span className="inline-flex items-center gap-2"><Lightbulb className="h-4 w-4 text-zinc-500" strokeWidth={2.25} /> Source data</span>}
          description={`${inputWords.toLocaleString('en-IN')} words · ${inputLines.toLocaleString('en-IN')} lines`}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="facebookData">Facebook page data</Label>
              <Textarea
                id="facebookData"
                name="facebookData"
                placeholder="Paste your data here..."
                className="min-h-[200px]"
                value={input}
                onChange={handleInputChange}
                required
              />
            </div>
            {input.trim() && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Parse preview</p>
                <p className="line-clamp-4 text-[11.5px] leading-relaxed text-zinc-700">{parsePreview}</p>
              </div>
            )}
            <WaButton type="submit" disabled={isLoading} leftIcon={isLoading ? Loader2 : Sparkles}>
              {isLoading ? 'Generating...' : 'Generate suggestions'}
            </WaButton>
          </form>
        </Section>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold tracking-tight text-zinc-900">Suggestions</h2>
            {suggestions.length > 0 && (
              <span className="text-[11px] tabular-nums text-zinc-500">{suggestions.length} drafts</span>
            )}
          </div>
          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {suggestions.map((suggestion, i) => {
                  const eng = predictEngagement(suggestion);
                  const wordCount = suggestion.trim().split(/\s+/).filter(Boolean).length;
                  return (
                    <m.article
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.04, ease: EASE_OUT }}
                      className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-[2px]"
                      style={{ boxShadow: '0 0 0 1px transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Draft {i + 1}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}>
                          {eng.score}% engagement
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-800">{suggestion}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-2.5 text-[11px]">
                        <Stat label="Words" value={wordCount.toString()} />
                        <Stat label="Est. reach" value={eng.reach.toLocaleString('en-IN')} />
                        <Stat label="Reactions" value={`~${eng.reactions.toLocaleString('en-IN')}`} />
                      </div>
                      <div className="mt-3 flex justify-end gap-2 border-t border-zinc-100 pt-2.5">
                        <WaButton variant="ghost" size="sm" onClick={() => handleCopy(suggestion)} disabled={isLoading} leftIcon={Copy}>
                          Copy
                        </WaButton>
                        <WaButton variant="outline" size="sm" onClick={() => setPublishTarget(suggestion)} disabled={isLoading} leftIcon={Send}>
                          Use post
                        </WaButton>
                      </div>
                    </m.article>
                  );
                })}
              </AnimatePresence>
              {isLoading && (
                <div className="flex items-center justify-center gap-2 p-3 text-[12px] text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
                  AI is drafting...
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Suggestions appear here"
              description="Submit Facebook page data on the left, and the AI drafts post ideas you can copy or publish."
            />
          )}
        </div>
      </div>

      <Dialog open={publishTarget !== null} onOpenChange={(open) => { if (!open) setPublishTarget(null); }}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Use this post?</ZoruDialogTitle>
            <ZoruDialogDescription>
              Choose where to publish, or copy this draft to your clipboard.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {publishTarget && (
            <div className="max-h-[200px] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[13px] leading-relaxed text-zinc-900">
              <p className="whitespace-pre-wrap">{publishTarget}</p>
            </div>
          )}
          <ZoruDialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <WaButton variant="outline" leftIcon={Facebook} onClick={handlePublishFacebook}>Facebook page</WaButton>
              <WaButton variant="outline" leftIcon={MessageCircle} onClick={handlePublishWhatsApp}>WhatsApp Status</WaButton>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2 sm:mt-0 sm:flex-row sm:justify-end">
              <WaButton variant="ghost" onClick={() => setPublishTarget(null)}>Cancel</WaButton>
              <WaButton
                leftIcon={Copy}
                onClick={() => {
                  if (publishTarget) {
                    navigator.clipboard.writeText(publishTarget);
                    toast({ title: 'Ready to use', description: 'Suggestion copied. Paste into a broadcast or campaign.' });
                  }
                  setPublishTarget(null);
                }}
              >
                Copy and use
              </WaButton>
            </div>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-[12px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}
