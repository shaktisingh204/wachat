'use client';

import * as React from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { Copy, Lightbulb, Loader2, Sparkles, Facebook, MessageCircle } from 'lucide-react';
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
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

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
    if (publishTarget) {
      toast({ title: 'Published to WhatsApp Status', description: 'Your status has been updated (simulated).' });
    }
    setPublishTarget(null);
  };

  const handlePublishFacebook = () => {
    if (publishTarget) {
      toast({ title: 'Published to Facebook page', description: 'Your post has been published (simulated).' });
    }
    setPublishTarget(null);
  };

  const lastMessage = messages[messages.length - 1];
  const suggestions =
    lastMessage?.role === 'assistant'
      ? lastMessage.content.split('---').map((s) => s.trim()).filter(Boolean)
      : [];

  return (
    <WaPage>
      <PageHeader
        title="AI post generator"
        description="Paste your Facebook page data, and our AI drafts post ideas you can copy or repurpose for WhatsApp campaigns."
        kicker="Wachat · AI"
        eyebrowIcon={Sparkles}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Section
          title={
            <span className="inline-flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-zinc-500" strokeWidth={2.25} aria-hidden />
              Source data
            </span>
          }
          description="Paste your page data or use the bundled sample."
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="facebookData">Facebook page data</Label>
              <Textarea
                id="facebookData"
                name="facebookData"
                placeholder="Paste your data here..."
                className="min-h-[250px]"
                value={input}
                onChange={handleInputChange}
                required
              />
            </div>
            <WaButton type="submit" disabled={isLoading} leftIcon={isLoading ? Loader2 : Sparkles}>
              {isLoading ? 'Generating...' : 'Generate suggestions'}
            </WaButton>
          </form>
        </Section>

        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Suggestions</h2>
          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {suggestions.map((suggestion, i) => (
                  <m.article
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : i * 0.05, ease: EASE_OUT }}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-[2px]"
                    style={{ boxShadow: '0 0 0 1px transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
                  >
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800">{suggestion}</p>
                    <div className="mt-4 flex justify-end gap-2">
                      <WaButton variant="ghost" size="sm" onClick={() => handleCopy(suggestion)} disabled={isLoading} leftIcon={Copy}>
                        Copy
                      </WaButton>
                      <WaButton variant="outline" size="sm" onClick={() => setPublishTarget(suggestion)} disabled={isLoading}>
                        Use post
                      </WaButton>
                    </div>
                  </m.article>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex items-center justify-center gap-2 p-4 text-[12.5px] text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
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
            <div className="max-h-[200px] overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-[13px] leading-relaxed text-zinc-900">
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
