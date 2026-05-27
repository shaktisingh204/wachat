'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Hero — text, CTAs, proof row. Emerald color theme.
 *
 * Animations use pre-wrapped spans in the JSX (no runtime DOM mutation)
 * and `fromTo` with `clearProps` so that even if a tween is interrupted
 * the final state is always the natural HTML — nothing can end up
 * stuck at `opacity: 0`.
 */
export function Hero() {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const chipRef = React.useRef<HTMLDivElement>(null);
  const headlineRef = React.useRef<HTMLHeadingElement>(null);
  const subRef = React.useRef<HTMLParagraphElement>(null);
  const ctasRef = React.useRef<HTMLDivElement>(null);
  const proofRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      /* word-level headline reveal (pre-wrapped in JSX) */
      const words = headlineRef.current?.querySelectorAll('.hero-word');
      if (words && words.length) {
        gsap.fromTo(
          words,
          {
            opacity: 0,
            y: 50,
            rotateX: -60,
            transformPerspective: 900,
            transformOrigin: '0 100%',
          },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            stagger: 0.09,
            duration: 0.95,
            ease: 'power3.out',
            delay: 0.35,
            clearProps: 'transform',
          }
        );
      }

      /* chip */
      if (chipRef.current) {
        gsap.fromTo(
          chipRef.current,
          { opacity: 0, y: 20, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            ease: 'power3.out',
            delay: 0.15,
            clearProps: 'transform',
          }
        );
      }

      /* subtitle */
      if (subRef.current) {
        gsap.fromTo(
          subRef.current,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            delay: 0.75,
            clearProps: 'transform',
          }
        );
      }

      /* CTAs — stagger children */
      if (ctasRef.current) {
        const ctaChildren = Array.from(ctasRef.current.children) as HTMLElement[];
        gsap.fromTo(
          ctaChildren,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.65,
            ease: 'power3.out',
            delay: 0.95,
            clearProps: 'transform',
          }
        );
      }

      /* proof row */
      if (proofRef.current) {
        gsap.fromTo(
          proofRef.current,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            delay: 1.15,
            clearProps: 'transform',
          }
        );
      }

      /* headline parallax on scroll past */
      if (headlineRef.current && rootRef.current) {
        gsap.to(headlineRef.current, {
          y: -60,
          opacity: 0.55,
          ease: 'none',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
          },
        });
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative min-h-[90vh] flex items-center pt-16 pb-10 overflow-hidden"
    >
      {/* soft emerald ambient glows */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[10%] left-1/2 -translate-x-1/2 h-[520px] w-[900px] max-w-[120vw] rounded-full blur-3xl opacity-60"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(167,243,208,0.55) 0%, rgba(110,231,183,0.25) 35%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-[35%] left-[8%] h-[320px] w-[320px] rounded-full blur-3xl opacity-40"
          style={{ background: 'radial-gradient(circle, #6ee7b7 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[40%] right-[8%] h-[320px] w-[320px] rounded-full blur-3xl opacity-40"
          style={{ background: 'radial-gradient(circle, #a7f3d0 0%, transparent 70%)' }}
        />
      </div>

      {/* ---------- content ---------- */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center pt-20 md:pt-24">
          <div
            ref={chipRef}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/85 px-4 py-1.5 text-xs font-medium text-emerald-900"
            style={{
              backdropFilter: 'blur(12px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(12px) saturate(1.6)',
              boxShadow:
                '0 10px 30px -12px rgba(6, 78, 59, 0.25), 0 0 0 1px rgba(255,255,255,0.6) inset',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>One platform. 12 modules. Grows with you.</span>
          </div>

          <h1
            ref={headlineRef}
            className="mt-7 text-4xl md:text-5xl lg:text-[56px] font-semibold leading-[1.05] tracking-[-0.025em] text-emerald-950"
            style={{ perspective: '1000px' }}
          >
            <span className="hero-word inline-block">One</span>{' '}
            <span className="hero-word inline-block">platform</span>{' '}
            <span className="hero-word inline-block">that</span>{' '}
            <span className="hero-word inline-block bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 bg-clip-text text-transparent">
              runs your business.
            </span>
          </h1>

          <p
            ref={subRef}
            className="mt-6 max-w-xl mx-auto text-base md:text-lg text-emerald-900 leading-relaxed"
          >
            Twelve modules — Inbox, WhatsApp, Chatbot, CRM, Flows and more —
            all connected inside one system, working together from day one.
          </p>

          <div
            ref={ctasRef}
            className="mt-9 flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              href="/signup"
              className="group relative inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-7 text-sm font-semibold text-white overflow-hidden shadow-[0_14px_30px_-8px_rgba(5,150,105,0.6)] transition-transform hover:scale-[1.03]"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 opacity-0 transition-opacity group-hover:opacity-100"
              />
              <span className="relative">Start free beta</span>
              <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#features"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-7 text-sm font-semibold text-emerald-900 transition-all hover:bg-white hover:border-emerald-300"
              style={{
                backdropFilter: 'blur(10px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(10px) saturate(1.6)',
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                <Play className="h-3 w-3 fill-current" />
              </span>
              Explore features
            </Link>
          </div>

          <div
            ref={proofRef}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5 text-xs text-emerald-800"
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[
                  'from-emerald-400 to-teal-500',
                  'from-green-400 to-emerald-500',
                  'from-teal-400 to-cyan-500',
                  'from-lime-400 to-green-500',
                  'from-emerald-500 to-green-600',
                ].map((g, i) => (
                  <div
                    key={i}
                    className={`h-7 w-7 rounded-full border-2 border-white bg-gradient-to-br ${g} shadow-sm`}
                  />
                ))}
              </div>
              <span>
                <span className="font-semibold text-emerald-900">500+</span>{' '}
                teams growing with us
              </span>
            </div>
            <span className="hidden sm:block h-3 w-px bg-emerald-300" />
            <div>No credit card · Setup in 10 minutes</div>
          </div>
        </div>
      </div>
    </section>
  );
}
