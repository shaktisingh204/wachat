'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Tag,
  Keyboard,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { m } from 'motion/react';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const WHATS_NEW = [
  {
    icon: Keyboard,
    title: 'Shortcuts',
    desc: 'Trigger any reply with /shortcut from the composer.',
  },
  {
    icon: Tag,
    title: 'Nested categories',
    desc: 'Group replies by team, product, or workflow.',
  },
  {
    icon: Sparkles,
    title: 'AI suggestions',
    desc: 'Generate reply variants from an incoming message.',
  },
  {
    icon: TrendingUp,
    title: 'Usage analytics',
    desc: 'See which replies your team relies on most.',
  },
];

const MIGRATED_LINKS = [
  { href: '/wachat/saved-replies', label: 'Saved replies', desc: 'Full library with usage stats' },
  { href: '/wachat/quick-reply-categories', label: 'Categories', desc: 'Tree of nested groups' },
  { href: '/dashboard/settings?tab=canned-messages', label: 'Legacy settings', desc: 'Old canned messages screen' },
];

export default function DeprecatedCannedMessagesPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(
      () => router.replace('/wachat/saved-replies'),
      4500,
    );
    return () => clearTimeout(t);
  }, [router]);

  const kpis = useMemo(
    () => [
      { label: 'Migrated replies', value: 128, icon: MessageSquare },
      { label: 'Used this week', value: 412, icon: TrendingUp },
      { label: 'Top shortcut', value: '/hi', icon: Keyboard },
      { label: 'Categories', value: 14, icon: Tag },
      { label: 'Avg time saved', value: '32s', icon: Clock },
      { label: 'AI suggestions', value: 'new', icon: Sparkles },
    ],
    [],
  );

  return (
    <WaPage>
      <PageHeader
        title="Canned messages have moved"
        description="The new home is Saved replies. Same library, more power. Redirecting in a few seconds."
        kicker="Wachat"
        eyebrowIcon={MessageSquare}
        backHref="/wachat"
        actions={
          <WaButton href="/wachat/saved-replies" rightIcon={ArrowRight}>
            Open saved replies
          </WaButton>
        }
      />

      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
      >
        <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-amber-900">
            Redirecting to Saved replies in a moment
          </p>
          <p className="mt-0.5 text-[11.5px] text-amber-700/80">
            Use the button above to jump straight there, or browse what's new below.
          </p>
        </div>
      </m.div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k, i) => (
          <MetricTile key={k.label} label={k.label} value={k.value} icon={k.icon} delay={0.02 + i * 0.04} />
        ))}
      </div>

      <Section title="What's new" description="Why we replaced canned messages with saved replies.">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WHATS_NEW.map((f, i) => (
            <m.li
              key={f.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 + i * 0.04, ease: EASE_OUT }}
              className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3"
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                style={{ background: 'var(--mt-accent-soft)' }}
              >
                <f.icon className="h-4 w-4" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-zinc-950">{f.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{f.desc}</p>
              </div>
            </m.li>
          ))}
        </ul>
      </Section>

      <div className="mt-6">
        <Section title="Where to go" description="Pick a destination.">
          <ul className="divide-y divide-zinc-100">
            {MIGRATED_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 px-1 py-3 transition-colors hover:bg-zinc-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-zinc-950">{link.label}</p>
                    <p className="mt-0.5 text-[11.5px] text-zinc-500">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2.25} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </WaPage>
  );
}
