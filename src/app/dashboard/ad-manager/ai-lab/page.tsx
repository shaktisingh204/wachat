'use client';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Sparkles,
  Wand2,
  Clapperboard,
  Type,
  BarChart3,
  Zap,
  Copy,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import {
  AmBreadcrumb,
  AmHeader,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { generateAdVariants } from './actions';

const TOOLS = [
  { id: 'copy', icon: Type, label: 'Ad copy generator', desc: 'Generate primary text, headlines, and descriptions from a brief.' },
  { id: 'video', icon: Clapperboard, label: 'Promo video generator', desc: 'Turn product images into a 15-second promo video.', href: '/wachat/whatsapp-ads' },
  { id: 'sentiment', icon: BarChart3, label: 'Sentiment analyzer', desc: 'Score your ad copy for emotion, clarity, and CTA strength.' },
  { id: 'variants', icon: Wand2, label: 'Creative variants', desc: 'Generate 10 creative variations from a single seed ad.' },
  { id: 'audience', icon: Zap, label: 'Audience discovery', desc: 'Suggest targeting interests based on your product description.' },
];

export default function AiLabPage() {
  const { toast } = useToast();
  const [brief, setBrief] = React.useState('');
  const [results, setResults] = React.useState<string[]>([]);
  const [generating, setGenerating] = React.useState(false);

  async function handleGenerate() {
    if (!brief.trim()) return;
    setGenerating(true);
    const res = await generateAdVariants(brief.trim());
    if (res.error) {
      toast.error(res.error);
    } else if (res.variants) {
      setResults(res.variants);
    }
    setGenerating(false);
  }

  return (
    <>
      <AmBreadcrumb page="AI Lab" />

      <AmHeader
        title="AI creative lab"
        description="Machine-learning workflows Meta Ads Manager does not offer."
        actions={
          <Badge tone="accent">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Only on SabNode
          </Badge>
        }
      />

      <div className="mt-6 space-y-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const body = (
              <>
                <CardHeader className="pb-2">
                  <span
                    className="h-10 w-10 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] flex items-center justify-center text-[var(--st-accent)]"
                    aria-hidden="true"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <CardTitle className="text-base mt-2">{t.label}</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-xs text-[var(--st-text-secondary)]">{t.desc}</p>
                </CardBody>
              </>
            );

            if (t.href) {
              return (
                <Link key={t.id} href={t.href} className="block h-full no-underline">
                  <Card variant="interactive" className="h-full">{body}</Card>
                </Link>
              );
            }

            return (
              <Card
                key={t.id}
                variant="interactive"
                role="button"
                tabIndex={0}
                aria-label={`${t.label}. ${t.desc}`}
                className="h-full cursor-pointer"
                onClick={() =>
                  toast({
                    title: t.label,
                    description: 'This tool is being set up. Use the Quick generator below.',
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toast({
                      title: t.label,
                      description: 'This tool is being set up. Use the Quick generator below.',
                    });
                  }
                }}
              >
                {body}
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Quick ad copy generator
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Product / offer brief">
              <Textarea
                placeholder="e.g. 30% off a premium yoga subscription for new signups"
                className="min-h-24"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                variant="primary"
                iconLeft={Sparkles}
                loading={generating}
                disabled={!brief.trim()}
                onClick={handleGenerate}
              >
                Generate 10 variants
              </Button>
            </div>
            {results.length > 0 ? (
              <div className="space-y-2 mt-4">
                <p className="text-sm font-medium text-[var(--st-text)]">Generated variants</p>
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
                  >
                    <span className="text-sm text-[var(--st-text)]">{r}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={Copy}
                      onClick={() => {
                        navigator.clipboard.writeText(r);
                        toast.success('Copied to clipboard');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Wand2}
                size="sm"
                title="No variants yet"
                description="Describe your product or offer above, then generate 10 ad copy variations."
              />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
