'use client';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  EmptyState,
  Field,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { Modal } from '@/components/sabcrm/20ui';
import { Copy, Lightbulb, Loader2, Sparkles, Facebook, MessageCircle } from 'lucide-react';
import { mockFacebookDataString } from '@/lib/mock-data';
import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function PostGeneratorPage() {
  const { toast } = useToast();
  const [publishTarget, setPublishTarget] = React.useState<string | null>(null);
  const [input, setInput] = React.useState(mockFacebookDataString);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/wachat/post-generator/api' }),
    onError: (error) => {
      toast({
        title: 'Error generating suggestions',
        description: error.message || 'The AI provider might be slow or unavailable.',
        tone: 'danger',
      });
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
  };

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
  const suggestions =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('')
          .split('---')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Post Generator' },
      ]}
      eyebrow="WaChat · AI"
      title="AI Post Generator"
      description="Paste your Facebook page data or use the bundled sample and the AI will draft post ideas you can repurpose for WhatsApp campaigns."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card padding="none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 [color:var(--st-text-secondary)]" aria-hidden="true" />
              Source data
            </CardTitle>
            <CardDescription>
              Paste your Facebook page data below or use the sample to generate
              engaging post ideas.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <Field label="Facebook Page Data">
                <Textarea
                  name="facebookData"
                  placeholder="Paste your data here…"
                  className="min-h-[250px]"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  required
                />
              </Field>
              <div className="flex items-center justify-between">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isLoading}
                  iconLeft={isLoading ? undefined : Sparkles}
                  disabled={isLoading}
                >
                  {isLoading ? 'Generating…' : 'Generate Suggestions'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] tracking-tight [color:var(--st-text)]">
            Suggestions
          </h2>
          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {suggestions.map((suggestion, index) => (
                <Card key={index} variant="interactive">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed [color:var(--st-text)]">
                    {suggestion}
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Copy}
                      onClick={() => handleCopy(suggestion)}
                      disabled={isLoading}
                    >
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
                </Card>
              ))}
              {isLoading && (
                <div className="flex items-center justify-center p-4 [color:var(--st-text-secondary)]">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  <span className="ml-2">AI is thinking...</span>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Suggestions appear here"
              description="Submit Facebook page data on the left and the AI will draft post ideas you can copy or publish."
            />
          )}
        </div>
      </div>

      {/* Publish-post dialog */}
      <Modal
        open={publishTarget !== null}
        onClose={() => setPublishTarget(null)}
        title="Use this post?"
        description="Choose where you want to publish this suggestion or copy it to your clipboard."
        footer={
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                iconLeft={Facebook}
                className="w-full sm:w-auto"
                onClick={handlePublishFacebook}
              >
                Facebook Page
              </Button>
              <Button
                variant="outline"
                iconLeft={MessageCircle}
                className="w-full sm:w-auto"
                onClick={handlePublishWhatsApp}
              >
                WhatsApp Status
              </Button>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2 sm:mt-0 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => setPublishTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                iconLeft={Copy}
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
                Copy &amp; Use
              </Button>
            </div>
          </div>
        }
      >
        {publishTarget ? (
          <Card variant="outlined" padding="sm" className="max-h-[200px] overflow-y-auto text-[13px] leading-relaxed">
            <p className="whitespace-pre-wrap [color:var(--st-text)]">{publishTarget}</p>
          </Card>
        ) : null}
      </Modal>
    </WachatPage>
  );
}
