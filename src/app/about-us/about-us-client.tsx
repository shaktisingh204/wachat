'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { LandingHeader } from '@/components/landing/landing-header';
import { Activity, ArrowLeft, Clock } from 'lucide-react';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardBody,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
  StatCard,
} from '@/components/sabcrm/20ui';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollToPlugin, useGSAP);
}

const TEAM_MEMBERS = [
  { name: 'Alice Smith', role: 'Lead Architect', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', init: 'AS' },
  { name: 'Bob Jones', role: 'Head of Reliability', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d', init: 'BJ' },
  { name: 'Charlie Davis', role: 'Security Engineer', avatar: 'https://i.pravatar.cc/150?u=a04258114e29026702d', init: 'CD' },
];

const NAV_ITEMS = [
  { id: '#abstract', label: '1.0 Abstract' },
  { id: '#mission', label: '2.0 Mission' },
  { id: '#architecture', label: '3.0 Architecture' },
  { id: '#endpoints', label: '4.0 Capabilities' },
  { id: '#team', label: '5.0 Team' },
  { id: '#metrics', label: '6.0 Metrics' },
];

export function AboutUsClient() {
  const container = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ requests: 15420000, uptime: 99.99 });
  const [activeHash, setActiveHash] = useState('');

  const { contextSafe } = useGSAP(() => {
    // Animate team members on load
    gsap.from('.team-member', {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.8,
      ease: 'power2.out',
    });

    // Simulate live metrics
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        requests: prev.requests + Math.floor(Math.random() * 100),
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, { scope: container });

  const handleNavClick = contextSafe((e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = e.currentTarget.getAttribute('href');
    if (target && target.startsWith('#')) {
      e.preventDefault();
      setActiveHash(target);
      // Adding accessibility focus
      const targetElement = document.querySelector(target) as HTMLElement;
      if (targetElement) {
        targetElement.focus({ preventScroll: true });
      }
      gsap.to(window, { duration: 0.8, scrollTo: target, ease: 'power3.inOut' });
      // Update URL hash for screen readers/history
      window.history.pushState(null, '', target);
    }
  });

  return (
    <div
      ref={container}
      className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] font-mono selection:bg-[var(--st-text)] selection:text-[var(--st-bg)]"
    >
      <LandingHeader />
      <div className="flex w-full">
        {/* Sidebar mimicking OpenAPI docs */}
        <aside className="hidden lg:block w-64 border-r border-[var(--st-border)] p-6 h-[calc(100vh-64px)] sticky top-16 overflow-y-auto">
          <nav aria-label="About Us Navigation" className="space-y-4 text-sm">
            <div className="font-bold uppercase tracking-widest text-[var(--st-text-tertiary)] mb-2">/docs/about</div>
            <ul className="space-y-2 text-[var(--st-text-secondary)]" role="menu">
              {NAV_ITEMS.map((navItem) => (
                <li key={navItem.id} role="none">
                  <a
                    href={navItem.id}
                    onClick={handleNavClick}
                    role="menuitem"
                    aria-current={activeHash === navItem.id ? 'true' : undefined}
                    aria-label={`Navigate to ${navItem.label}`}
                    className={`block rounded-[var(--st-radius)] px-2 py-1 transition-colors hover:text-[var(--st-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] ${
                      activeHash === navItem.id ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)]' : ''
                    }`}
                  >
                    {navItem.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link href="/" aria-label="Return to Root">
                <Button variant="outline" size="sm" iconLeft={ArrowLeft} className="uppercase tracking-wider">
                  Return to Root
                </Button>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Content mimicking technical whitepaper */}
        <main
          className="flex-1 max-w-4xl px-6 py-12 lg:px-12 mx-auto focus:outline-none"
          tabIndex={-1}
          aria-label="Main Content"
        >
          <article className="max-w-none">
            <PageHeader className="mb-8">
              <PageHeaderHeading>
                <PageTitle className="uppercase">SabNode Specification</PageTitle>
                <div className="mt-3 flex flex-wrap gap-2 text-sm uppercase tracking-wider">
                  <Badge tone="neutral" kind="outline">Version: 1.0.0</Badge>
                  <Badge tone="success" kind="outline">Status: Active</Badge>
                  <Badge tone="neutral" kind="outline">Classification: Public</Badge>
                </div>
              </PageHeaderHeading>
              <PageActions />
            </PageHeader>

            <section id="abstract" className="mb-12 scroll-mt-24" tabIndex={-1}>
              <h2 className="mb-6 border-l-4 border-[var(--st-accent)] pl-4 text-2xl font-bold uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]">
                1.0 Abstract
              </h2>
              <p className="text-sm leading-relaxed text-[var(--st-text-secondary)] md:text-base">
                Welcome to SabNode. This document outlines the foundational principles and technical objectives of our all-in-one business communication and marketing automation infrastructure. SabNode is designed to orchestrate customer engagement workflows programmatically, prioritizing reliability, scale, and uncompromising precision.
              </p>
            </section>

            <section id="mission" className="mb-12 scroll-mt-24" tabIndex={-1}>
              <h2 className="mb-6 border-l-4 border-[var(--st-accent)] pl-4 text-2xl font-bold uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]">
                2.0 Mission
              </h2>
              <p className="text-sm leading-relaxed text-[var(--st-text-secondary)] md:text-base">
                Our objective is to abstract the complexities of omni-channel messaging routing. By providing a unified interface to fragmented communication protocols (e.g., WhatsApp, Meta APIs), SabNode empowers developers and enterprises to execute high-throughput campaigns and automated conversational states with minimal latency and maximal determinism.
              </p>
            </section>

            <section id="architecture" className="mb-12 scroll-mt-24" tabIndex={-1}>
              <h2 className="mb-6 border-l-4 border-[var(--st-accent)] pl-4 text-2xl font-bold uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]">
                3.0 Architecture Vision
              </h2>
              <Card variant="outlined" padding="lg" className="font-mono text-sm">
                <p className="mb-4 text-[var(--st-text-secondary)]">
                  We engineer our systems around the following core tenets:
                </p>
                <ul className="m-0 list-none space-y-2 p-0">
                  <li className="flex gap-2">
                    <span className="font-bold text-[var(--st-text)]">[SYS-01]</span>
                    <span className="text-[var(--st-text-secondary)]">Stateless execution where possible.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[var(--st-text)]">[SYS-02]</span>
                    <span className="text-[var(--st-text-secondary)]">Idempotent API design.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[var(--st-text)]">[SYS-03]</span>
                    <span className="text-[var(--st-text-secondary)]">Strict typing and structural validation.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[var(--st-text)]">[SYS-04]</span>
                    <span className="text-[var(--st-text-secondary)]">Developer-first observability.</span>
                  </li>
                </ul>
              </Card>
            </section>

            <section id="endpoints" className="mb-12 scroll-mt-24" tabIndex={-1}>
              <h2 className="mb-6 border-l-4 border-[var(--st-accent)] pl-4 text-2xl font-bold uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]">
                4.0 Core Capabilities
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-[var(--st-text-secondary)] md:text-base">
                The platform exposes primitive building blocks that can be composed into complex marketing state machines:
              </p>

              <div className="space-y-4">
                <Card variant="outlined" padding="md">
                  <div className="mb-2 flex items-center gap-3">
                    <Badge tone="accent" kind="solid">Execute</Badge>
                    <span className="font-bold">/campaigns/dispatch</span>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">Initiates high-volume message delivery across configured channels.</p>
                </Card>

                <Card variant="outlined" padding="md">
                  <div className="mb-2 flex items-center gap-3">
                    <Badge tone="info" kind="solid">Listen</Badge>
                    <span className="font-bold">/webhooks/incoming</span>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">Processes inbound payloads and triggers defined workflow heuristics.</p>
                </Card>
              </div>
            </section>

            <section id="team" className="mb-12 scroll-mt-24" tabIndex={-1}>
              <h2 className="mb-6 border-l-4 border-[var(--st-accent)] pl-4 text-2xl font-bold uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]">
                5.0 Leadership Node
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {TEAM_MEMBERS.map((member, i) => (
                  <Card key={i} variant="interactive" padding="none" className="team-member">
                    <CardBody className="flex flex-col items-center p-6 text-center">
                      <Avatar className="mb-4 h-20 w-20 border-2 border-[var(--st-border)]">
                        <AvatarImage src={member.avatar} alt={`Avatar of ${member.name}`} />
                        <AvatarFallback>{member.init}</AvatarFallback>
                      </Avatar>
                      <h3 className="font-mono text-lg font-bold">{member.name}</h3>
                      <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[var(--st-text-secondary)]">{member.role}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>

            <section id="metrics" className="mb-12 scroll-mt-24" tabIndex={-1}>
              <h2 className="mb-6 border-l-4 border-[var(--st-accent)] pl-4 text-2xl font-bold uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]">
                6.0 Live Telemetry
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard
                  label="Requests Processed"
                  value={metrics.requests.toLocaleString()}
                  icon={Activity}
                  delta={{ value: '+12% vs last month', tone: 'up' }}
                  className="font-mono"
                />
                <StatCard
                  label="Uptime (30 Days)"
                  value={`${metrics.uptime}%`}
                  icon={Clock}
                  delta={{ value: '+0.01% vs previous period', tone: 'up' }}
                  className="font-mono"
                />
              </div>
            </section>

            <footer className="border-t border-[var(--st-border)] pt-8 text-center text-xs text-[var(--st-text-tertiary)]">
              <p>END OF SPECIFICATION // SABNODE_CORE</p>
            </footer>
          </article>
        </main>
      </div>
    </div>
  );
}
