'use client';

/**
 * 12 module sections.
 *
 * Each section renders a module's marketing copy alongside a glossy emerald
 * "fruit" card. No tree SVG — just content on the green theme.
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { MODULES, type ModuleDef } from './modules';
import { MODULE_CONTENT, type ModuleContent } from './module-content';

gsap.registerPlugin(ScrollTrigger, SplitText);

/* =================================================================== */
/*  Intro                                                               */
/* =================================================================== */

export function ModuleDetailSections() {
  const introTitleRef = React.useRef<HTMLHeadingElement>(null);

  React.useLayoutEffect(() => {
    const el = introTitleRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const split = new SplitText(el, { type: 'chars,words,lines' });
      gsap.set(split.chars, { opacity: 0, y: 60, rotateX: -60 });
      gsap.to(split.chars, {
        opacity: 1,
        y: 0,
        rotateX: 0,
        stagger: 0.015,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 80%', once: true },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div id="modules" className="relative">
      <div className="container mx-auto px-6 pt-8 pb-4 text-center">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-3.5 py-1.5 text-[11px] font-semibold text-emerald-800"
          style={{
            backdropFilter: 'blur(12px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.5)',
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
          <span className="uppercase tracking-[0.08em]">The modules</span>
        </div>
        <h2
          ref={introTitleRef}
          className="mt-5 text-3xl md:text-4xl lg:text-[44px] font-semibold leading-[1.08] tracking-[-0.02em] text-emerald-950 max-w-2xl mx-auto"
          style={{ perspective: '1000px' }}
        >
          Twelve modules. One connected system.
        </h2>
        <p className="mt-4 text-base md:text-lg text-emerald-900/70 max-w-xl mx-auto leading-relaxed">
          Scroll on. Each module reveals itself as it enters view.
        </p>
      </div>

      {MODULES.map((m, i) => (
        <ModuleBranch
          key={m.id}
          module={m}
          index={i}
          align={i % 2 === 0 ? 'left' : 'right'}
        />
      ))}
    </div>
  );
}

/* =================================================================== */
/*  ModuleBranch                                                        */
/* =================================================================== */

function ModuleBranch({
  module: m,
  index,
  align,
}: {
  module: ModuleDef;
  index: number;
  align: 'left' | 'right';
}) {
  const content = MODULE_CONTENT[m.id];

  const sectionRef = React.useRef<HTMLElement>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const textBlockRef = React.useRef<HTMLDivElement>(null);
  const bulletsRef = React.useRef<HTMLUListElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const counterRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      /* card entrance + scrub tilt */
      if (cardRef.current) {
        gsap.set(cardRef.current, {
          opacity: 0, y: 60, rotateX: 14, scale: 0.88,
        });
        gsap.to(cardRef.current, {
          opacity: 1, y: 0, rotateX: 0, scale: 1,
          duration: 1.1, delay: 0.5, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 72%', once: true },
        });
        gsap.to(cardRef.current, {
          rotateX: -6, y: -24,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.2,
          },
        });
      }

      /* heading char flip */
      if (headingRef.current) {
        const split = new SplitText(headingRef.current, { type: 'chars,words' });
        gsap.set(split.chars, { opacity: 0, y: 60, rotateX: -60 });
        gsap.to(split.chars, {
          opacity: 1, y: 0, rotateX: 0,
          stagger: 0.02, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 75%', once: true },
        });
      }

      /* text block + bullets stagger */
      if (textBlockRef.current) {
        const items = textBlockRef.current.querySelectorAll('[data-reveal]');
        gsap.set(items, { opacity: 0, y: 30 });
        gsap.to(items, {
          opacity: 1, y: 0,
          stagger: 0.08, duration: 0.7, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 72%', once: true },
        });
      }
      if (bulletsRef.current) {
        const bullets = bulletsRef.current.children;
        gsap.set(bullets, { opacity: 0, x: -20 });
        gsap.to(bullets, {
          opacity: 1, x: 0,
          stagger: 0.08, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 70%', once: true },
        });
      }

      /* metric counter tween */
      if (counterRef.current) {
        const target = content.metric.value;
        const match = target.match(/^([+\-−]?)([\d]+(?:\.[\d]+)?)(.*)$/);
        if (match) {
          const prefix = match[1] || '';
          const end = parseFloat(match[2]);
          const suffix = match[3] || '';
          const hasDecimal = match[2].includes('.');
          const obj = { v: 0 };
          gsap.to(obj, {
            v: end,
            duration: 1.6,
            ease: 'power2.out',
            scrollTrigger: { trigger: section, start: 'top 72%', once: true },
            onUpdate: () => {
              if (!counterRef.current) return;
              counterRef.current.textContent =
                prefix +
                (hasDecimal
                  ? obj.v.toFixed(1)
                  : Math.round(obj.v).toLocaleString()) +
                suffix;
            },
          });
        }
      }
    }, section);

    return () => ctx.revert();
  }, [content.metric.value, align]);

  const num = String(index + 1).padStart(2, '0');

  const textBlock = (
    <div ref={textBlockRef} className="max-w-md">
      <div data-reveal className="flex items-center gap-3">
        <div className="font-mono text-[11px] text-emerald-700 tabular-nums">
          {num} / 12
        </div>
        <div className="h-px w-12 bg-emerald-300" />
        <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700/70">
          Module
        </div>
      </div>

      <h3
        ref={headingRef}
        data-reveal
        className="mt-5 text-3xl md:text-4xl lg:text-[44px] font-semibold leading-[1.08] tracking-[-0.02em] text-emerald-950"
        style={{ perspective: '1000px' }}
      >
        {m.label}
      </h3>

      <p
        data-reveal
        className="mt-3 text-lg md:text-[19px] font-medium"
        style={{ color: m.dark }}
      >
        {content.tagline}
      </p>
      <p
        data-reveal
        className="mt-4 text-[15px] text-emerald-900/70 leading-relaxed"
      >
        {content.description}
      </p>

      <ul ref={bulletsRef} className="mt-7 space-y-3">
        {content.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[14.5px] text-emerald-900/85">
            <span
              className="flex-shrink-0 mt-0.5 h-[18px] w-[18px] rounded-full flex items-center justify-center"
              style={{ background: `${m.color}22`, color: m.color }}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            {b}
          </li>
        ))}
      </ul>

      <div data-reveal>
        <Link
          href="/signup"
          className="mt-8 group inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          style={{
            background: `linear-gradient(135deg, ${m.color} 0%, ${m.dark} 100%)`,
            boxShadow: `0 14px 30px -8px ${m.color}aa`,
          }}
        >
          Try {m.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );

  const cardBlock = (
    <div className="relative flex justify-center" style={{ perspective: '1400px' }}>
      <div
        ref={cardRef}
        className="will-change-transform"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <FruitCard module={m} content={content} counterRef={counterRef as any} />
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[80vh] flex items-center py-20 md:py-28"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 900px' }}
    >
      {/* tinted module-color background glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[680px] w-[680px] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle at center, ${m.color}22 0%, ${m.color}0d 40%, transparent 70%)`,
            [align === 'left' ? 'left' : 'right']: '-8%',
          }}
        />
      </div>

      {/* content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {align === 'left' ? (
            <>
              {cardBlock}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {cardBlock}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* =================================================================== */
/*  FruitCard — glossy green module card at the branch tip              */
/* =================================================================== */

function FruitCard({
  module: m,
  content,
  counterRef,
}: {
  module: ModuleDef;
  content: ModuleContent;
  counterRef: React.RefObject<HTMLDivElement>;
}) {
  const Icon = m.icon;
  return (
    <div
      className="relative w-[min(92vw,420px)]"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div
        className="relative rounded-[32px] p-7 md:p-8 overflow-hidden"
        style={{
          background:
            'linear-gradient(155deg, rgba(240,253,244,0.92) 0%, rgba(209,250,229,0.58) 100%)',
          backdropFilter: 'blur(14px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.8)',
          border: '1px solid rgba(167, 243, 208, 0.7)',
          boxShadow: `
            0 40px 80px -25px rgba(6, 78, 59, 0.25),
            0 15px 30px -10px rgba(6, 78, 59, 0.12),
            0 0 0 1px rgba(255, 255, 255, 0.7) inset,
            0 1px 0 0 rgba(255, 255, 255, 1) inset
          `,
        }}
      >
        <div
          aria-hidden
          className="absolute -inset-6 -z-10 rounded-[38px] opacity-60 blur-2xl"
          style={{
            background: `radial-gradient(circle at 50% 40%, ${m.color}55, transparent 70%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[32px] opacity-80"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 38%)',
          }}
        />

        <div className="relative flex items-start justify-between mb-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {content.status}
          </div>
          <div className="text-right">
            <div
              ref={counterRef}
              className="text-[38px] md:text-[42px] font-semibold leading-none tabular-nums tracking-[-0.02em]"
              style={{ color: m.dark }}
            >
              {content.metric.value}
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-emerald-700/70 mt-1.5">
              {content.metric.label}
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center my-5">
          <div
            className="relative h-[120px] w-[120px] rounded-[32px] flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${m.color} 0%, ${m.dark} 100%)`,
              boxShadow: `
                0 24px 48px -12px ${m.color}aa,
                0 8px 20px -8px ${m.dark}88,
                0 0 0 1px rgba(255,255,255,0.5) inset,
                0 1px 0 0 rgba(255,255,255,0.9) inset
              `,
            }}
          >
            <div
              aria-hidden
              className="absolute -inset-3 rounded-[38px] blur-xl opacity-60"
              style={{ background: m.color }}
            />
            <div
              aria-hidden
              className="absolute inset-0 rounded-[32px] opacity-50"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 55%)',
              }}
            />
            <Icon className="relative h-14 w-14 text-white" strokeWidth={1.8} />
          </div>
        </div>

        <div className="relative text-center mt-2">
          <div className="text-[20px] font-semibold text-emerald-950 tracking-[-0.01em]">
            {m.label}
          </div>
          <div className="text-[13px] text-emerald-800/70 mt-1">
            {content.tagline}
          </div>
        </div>

        <div className="relative mt-6 pt-5 border-t border-emerald-200/50 grid grid-cols-3 gap-3">
          {content.rows.slice(0, 3).map((r, i) => (
            <div key={i} className="text-center min-w-0">
              <div
                className="text-[11px] font-semibold text-emerald-950 truncate"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {r.right}
              </div>
              <div className="text-[9px] text-emerald-700/70 uppercase tracking-wider mt-0.5 truncate">
                {r.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
