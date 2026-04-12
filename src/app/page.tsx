'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Sparkles,
  MessageSquare,
  Workflow,
  Bot,
  LineChart,
  Plus,
  Minus,
  Star,
  Zap,
  Shield,
  Globe,
  Rocket,
  Layers,
  Wrench,
  Database,
  Lock,
  Clock,
  HeartHandshake,
  Cpu,
  CircleDollarSign,
} from 'lucide-react';
import gsap from 'gsap';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { getSession } from '@/app/actions';
import Scene from '@/components/landing-3d/Scene';
import { Hero } from '@/components/landing-3d/Hero';
import { Footer } from '@/components/landing-3d/Roots';

/* =================================================================== */
/*  Shared animation hooks                                              */
/* =================================================================== */

/**
 * Reveal children of a container with a staggered fade+rise+3D rotate
 * animation, triggered when the section scrolls into view.
 *
 * Uses a native IntersectionObserver (no GSAP ScrollTrigger plugin) so
 * this works with Turbopack without module-load race conditions. The
 * animation itself is still GSAP. `clearProps` + a failsafe guarantee
 * no element can ever stay stuck at `opacity: 0`.
 */
function useStaggerReveal(
  ref: React.RefObject<HTMLElement | null>,
  opts: {
    selector?: string;
    y?: number;
    stagger?: number;
    rotateX?: number;
    scale?: number;
    duration?: number;
  } = {}
) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const targets = opts.selector
      ? Array.from(el.querySelectorAll<HTMLElement>(opts.selector))
      : (Array.from(el.children) as HTMLElement[]);
    if (!targets.length) return;

    const y = opts.y ?? 40;
    const rotateX = opts.rotateX ?? -12;
    const scale = opts.scale ?? 0.96;
    const stagger = opts.stagger ?? 0.08;
    const duration = opts.duration ?? 0.9;

    // Set initial state immediately so we don't see a flicker before
    // the observer fires.
    gsap.set(targets, {
      opacity: 0,
      y,
      rotateX,
      scale,
      transformPerspective: 900,
      transformOrigin: 'center top',
    });

    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        rotateX: 0,
        scale: 1,
        duration,
        stagger,
        ease: 'power3.out',
        clearProps: 'transform',
      });
    };

    // IntersectionObserver fires as soon as the section enters the
    // viewport. Safer than ScrollTrigger in Turbopack.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            play();
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    io.observe(el);

    // Failsafe: if the observer never fires (e.g. element already past
    // viewport on load, or layout oddity), force play after 2.5s so no
    // element can stay invisible.
    const failSafe = window.setTimeout(play, 2500);

    return () => {
      window.clearTimeout(failSafe);
      io.disconnect();
    };
  }, [ref, opts.selector, opts.y, opts.stagger, opts.rotateX, opts.scale, opts.duration]);
}

/**
 * Mousemove-driven 3D tilt for interactive cards. Subtle, glossy,
 * gpu-friendly (rotateX/Y + translateZ on a perspective parent).
 */
function useTilt(
  ref: React.RefObject<HTMLElement | null>,
  max = 10
) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      gsap.to(el, {
        rotateY: dx * max,
        rotateX: -dy * max,
        transformPerspective: 900,
        duration: 0.4,
        ease: 'power2.out',
      });
    };
    const onLeave = () => {
      gsap.to(el, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.6,
        ease: 'power3.out',
      });
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [ref, max]);
}

/**
 * SabNode landing page — extended editorial layout.
 *
 * The 3D backdrop floats the app's module names as canvas-textured planes.
 * The page itself is long-form: hero, trust strip, stats, three-step flow,
 * feature rows, product preview, module marquee, stack comparison,
 * integrations, quote, testimonials, audience, pricing teaser, FAQ and CTA.
 */
export default function HomePage() {
  const [session, setSession] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-[#f0fdf4] text-emerald-950 antialiased overflow-x-clip selection:bg-emerald-200 selection:text-emerald-950">
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ contain: 'strict' }}
      >
        <Scene />
      </div>

      {/* Animated glassy / blurry backdrop that sits over the 3D scene */}
      <div
        aria-hidden
        className="fixed inset-0 z-[1] pointer-events-none overflow-hidden"
      >
        <div className="sn-blob sn-blob-1" />
        <div className="sn-blob sn-blob-2" />
        <div className="sn-blob sn-blob-3" />
        <div className="sn-blob sn-blob-4" />
        <div
          className="absolute inset-0 sn-glass-shimmer"
          style={{
            backdropFilter: 'blur(60px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(60px) saturate(1.5)',
            background:
              'linear-gradient(135deg, rgba(240,253,244,0.42) 0%, rgba(220,252,231,0.22) 45%, rgba(236,253,245,0.45) 100%)',
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.4)',
          }}
        />
      </div>
      <style>{`
        @keyframes sn-float-1 {
          0%, 100% { transform: translate3d(-8%, -12%, 0) scale(1); }
          50%      { transform: translate3d(22%, 18%, 0) scale(1.18); }
        }
        @keyframes sn-float-2 {
          0%, 100% { transform: translate3d(28%, 22%, 0) scale(1.12); }
          50%      { transform: translate3d(-18%, -22%, 0) scale(0.94); }
        }
        @keyframes sn-float-3 {
          0%, 100% { transform: translate3d(-22%, 32%, 0) scale(1); }
          50%      { transform: translate3d(26%, -12%, 0) scale(1.22); }
        }
        @keyframes sn-float-4 {
          0%, 100% { transform: translate3d(15%, -28%, 0) scale(0.95); }
          50%      { transform: translate3d(-25%, 25%, 0) scale(1.1); }
        }
        @keyframes sn-glass-pan {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .sn-blob {
          position: absolute;
          width: 55vmax;
          height: 55vmax;
          border-radius: 9999px;
          filter: blur(90px);
          opacity: 0.55;
          mix-blend-mode: screen;
          will-change: transform;
        }
        .sn-blob-1 {
          top: -12%;
          left: -10%;
          background: radial-gradient(circle at 35% 35%, rgba(16,185,129,0.75), rgba(16,185,129,0) 70%);
          animation: sn-float-1 22s ease-in-out infinite;
        }
        .sn-blob-2 {
          top: 18%;
          right: -18%;
          background: radial-gradient(circle at 50% 50%, rgba(20,184,166,0.7), rgba(20,184,166,0) 70%);
          animation: sn-float-2 28s ease-in-out infinite;
        }
        .sn-blob-3 {
          bottom: -22%;
          left: 15%;
          background: radial-gradient(circle at 50% 50%, rgba(132,204,22,0.55), rgba(132,204,22,0) 70%);
          animation: sn-float-3 32s ease-in-out infinite;
        }
        .sn-blob-4 {
          top: 35%;
          left: 30%;
          width: 40vmax;
          height: 40vmax;
          background: radial-gradient(circle at 50% 50%, rgba(45,212,191,0.5), rgba(45,212,191,0) 70%);
          animation: sn-float-4 26s ease-in-out infinite;
        }
        .sn-glass-shimmer {
          background-size: 200% 200%;
          animation: sn-glass-pan 18s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .sn-blob,
          .sn-glass-shimmer { animation: none; }
        }
      `}</style>

      <div className="relative z-10">
        <SiteHeader loading={loading} session={session} />

        <main>
          <Hero />
          <TrustStrip />
          <StatsStrip />
          <HowItWorks />
          <FeatureRows />
          <ProductPreview />
          <ModuleMarquee />
          <StackComparison />
          <IntegrationsGrid />
          <QuoteBlock />
          <Testimonials />
          <AudienceRow />
          <PricingTeaser />
          <FaqSection />
          <CTABanner />
        </main>

        <Footer />
      </div>
    </div>
  );
}

/* =================================================================== */
/*  Header                                                              */
/* =================================================================== */

function SiteHeader({
  loading,
  session,
}: {
  loading: boolean;
  session: any;
}) {
  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="container mx-auto px-6 pt-4">
        <div
          className="flex h-14 items-center justify-between rounded-full border border-emerald-200/80 px-5"
          style={{
            background:
              'linear-gradient(155deg, rgba(240,253,244,0.95) 0%, rgba(220,252,231,0.7) 100%)',
            backdropFilter: 'blur(14px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
            boxShadow:
              '0 1px 0 0 rgba(6,78,59,0.04), 0 16px 40px -16px rgba(6,78,59,0.18), 0 0 0 1px rgba(255,255,255,0.7) inset',
          }}
        >
          <Link href="/" className="flex items-center gap-2">
            <SabNodeLogo className="h-7 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-emerald-800 font-medium">
            <Link href="#features" className="hover:text-emerald-950 transition-colors">
              Features
            </Link>
            <Link href="#how" className="hover:text-emerald-950 transition-colors">
              How it works
            </Link>
            <Link href="#pricing" className="hover:text-emerald-950 transition-colors">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-emerald-950 transition-colors">
              FAQ
            </Link>
            <Link href="/blog" className="hover:text-emerald-950 transition-colors">
              Blog
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {loading ? (
              <div className="h-9 w-24 rounded-full bg-emerald-100 animate-pulse" />
            ) : session?.user ? (
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition-transform hover:scale-[1.03] hover:bg-emerald-700"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex h-9 items-center px-3 text-sm font-medium text-emerald-800 hover:text-emerald-950 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition-transform hover:scale-[1.03] hover:bg-emerald-700"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* =================================================================== */
/*  Trust strip — logo cloud                                            */
/* =================================================================== */

const TRUSTED = [
  'NorthPeak',
  'Lumenly',
  'Atlaskit',
  'Folia',
  'Helix & Co',
  'Brightwave',
  'Kintsugi',
];

function TrustStrip() {
  const ref = React.useRef<HTMLDivElement>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);
  useStaggerReveal(rowRef, { y: 20, stagger: 0.06, rotateX: 0, scale: 0.9 });

  return (
    <section className="relative pt-8 pb-4">
      <div className="container mx-auto px-6" ref={ref}>
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-800 font-semibold">
            Trusted by teams shipping faster every week
          </p>
          <div
            ref={rowRef}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
          >
            {TRUSTED.map((t) => (
              <span
                key={t}
                className="text-lg md:text-xl font-semibold tracking-[-0.01em] text-emerald-900 hover:text-emerald-700 transition-colors"
                style={{ fontFamily: 'ui-serif, Georgia, serif' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Stats strip                                                         */
/* =================================================================== */

const STATS = [
  { value: '12', label: 'Connected modules' },
  { value: '24/7', label: 'Runs unattended' },
  { value: '500+', label: 'Teams on the beta' },
  { value: '10m', label: 'Time to first flow' },
];

function StatsStrip() {
  const gridRef = React.useRef<HTMLDivElement>(null);
  useStaggerReveal(gridRef, { y: 30, stagger: 0.1, rotateX: -20, scale: 0.9 });

  return (
    <section className="relative py-10 md:py-14">
      <div className="container mx-auto px-6">
        <div className="border-y border-emerald-200">
          <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={`group relative px-6 py-7 md:py-9 overflow-hidden transition-colors hover:bg-emerald-50/40 ${
                  i < STATS.length - 1 ? 'md:border-r border-emerald-200' : ''
                } ${i % 2 === 0 ? 'border-r md:border-r' : ''} ${
                  i < 2 ? 'border-b md:border-b-0' : ''
                }`}
              >
                <div
                  aria-hidden
                  className="absolute -top-10 -left-10 h-24 w-24 rounded-full bg-emerald-200/40 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                />
                <div className="relative text-4xl md:text-5xl font-semibold tracking-[-0.03em] tabular-nums bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-900 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="relative mt-2 text-[11px] uppercase tracking-[0.14em] text-emerald-800 font-semibold">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  How it works — 3 steps                                              */
/* =================================================================== */

const STEPS = [
  {
    num: '01',
    title: 'Plug in your channels',
    body: 'Connect WhatsApp, your website widget, CRM, and any tool you already use. Takes about ten minutes.',
    icon: Globe,
  },
  {
    num: '02',
    title: 'Describe the workflow',
    body: 'Drop nodes onto a canvas, or tell the AI what you want. Triggers, conditions, replies — all in one visual flow.',
    icon: Wrench,
  },
  {
    num: '03',
    title: 'Let it run, measure, iterate',
    body: 'Watch every step execute in real time. Edit live. Ship improvements the same day you notice problems.',
    icon: Rocket,
  },
];

function HowItWorks() {
  return (
    <section id="how" className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <SectionEyebrow>How it works</SectionEyebrow>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-[1.05] tracking-[-0.025em] text-emerald-950">
            From zero to running{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 bg-clip-text text-transparent">
              in one sitting.
            </span>
          </h2>
          <p className="mt-4 text-base md:text-[17px] text-emerald-900">
            Three steps. No onboarding calls, no consultants, no boilerplate.
          </p>
        </div>

        <div className="mt-12 relative">
          <div
            aria-hidden
            className="hidden md:block absolute top-[56px] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="relative text-center">
                  <div className="relative inline-flex h-28 w-28 items-center justify-center">
                    <div
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-100 via-emerald-50 to-white"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-3 rounded-full bg-white/70 border border-emerald-200/70 backdrop-blur-sm"
                    />
                    <Icon className="relative h-10 w-10 text-emerald-700" strokeWidth={1.8} />
                    <span className="absolute -top-1 -right-1 h-9 w-9 inline-flex items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold tabular-nums shadow-[0_10px_24px_-8px_rgba(5,150,105,0.6)]">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl md:text-2xl font-semibold tracking-[-0.015em] text-emerald-950">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm md:text-[15px] text-emerald-900 leading-relaxed max-w-xs mx-auto">
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Feature rows                                                        */
/* =================================================================== */

const FEATURES = [
  {
    num: '01',
    icon: MessageSquare,
    eyebrow: 'Conversation',
    title: 'One inbox that actually replies.',
    body:
      'Every message from WhatsApp, web chat and forms lands in one thread. AI answers the repeat questions, humans step in on the edge cases — nothing falls through.',
    bullets: ['Unified multi-channel inbox', 'AI-drafted replies', 'Smart routing by intent'],
  },
  {
    num: '02',
    icon: Workflow,
    eyebrow: 'Automation',
    title: 'Flows that run while you sleep.',
    body:
      "Drag-and-drop builder for broadcasts, drip sequences, follow-ups and internal approvals. Launch in an afternoon, measure what lands, iterate without touching code.",
    bullets: ['Visual no-code builder', 'Triggers on any event', 'Live analytics per step'],
  },
  {
    num: '03',
    icon: Bot,
    eyebrow: 'Intelligence',
    title: 'An AI layer across every module.',
    body:
      "The same LLM layer powers your chatbot, CRM enrichment, ticket triage and reply suggestions. Your data never leaks into someone else's model.",
    bullets: ['Private, tenant-scoped models', 'Grounded on your own data', 'Plug-and-play tool calls'],
  },
  {
    num: '04',
    icon: LineChart,
    eyebrow: 'Operations',
    title: 'The boring work, quietly done.',
    body:
      'Reporting, reminders, data entry, approvals — every repetitive task offloaded to workers that run in the background and report back only when it matters.',
    bullets: ['Background workers', 'Scheduled & on-demand jobs', 'Human-in-the-loop escalations'],
  },
];

function FeatureRows() {
  return (
    <section id="features" className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl">
          <SectionEyebrow>What it does</SectionEyebrow>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-[1.05] tracking-[-0.025em] text-emerald-950">
            A stack that works together,{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 bg-clip-text text-transparent">
              out of the box.
            </span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-emerald-900 max-w-xl">
            No more duct-taping SaaS subscriptions. Four connected layers — all
            sharing the same data model, the same identity, the same workflows.
          </p>
        </div>

        <div className="mt-10 md:mt-14 divide-y divide-emerald-200/70 border-y border-emerald-200/70">
          {FEATURES.map((f) => (
            <FeatureRow key={f.num} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ feature }: { feature: (typeof FEATURES)[number] }) {
  const Icon = feature.icon;
  return (
    <article className="group grid grid-cols-12 gap-5 md:gap-8 py-10 md:py-14 transition-colors hover:bg-emerald-50/40">
      <div className="col-span-12 md:col-span-3">
        <div className="flex md:flex-col items-start md:items-start gap-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-700 font-semibold tabular-nums">
            {feature.num} · {feature.eyebrow}
          </div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-700 text-white shadow-[0_12px_30px_-12px_rgba(5,150,105,0.6)]">
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </div>
        </div>
      </div>

      <div className="col-span-12 md:col-span-6">
        <h3 className="text-2xl md:text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-emerald-950">
          {feature.title}
        </h3>
        <p className="mt-4 text-[15px] md:text-base text-emerald-900 leading-relaxed max-w-lg">
          {feature.body}
        </p>
      </div>

      <div className="col-span-12 md:col-span-3">
        <ul className="space-y-3">
          {feature.bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2.5 text-[13.5px] text-emerald-900"
            >
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" strokeWidth={2.5} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/* =================================================================== */
/*  Product preview — faux dashboard mock                               */
/* =================================================================== */

function ProductPreview() {
  return (
    <section className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <SectionEyebrow>See it in motion</SectionEyebrow>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-[1.05] tracking-[-0.025em] text-emerald-950">
            Every channel, every flow,{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 bg-clip-text text-transparent">
              one workspace.
            </span>
          </h2>
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div
            aria-hidden
            className="absolute -inset-10 rounded-[40px] opacity-60 blur-3xl"
            style={{
              background:
                'radial-gradient(ellipse at top, rgba(16,185,129,0.35), transparent 70%)',
            }}
          />
          <div
            className="relative rounded-[28px] border border-emerald-200/70 overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%)',
              boxShadow:
                '0 50px 120px -30px rgba(6,78,59,0.35), 0 0 0 1px rgba(255,255,255,0.6) inset',
            }}
          >
            {/* window chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-emerald-200/70 bg-white/40">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div className="ml-4 text-[11px] text-emerald-800 font-medium">
                app.sabnode.io / workspace
              </div>
            </div>

            {/* dashboard body */}
            <div className="grid grid-cols-12 gap-0">
              {/* sidebar */}
              <div className="col-span-3 border-r border-emerald-200/70 p-4 hidden md:block">
                {['Inbox', 'Flows', 'CRM', 'Broadcasts', 'AI', 'Analytics'].map((item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 mb-1 text-[13px] ${
                      i === 0
                        ? 'bg-emerald-100 text-emerald-900 font-semibold'
                        : 'text-emerald-900'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>

              {/* main */}
              <div className="col-span-12 md:col-span-9 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-700 font-semibold">
                      Conversations
                    </div>
                    <div className="text-xl font-semibold text-emerald-950 mt-1">
                      All Inboxes
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-20 rounded-full bg-emerald-100" />
                    <span className="h-8 w-8 rounded-full bg-emerald-600" />
                  </div>
                </div>

                {/* mini stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { k: 'Open', v: '142', d: '+12%' },
                    { k: 'Waiting', v: '38', d: '−8%' },
                    { k: 'Resolved', v: '1.2k', d: '+24%' },
                  ].map((s) => (
                    <div
                      key={s.k}
                      className="rounded-xl border border-emerald-200/70 bg-white/70 p-3"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-emerald-700">
                        {s.k}
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <div className="text-lg font-semibold text-emerald-950 tabular-nums">
                          {s.v}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          {s.d}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* rows */}
                <div className="rounded-xl border border-emerald-200/70 bg-white/70 divide-y divide-emerald-200/70">
                  {[
                    { n: 'Priya Shah', m: 'Is the discount still valid for the large size?', t: '2m', c: 'bg-emerald-500' },
                    { n: 'Jordan M.', m: 'Great — send me the invoice please', t: '6m', c: 'bg-teal-500' },
                    { n: 'Lee Park', m: 'Hi! Need help setting up a flow.', t: '12m', c: 'bg-lime-500' },
                    { n: 'Ama K.', m: 'Thanks, resolved on my end.', t: '34m', c: 'bg-emerald-600' },
                  ].map((r) => (
                    <div
                      key={r.n}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className={`h-8 w-8 rounded-full ${r.c}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-[13px] font-semibold text-emerald-950">
                            {r.n}
                          </div>
                          <div className="text-[11px] text-emerald-700 tabular-nums">
                            {r.t}
                          </div>
                        </div>
                        <div className="text-[12.5px] text-emerald-900 truncate">
                          {r.m}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Module marquee                                                      */
/* =================================================================== */

const MODULES = [
  'Inbox',
  'WhatsApp API',
  'Chatbot',
  'CRM',
  'Flows',
  'Broadcasts',
  'Templates',
  'Contacts',
  'Automations',
  'Integrations',
  'Webhooks',
  'Analytics',
];

function ModuleMarquee() {
  return (
    <section className="relative py-12 md:py-16 overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <SectionEyebrow>12 modules, 1 platform</SectionEyebrow>
          <h2 className="mt-4 text-2xl md:text-3xl font-semibold tracking-[-0.02em] text-emerald-950">
            Everything you'd normally glue together.
          </h2>
        </div>
      </div>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-[#f0fdf4] to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-[#f0fdf4] to-transparent"
        />
        <div className="flex gap-3 landing-marquee will-change-transform">
          {[...MODULES, ...MODULES].map((m, i) => (
            <span
              key={`${m}-${i}`}
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/70 px-5 py-2.5 text-sm font-medium text-emerald-900 whitespace-nowrap backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
              {m}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes landing-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .landing-marquee {
          animation: landing-marquee 40s linear infinite;
          width: max-content;
        }
      `}</style>
    </section>
  );
}

/* =================================================================== */
/*  Stack comparison — before / after                                   */
/* =================================================================== */

const STACK_BEFORE = [
  'Help Scout / Zendesk',
  'HubSpot or Salesforce',
  'Zapier / Make',
  'Mailchimp or Klaviyo',
  'Live chat widget',
  'AI chatbot tool',
  'Forms + spreadsheets',
  'Slack for handoffs',
];

const STACK_AFTER = [
  'SabNode Inbox',
  'SabNode CRM',
  'SabNode Flows',
  'SabNode Broadcasts',
  'SabNode Widget',
  'SabNode AI',
  'SabNode Contacts',
  'SabNode — all of it',
];

function StackComparison() {
  return (
    <section className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <SectionEyebrow>Replace the stack</SectionEyebrow>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-[1.05] tracking-[-0.025em] text-emerald-950">
            Eight subscriptions become{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 bg-clip-text text-transparent">
              one bill.
            </span>
          </h2>
          <p className="mt-4 text-base md:text-[17px] text-emerald-900">
            Here's what most teams glue together today — and what SabNode
            replaces it with.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-10 max-w-5xl mx-auto">
          {/* before */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-rose-700 font-semibold mb-5">
              Before · The duct-taped stack
            </div>
            <ul className="space-y-3">
              {STACK_BEFORE.map((s) => (
                <li
                  key={s}
                  className="flex items-center gap-3 text-[15px] text-emerald-900 line-through decoration-rose-300/60 decoration-2"
                >
                  <span className="h-6 w-6 inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500">
                    <Minus className="h-3 w-3" />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* after */}
          <div className="md:border-l md:border-emerald-200/70 md:pl-10">
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 font-semibold mb-5">
              After · One connected platform
            </div>
            <ul className="space-y-3">
              {STACK_AFTER.map((s) => (
                <li
                  key={s}
                  className="flex items-center gap-3 text-[15px] font-medium text-emerald-950"
                >
                  <span className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Integrations grid                                                   */
/* =================================================================== */

const INTEGRATIONS = [
  { name: 'WhatsApp', icon: MessageSquare },
  { name: 'Shopify', icon: CircleDollarSign },
  { name: 'Stripe', icon: CircleDollarSign },
  { name: 'Slack', icon: MessageSquare },
  { name: 'Google', icon: Globe },
  { name: 'Meta', icon: Globe },
  { name: 'Zapier', icon: Zap },
  { name: 'Notion', icon: Layers },
  { name: 'HubSpot', icon: HeartHandshake },
  { name: 'Postgres', icon: Database },
  { name: 'OpenAI', icon: Cpu },
  { name: 'Webhook', icon: Workflow },
];

function IntegrationsGrid() {
  return (
    <section className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-12 gap-10 md:gap-16 items-center">
          <div className="md:col-span-5">
            <SectionEyebrow>Integrations</SectionEyebrow>
            <h2 className="mt-4 text-3xl md:text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-emerald-950">
              Plays nicely with{' '}
              <span className="text-emerald-700">what you already use.</span>
            </h2>
            <p className="mt-4 text-base text-emerald-900 max-w-md">
              Native connectors for WhatsApp Cloud API, Shopify, Stripe, Slack,
              Notion, OpenAI and more — plus a webhook layer for everything
              else.
            </p>
            <div className="mt-6 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-emerald-900">
                <Shield className="h-4 w-4 text-emerald-600" />
                SOC2 ready
              </div>
              <div className="flex items-center gap-2 text-emerald-900">
                <Lock className="h-4 w-4 text-emerald-600" />
                GDPR compliant
              </div>
            </div>
          </div>

          <div className="md:col-span-7">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {INTEGRATIONS.map((i, idx) => {
                const Icon = i.icon;
                return (
                  <div
                    key={i.name + idx}
                    className="aspect-square rounded-2xl border border-emerald-200/60 bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-emerald-900 transition-all hover:bg-white hover:-translate-y-0.5 hover:border-emerald-300"
                  >
                    <Icon className="h-5 w-5 text-emerald-700" strokeWidth={1.8} />
                    <div className="text-[11px] font-semibold tracking-[-0.01em]">
                      {i.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Quote block                                                         */
/* =================================================================== */

function QuoteBlock() {
  return (
    <section className="relative py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <SectionEyebrow>Our philosophy</SectionEyebrow>
          <blockquote className="mt-5 text-3xl md:text-[44px] font-medium leading-[1.12] tracking-[-0.02em] text-emerald-950">
            Modern businesses don't fail for lack of ideas.{' '}
            <span className="text-emerald-700">
              They fail because manual execution can't keep up with growth.
            </span>
          </blockquote>
          <div className="mt-8 inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-emerald-700 font-semibold">
            <span className="h-px w-12 bg-emerald-300" />
            Proof over promise
            <span className="h-px w-12 bg-emerald-300" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Testimonials                                                        */
/* =================================================================== */

const TESTIMONIALS = [
  {
    quote:
      'We cut three tools from our stack and moved to SabNode in a weekend. Our reply time dropped from hours to under ninety seconds.',
    name: 'Priya Raghavan',
    role: 'COO, Folia',
    avatar: 'from-emerald-400 to-teal-500',
  },
  {
    quote:
      "The flow builder is the first no-code tool that actually scales past the toy phase. It quietly runs our entire post-sale journey now.",
    name: 'Marco DeLuca',
    role: 'Head of Ops, NorthPeak',
    avatar: 'from-lime-400 to-emerald-500',
  },
  {
    quote:
      'What sold us was the AI layer feeling genuinely private. Grounded on our data, never leaking — and the answers were better than our old bot.',
    name: 'Hana Tanaka',
    role: 'CTO, Lumenly',
    avatar: 'from-teal-400 to-cyan-500',
  },
];

function Testimonials() {
  return (
    <section className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <SectionEyebrow>What customers say</SectionEyebrow>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-[1.05] tracking-[-0.025em] text-emerald-950">
            Teams that{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 bg-clip-text text-transparent">
              ship faster
            </span>{' '}
            after the switch.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="relative">
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-emerald-500 text-emerald-500"
                  />
                ))}
              </div>
              <blockquote className="text-[17px] leading-relaxed text-emerald-950 font-medium tracking-[-0.005em]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 pt-4 border-t border-emerald-200/70 flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.avatar}`}
                />
                <div>
                  <div className="text-[13px] font-semibold text-emerald-950">
                    {t.name}
                  </div>
                  <div className="text-[12px] text-emerald-800">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Audience                                                            */
/* =================================================================== */

const AUDIENCE = [
  'Small & medium business',
  'Marketing agencies',
  'E-commerce brands',
  'Coaches & creators',
  'Internal ops teams',
  'AI & automation learners',
];

function AudienceRow() {
  return (
    <section className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-12 md:col-span-5">
            <SectionEyebrow>Who it's for</SectionEyebrow>
            <h2 className="mt-4 text-3xl md:text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-emerald-950">
              Built for operators,{' '}
              <span className="text-emerald-700">not theorists.</span>
            </h2>
            <p className="mt-4 text-base text-emerald-900 max-w-md">
              If you run a team, a funnel or a shop, SabNode is the system that
              absorbs the drudgery so you can focus on the work that moves the
              number.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex h-11 items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950 transition-colors group"
            >
              Start free beta
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          <div className="col-span-12 md:col-span-7">
            <ul className="divide-y divide-emerald-200/70 border-y border-emerald-200/70">
              {AUDIENCE.map((name, i) => (
                <li
                  key={name}
                  className="group flex items-center justify-between py-5 transition-colors hover:text-emerald-700"
                >
                  <div className="flex items-center gap-5">
                    <span className="text-[11px] tabular-nums font-semibold text-emerald-600">
                      0{i + 1}
                    </span>
                    <span className="text-lg md:text-xl font-medium tracking-[-0.01em] text-emerald-950 group-hover:text-emerald-700 transition-colors">
                      {name}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-emerald-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Pricing teaser                                                      */
/* =================================================================== */

const TIERS = [
  {
    name: 'Starter',
    price: '$0',
    cadence: '/ forever',
    tagline: 'For solo builders getting started.',
    features: ['1 project', '3 active flows', '500 messages / mo', 'Community support'],
    highlight: false,
  },
  {
    name: 'Growth',
    price: '$49',
    cadence: '/ month',
    tagline: 'For teams running their business on it.',
    features: [
      'Unlimited projects',
      'Unlimited flows',
      '25k messages / mo',
      'AI layer included',
      'Priority support',
    ],
    highlight: true,
  },
  {
    name: 'Scale',
    price: 'Custom',
    cadence: '',
    tagline: 'For high-volume and regulated teams.',
    features: [
      'Dedicated infra',
      'SSO & audit logs',
      'Custom data residency',
      'Slack-connect support',
    ],
    highlight: false,
  },
];

function PricingTeaser() {
  return (
    <section id="pricing" className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <SectionEyebrow>Pricing</SectionEyebrow>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold leading-[1.05] tracking-[-0.025em] text-emerald-950">
            Simple plans.{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 bg-clip-text text-transparent">
              Grow with you.
            </span>
          </h2>
          <p className="mt-4 text-base md:text-[17px] text-emerald-900">
            Start free. Upgrade when a flow starts making you money.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-3xl p-8 flex flex-col ${
                tier.highlight
                  ? 'text-white'
                  : 'text-emerald-950 bg-white/60 border border-emerald-200/70 backdrop-blur-sm'
              }`}
              style={
                tier.highlight
                  ? {
                      background:
                        'linear-gradient(155deg, #065f46 0%, #047857 50%, #059669 100%)',
                      boxShadow:
                        '0 30px 70px -25px rgba(6,78,59,0.55), 0 0 0 1px rgba(255,255,255,0.15) inset',
                    }
                  : undefined
              }
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-lime-300 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-900">
                  <Sparkles className="h-3 w-3" />
                  Most popular
                </div>
              )}
              <div
                className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${
                  tier.highlight ? 'text-emerald-200' : 'text-emerald-700'
                }`}
              >
                {tier.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <div className="text-4xl md:text-5xl font-semibold tracking-[-0.025em] tabular-nums">
                  {tier.price}
                </div>
                {tier.cadence && (
                  <div
                    className={`text-sm ${
                      tier.highlight ? 'text-emerald-200/80' : 'text-emerald-800'
                    }`}
                  >
                    {tier.cadence}
                  </div>
                )}
              </div>
              <div
                className={`mt-3 text-sm ${
                  tier.highlight ? 'text-emerald-100/80' : 'text-emerald-900'
                }`}
              >
                {tier.tagline}
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-[13.5px] ${
                      tier.highlight ? 'text-emerald-100' : 'text-emerald-900'
                    }`}
                  >
                    <Check
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                        tier.highlight ? 'text-lime-300' : 'text-emerald-600'
                      }`}
                      strokeWidth={2.5}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform hover:scale-[1.02] ${
                  tier.highlight
                    ? 'bg-white text-emerald-900 hover:bg-emerald-50'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {tier.price === 'Custom' ? 'Talk to us' : 'Get started'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  FAQ                                                                 */
/* =================================================================== */

const FAQS = [
  {
    q: 'How long does it take to get set up?',
    a: 'Most teams are live in 10–30 minutes. Connect your channel, import contacts, and start with a template flow. No onboarding call required.',
  },
  {
    q: 'Do I need to migrate away from my current tools?',
    a: "No. SabNode can sit next to your existing stack, or replace parts of it gradually. Every module has native import and a webhook fallback.",
  },
  {
    q: 'Is my data used to train your models?',
    a: 'Never. The AI layer is tenant-scoped: each workspace gets private context, and nothing you feed it is used to train shared models.',
  },
  {
    q: "Can I self-host or pick a region?",
    a: 'Yes — on the Scale plan. Choose EU, US or India residency, or deploy into your own cluster with our installer.',
  },
  {
    q: 'What if I outgrow the free plan?',
    a: 'Upgrading is instant, pro-rated, and reversible. You keep all your flows, contacts and history when you move tiers.',
  },
];

function FaqSection() {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section id="faq" className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="mt-4 text-3xl md:text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-emerald-950">
              Questions, answered.
            </h2>
            <p className="mt-4 text-base text-emerald-900 max-w-sm">
              Something still unclear? Reach out — a human replies within a few
              hours.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex h-11 items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950 transition-colors group"
            >
              Contact support
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          <div className="md:col-span-8">
            <ul className="divide-y divide-emerald-200/70 border-y border-emerald-200/70">
              {FAQS.map((f, i) => {
                const isOpen = open === i;
                return (
                  <li key={f.q}>
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-6 py-6 text-left group"
                      aria-expanded={isOpen}
                    >
                      <span className="text-lg md:text-xl font-medium tracking-[-0.01em] text-emerald-950 group-hover:text-emerald-700 transition-colors">
                        {f.q}
                      </span>
                      <span
                        className={`flex-shrink-0 h-9 w-9 rounded-full border border-emerald-200 inline-flex items-center justify-center transition-all ${
                          isOpen
                            ? 'bg-emerald-600 text-white rotate-180'
                            : 'bg-white text-emerald-700'
                        }`}
                      >
                        {isOpen ? (
                          <Minus className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </span>
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        isOpen
                          ? 'grid-rows-[1fr] opacity-100 pb-6'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden text-[15px] text-emerald-900 leading-relaxed max-w-2xl">
                        {f.a}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  CTA banner                                                          */
/* =================================================================== */

function CTABanner() {
  return (
    <section className="relative py-14 md:py-20">
      <div className="container mx-auto px-6">
        <div
          className="relative rounded-[32px] px-8 py-16 md:px-16 md:py-24 text-center overflow-hidden"
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
            style={{
              background:
                'radial-gradient(circle, #10b981 0%, rgba(16,185,129,0) 60%)',
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -right-32 h-[440px] w-[440px] rounded-full opacity-60"
            style={{
              background:
                'radial-gradient(circle, #6ee7b7 0%, rgba(110,231,183,0) 60%)',
            }}
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

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white mb-7">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              Join the SabNode beta
            </div>

            <h2 className="text-3xl md:text-[56px] font-semibold leading-[1.04] tracking-[-0.025em] text-white max-w-3xl mx-auto">
              Launch your stack.{' '}
              <span className="text-emerald-300/80">Watch it run.</span>
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
                href="#features"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-8 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                See what it does
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-emerald-100/60">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                No credit card
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-300" />
                10-minute setup
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  Shared primitives                                                   */
/* =================================================================== */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
      {children}
    </div>
  );
}
