'use client';

/**
 * Wachat Post Generator (ZoruUI).
 *
 * AI-powered Facebook post idea generator. Form on the left, AI
 * suggestions on the right with a publish-confirm dialog before
 * marking a suggestion as the post to use.
 */

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Copy, Lightbulb, Loader2, Sparkles, Send } from 'lucide-react';

import { getSuggestions } from '@/app/actions/ai-actions';
import { mockFacebookDataString } from '@/lib/mock-data';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

type SuggestionsState = { suggestions: string[]; errors?: { facebookData?: string[] } };

const INITIAL_STATE: SuggestionsState = { suggestions: [], errors: {} };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <Sparkles />
          Generate Suggestions
        </>
      )}
    </ZoruButton>
  );
}

export default function PostGeneratorPage() {
  const [state, dispatch] = useFormState(
    getSuggestions as unknown as (
      prev: SuggestionsState,
      fd: FormData,
    ) => Promise<SuggestionsState>,
    INITIAL_STATE,
  );
  const { toast } = useZoruToast();
  const [publishTarget, setPublishTarget] = React.useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Post Generator</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-2">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · AI</ZoruPageEyebrow>
          <ZoruPageTitle>AI Post Generator</ZoruPageTitle>
          <ZoruPageDescription>
            Paste your Facebook page data — or use the bundled sample — and the
            AI will draft post ideas you can repurpose for WhatsApp campaigns.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-zoru-ink-muted" />
              Source data
            </ZoruCardTitle>
            <ZoruCardDescription>
              Paste your Facebook page data below or use the sample to generate
              engaging post ideas.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <form action={dispatch} className="flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="facebookData">Facebook Page Data</ZoruLabel>
                <ZoruTextarea
                  id="facebookData"
                  name="facebookData"
                  placeholder="Paste your data here…"
                  className="min-h-[250px]"
                  defaultValue={mockFacebookDataString}
                  required
                />
                {state.errors?.facebookData ? (
                  <p className="text-sm text-zoru-danger">
                    {state.errors.facebookData[0]}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between">
                <SubmitButton />
              </div>
            </form>
          </ZoruCardContent>
        </ZoruCard>

        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] tracking-tight text-zoru-ink">
            Suggestions
          </h2>
          {state.suggestions && state.suggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {state.suggestions.map((suggestion, index) => (
                <ZoruCard
                  key={index}
                  className="transition-shadow hover:shadow-[var(--zoru-shadow-md)]"
                >
                  <ZoruCardContent className="p-4">
                    <p className="text-[13px] leading-relaxed text-zoru-ink">
                      {suggestion}
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(suggestion)}
                      >
                        <Copy />
                        Copy
                      </ZoruButton>
                      <ZoruButton
                        variant="outline"
                        size="sm"
                        onClick={() => setPublishTarget(suggestion)}
                      >
                        Use Post
                      </ZoruButton>
                    </div>
                  </ZoruCardContent>
                </ZoruCard>
              ))}
            </div>
          ) : (
            <ZoruEmptyState
              icon={<Sparkles />}
              title="Suggestions appear here"
              description="Submit Facebook page data on the left and the AI will draft post ideas you can copy or publish."
            />
          )}
        </div>
      </div>

      {/* Publish-post dialog */}
      <ZoruDialog
        open={publishTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Use this post?</ZoruDialogTitle>
            <ZoruDialogDescription>
              We&apos;ll copy the suggestion to your clipboard so you can paste
              it into a broadcast or campaign composer.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {publishTarget ? (
            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 text-[13px] leading-relaxed text-zoru-ink">
              {publishTarget}
            </div>
          ) : null}
          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => setPublishTarget(null)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                if (publishTarget) {
                  navigator.clipboard.writeText(publishTarget);
                  toast({
                    title: 'Ready to use',
                    description:
                      'Suggestion copied. Paste it into a broadcast or campaign.',
                  });
                }
                setPublishTarget(null);
              }}
            >
              <Send />
              Copy &amp; use
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
