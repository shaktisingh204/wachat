'use client';

/**
 * Content sections below the module list (Why, Use cases, Philosophy,
 * Audience, CTA). Each uses SplitText heading reveals, stagger reveals on
 * card children, and the emerald glossy-glass styling.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Check, TrendingUp, Smile, Send, ServerCog,
  Building, Megaphone, ShoppingBag, Star, Users2, Pencil, Zap, Clock, Rocket,
  Sparkles, Quote,
} from 'lucide-react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(SplitText, ScrollTrigger);

/* =================================================================== */
/*  Shared hooks                                                        */
/* =================================================================== */

function useSplitHeadingReveal(ref: React.RefObject<HTMLElement | null>) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const split = new SplitText(el, { type: 'chars,words,lines' });
      gsap.set(split.chars, { opacity: 0, y: 50, rotateX: -60 });
      gsap.to(split.chars, {
        opacity: 1,
        y: 0,
        rotateX: 0,
        stagger: 0.015,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 82%', once: true },
      });
    }, el);
    return () => ctx.revert();
  }, [ref]);
}

function useChildStagger(
  ref: React.RefObject<HTMLElement | null>,
  opts: { y?: number; stagger?: number; delay?: number } = {}
) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (!children.length) return;
    const ctx = gsap.context(() => {
      gsap.set(children, { opacity: 0, y: opts.y ?? 40 });
      gsap.to(children, {
        opacity: 1,
        y: 0,
        stagger: opts.stagger ?? 0.08,
        duration: 0.8,
        ease: 'power3.out',
        delay: opts.delay ?? 0,
        scrollTrigger: { trigger: el, start: 'top 82%', once: true },
      });
    }, el);
    return () => ctx.revert();
  }, [ref, opts.y, opts.stagger, opts.delay]);
}


/* =================================================================== */
/*  Primitives                                                          */
/* =================================================================== */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold text-emerald-800"
      style={{
        backdropFilter: 'blur(12px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.5)',
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
      <span className="uppercase tracking-[0.08em]">{children}</span>
    </div>
  );
}

/**
 * Simple section wrapper with consistent spacing and content-visibility.
 */
function TrunkSection({
  id,
  children,
  variant: _variant = 'even',
}: {
  id?: string;
  children: React.ReactNode;
  variant?: 'even' | 'odd';
}) {
  return (
    <section
      id={id}
      className="relative py-24 md:py-32"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 900px' }}
    >
      <div className="container mx-auto px-6 relative z-10">{children}</div>
    </section>
  );
}

const glassStyle: React.CSSProperties = {
  background:
    'linear-gradient(155deg, rgba(240,253,244,0.9) 0%, rgba(209,250,229,0.55) 100%)',
  backdropFilter: 'blur(14px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
  border: '1px solid rgba(167, 243, 208, 0.7)',
  boxShadow:
    '0 20px 50px -20px rgba(6, 78, 59, 0.18), 0 0 0 1px rgba(255,255,255,0.6) inset',
};

/* =================================================================== */
/*  Why SabNode                                                         */
/* =================================================================== */

export function WhySection() {
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const cardsRef = React.useRef<HTMLDivElement>(null);
  useSplitHeadingReveal(titleRef);
  useChildStagger(cardsRef, { stagger: 0.09, y: 40 });

  const benefits = [
    { icon: Zap,      title: 'Instant replies',  desc: 'AI answers FAQs and routes leads before they go cold.' },
    { icon: Clock,    title: '24/7 execution',   desc: 'Workers run while you sleep. No manual babysitting.' },
    { icon: Sparkles, title: 'No-code setup',    desc: 'Visual builders for everything. Ship in an afternoon.' },
    { icon: Rocket,   title: 'Built to scale',   desc: 'Tested on millions of messages a month.' },
  ];

  return (
    <TrunkSection id="why" variant="even">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
        <div className="lg:sticky lg:top-28">
          <SectionLabel>Why SabNode</SectionLabel>
          <h2
            ref={titleRef}
            className="mt-5 text-3xl md:text-4xl lg:text-[44px] font-semibold leading-[1.08] tracking-[-0.02em] text-emerald-950"
            style={{ perspective: '1000px' }}
          >
            Stop gluing tools together.
          </h2>
          <p className="mt-5 text-base md:text-lg text-emerald-900/70 leading-relaxed max-w-md">
            Most teams lose hours a day switching between CRMs, inboxes,
            automation tools and spreadsheets. SabNode replaces that stack
            with a single connected system that runs on autopilot.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white shadow-[0_12px_30px_-8px_rgba(5,150,105,0.55)] transition-transform hover:scale-[1.03]"
            >
              Try it free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#use-cases"
              className="inline-flex h-11 items-center text-sm font-semibold text-emerald-800 hover:text-emerald-950 transition-colors gap-1"
            >
              See use cases <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="group relative rounded-2xl p-6 h-full overflow-hidden transition-transform hover:-translate-y-1"
              style={glassStyle}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white mb-5 shadow-lg transition-transform group-hover:scale-110">
                <b.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="text-base font-semibold text-emerald-950 mb-1.5">
                {b.title}
              </div>
              <div className="text-[13.5px] text-emerald-900/70 leading-relaxed">
                {b.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TrunkSection>
  );
}

/* =================================================================== */
/*  Use cases                                                           */
/* =================================================================== */

export function UseCasesSection() {
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const cardsRef = React.useRef<HTMLDivElement>(null);
  useSplitHeadingReveal(titleRef);
  useChildStagger(cardsRef, { stagger: 0.1, y: 60 });

  const useCases = [
    { icon: TrendingUp, title: 'Lead generation & sales', desc: 'Capture, qualify and nurture leads automatically. Every prospect gets a fast, personalised reply — even at 2 AM.', metric: '+38%', metricLabel: 'response rate' },
    { icon: Smile,      title: 'Customer support 24/7',   desc: 'AI handles repeat questions. Humans take edge cases. Tickets drop, satisfaction climbs.', metric: '−52%', metricLabel: 'ticket volume' },
    { icon: Send,       title: 'Marketing campaigns',     desc: 'Multi-step WhatsApp broadcasts and personalised drip flows — launched, tracked and optimised.', metric: '12k', metricLabel: 'msgs / hour' },
    { icon: ServerCog,  title: 'Internal operations',     desc: 'Reporting, data entry, approvals, reminders — every boring, repetitive task quietly automated.', metric: '24/7', metricLabel: 'unattended' },
  ];

  return (
    <TrunkSection id="use-cases" variant="odd">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <SectionLabel>Use cases</SectionLabel>
        <h2
          ref={titleRef}
          className="mt-5 text-3xl md:text-4xl lg:text-[44px] font-semibold leading-[1.08] tracking-[-0.02em] text-emerald-950"
          style={{ perspective: '1000px' }}
        >
          Built for real challenges
        </h2>
        <p className="mt-5 text-base md:text-lg text-emerald-900/70">
          From sales to support to ops — real problems, quietly solved.
        </p>
      </div>

      <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        {useCases.map((u) => (
          <div
            key={u.title}
            className="group relative rounded-3xl p-8 md:p-9 h-full overflow-hidden transition-transform hover:-translate-y-1"
            style={glassStyle}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg transition-transform group-hover:scale-110">
                <u.icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold bg-gradient-to-br from-emerald-600 to-teal-700 bg-clip-text text-transparent tabular-nums">
                  {u.metric}
                </div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-700/70 mt-0.5">
                  {u.metricLabel}
                </div>
              </div>
            </div>
            <h3 className="text-xl md:text-[22px] font-semibold text-emerald-950 mb-2.5 tracking-[-0.01em]">
              {u.title}
            </h3>
            <p className="text-emerald-900/75 leading-relaxed text-[14.5px]">{u.desc}</p>
            <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-emerald-800 group-hover:text-emerald-950 transition-colors">
              Learn more
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        ))}
      </div>
    </TrunkSection>
  );
}

/* =================================================================== */
/*  Philosophy                                                          */
/* =================================================================== */

export function PhilosophySection() {
  const quoteRef = React.useRef<HTMLQuoteElement>(null);
  useSplitHeadingReveal(quoteRef as unknown as React.RefObject<HTMLElement>);

  return (
    <TrunkSection variant="even">
      <div className="max-w-4xl mx-auto">
        <div
          className="relative rounded-3xl p-10 md:p-14 text-center overflow-hidden"
          style={glassStyle}
        >
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500"
          />
          <Quote className="absolute top-6 left-6 h-9 w-9 text-emerald-200" strokeWidth={1.5} />
          <Quote className="absolute bottom-6 right-6 h-9 w-9 text-emerald-200 rotate-180" strokeWidth={1.5} />

          <SectionLabel>Our philosophy</SectionLabel>
          <blockquote
            ref={quoteRef}
            className="relative mt-6 text-2xl md:text-[32px] font-medium leading-[1.28] tracking-[-0.015em] text-emerald-950 max-w-2xl mx-auto"
            style={{ perspective: '1000px' }}
          >
            Modern businesses don't fail for lack of ideas. They fail because manual execution can't keep up with growth.
          </blockquote>
          <div className="mt-8 inline-flex items-center gap-3 text-[11px] text-emerald-700/70 uppercase tracking-[0.15em]">
            <span className="h-px w-10 bg-emerald-300" />
            Proof &gt; Promise
            <span className="h-px w-10 bg-emerald-300" />
          </div>
        </div>
      </div>
    </TrunkSection>
  );
}

/* =================================================================== */
/*  Audience                                                            */
/* =================================================================== */

export function AudienceSection() {
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const cardsRef = React.useRef<HTMLDivElement>(null);
  useSplitHeadingReveal(titleRef);
  useChildStagger(cardsRef, { stagger: 0.06, y: 30 });

  const audiences = [
    { icon: Building,   title: 'Small & medium business', desc: 'Streamline ops and scale with less.' },
    { icon: Megaphone,  title: 'Marketing agencies',      desc: 'Run every client campaign from one place.' },
    { icon: ShoppingBag,title: 'E-commerce brands',       desc: 'Automate orders, support and catalogs.' },
    { icon: Star,       title: 'Coaches & creators',      desc: 'Engage audiences with smart workflows.' },
    { icon: Users2,     title: 'Internal ops teams',      desc: 'Collaborate in one unified dashboard.' },
    { icon: Pencil,     title: 'AI / automation learners',desc: 'Build real AI systems without code.' },
  ];

  return (
    <TrunkSection variant="odd">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <SectionLabel>Who it's for</SectionLabel>
        <h2
          ref={titleRef}
          className="mt-5 text-3xl md:text-4xl lg:text-[44px] font-semibold leading-[1.08] tracking-[-0.02em] text-emerald-950"
          style={{ perspective: '1000px' }}
        >
          Built for operators, not theorists
        </h2>
      </div>

      <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {audiences.map((a) => (
          <div
            key={a.title}
            className="group relative flex items-start gap-4 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5"
            style={glassStyle}
          >
            <div className="flex-shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md transition-transform group-hover:scale-110 group-hover:-rotate-3">
              <a.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-emerald-950">{a.title}</div>
              <div className="text-[13px] text-emerald-900/65 mt-1 leading-relaxed">{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </TrunkSection>
  );
}

/* =================================================================== */
/*  Final CTA                                                           */
/* =================================================================== */

export function CTASection() {
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  useSplitHeadingReveal(titleRef);

  return (
    <TrunkSection variant="even">
      <div className="max-w-5xl mx-auto">
        <div
          className="relative rounded-[32px] p-10 md:p-16 text-center overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
            boxShadow:
              '0 40px 100px -30px rgba(6,78,59,0.5), 0 20px 50px -20px rgba(16,185,129,0.3)',
          }}
        >
          <div
            aria-hidden
            className="absolute -top-32 -left-32 h-[440px] w-[440px] rounded-full opacity-60"
            style={{ background: 'radial-gradient(circle, #10b981 0%, rgba(16,185,129,0) 60%)' }}
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -right-32 h-[440px] w-[440px] rounded-full opacity-60"
            style={{ background: 'radial-gradient(circle, #6ee7b7 0%, rgba(110,231,183,0) 60%)' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent"
          />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white mb-7">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              Join the SabNode beta
            </div>

            <h2
              ref={titleRef}
              className="text-3xl md:text-5xl font-semibold leading-[1.05] tracking-[-0.02em] text-white max-w-3xl mx-auto"
              style={{ perspective: '1000px' }}
            >
              Launch your stack. Watch it run.
            </h2>
            <p className="mt-6 text-base md:text-lg text-emerald-100/80 max-w-xl mx-auto leading-relaxed">
              Build automation workflows that save time, cut costs and scale
              your business — in an afternoon, not a quarter.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-emerald-900 transition-all hover:scale-[1.03] hover:shadow-[0_20px_40px_-10px_rgba(255,255,255,0.4)]"
              >
                Request beta access
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#modules"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-8 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Explore modules
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-emerald-100/60">
              <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300" />No credit card</div>
              <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300" />10-minute setup</div>
              <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300" />Cancel anytime</div>
            </div>
          </div>
        </div>
      </div>
    </TrunkSection>
  );
}
