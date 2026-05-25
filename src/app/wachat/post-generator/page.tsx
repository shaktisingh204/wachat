'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Label,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { Copy, Lightbulb, Loader2, Sparkles, Send, Facebook, MessageCircle } from 'lucide-react';
import { mockFacebookDataString } from '@/lib/mock-data';
import * as React from 'react';
import { useChat } from '@ai-sdk/react';

export default function PostGeneratorPage() {
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
      toast({
        title: 'Published to WhatsApp Status',
        description: 'Your status has been updated (Simulated - API coming soon).',
      });
    }
    setPublishTarget(null);
  };

  const handlePublishFacebook = () => {
    if (publishTarget) {
      toast({
        title: 'Published to Facebook Page',
        description: 'Your post has been published to your page (Simulated).',
      });
    }
    setPublishTarget(null);
  };

  const lastMessage = messages[messages.length - 1];
  
  // Extract suggestions from the assistant's message. We split by "---" as instructed in the system prompt.
  const suggestions = lastMessage?.role === 'assistant' 
    ? lastMessage.content.split('---').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
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
      </Breadcrumb>

      <PageHeader className="mt-2">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · AI</ZoruPageEyebrow>
          <ZoruPageTitle>AI Post Generator</ZoruPageTitle>
          <ZoruPageDescription>
            Paste your Facebook page data — or use the bundled sample — and the
            AI will draft post ideas you can repurpose for WhatsApp campaigns.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
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
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="facebookData">Facebook Page Data</Label>
                <Textarea
                  id="facebookData"
                  name="facebookData"
                  placeholder="Paste your data here…"
                  className="min-h-[250px]"
                  value={input}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <Button type="submit" size="lg" disabled={isLoading}>
                  {isLoading ? (
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
                </Button>
              </div>
            </form>
          </ZoruCardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] tracking-tight text-zoru-ink">
            Suggestions
          </h2>
          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {suggestions.map((suggestion, index) => (
                <Card
                  key={index}
                  className="transition-shadow hover:shadow-[var(--zoru-shadow-md)]"
                >
                  <ZoruCardContent className="p-4">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zoru-ink">
                      {suggestion}
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(suggestion)}
                        disabled={isLoading}
                      >
                        <Copy />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPublishTarget(suggestion)}
                        disabled={isLoading}
                      >
                        Use Post
                      </Button>
                    </div>
                  </ZoruCardContent>
                </Card>
              ))}
              {isLoading && (
                <div className="flex items-center justify-center p-4 text-zoru-ink-muted">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">AI is thinking...</span>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles />}
              title="Suggestions appear here"
              description="Submit Facebook page data on the left and the AI will draft post ideas you can copy or publish."
            />
          )}
        </div>
      </div>

      {/* Publish-post dialog */}
      <Dialog
        open={publishTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Use this post?</ZoruDialogTitle>
            <ZoruDialogDescription>
              Choose where you want to publish this suggestion or copy it to your clipboard.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {publishTarget ? (
            <div className="max-h-[200px] overflow-y-auto rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 text-[13px] leading-relaxed text-zoru-ink">
              <p className="whitespace-pre-wrap">{publishTarget}</p>
            </div>
          ) : null}
          <ZoruDialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handlePublishFacebook}
              >
                <Facebook className="mr-2 h-4 w-4" />
                Facebook Page
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handlePublishWhatsApp}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp Status
              </Button>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end mt-2 sm:mt-0">
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => setPublishTarget(null)}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  if (publishTarget) {
                    navigator.clipboard.writeText(publishTarget);
                    toast({
                      title: 'Ready to use',
                      description: 'Suggestion copied. Paste it into a broadcast or campaign.',
                    });
                  }
                  setPublishTarget(null);
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy &amp; Use
              </Button>
            </div>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
