'use client';

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { LandingHeader } from '@/components/landing/landing-header';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollToPlugin, useGSAP);
}

const TEAM_MEMBERS = [
  { name: 'Alice Smith', role: 'Lead Architect', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
  { name: 'Bob Jones', role: 'Head of Reliability', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d' },
  { name: 'Charlie Davis', role: 'Security Engineer', avatar: 'https://i.pravatar.cc/150?u=a04258114e29026702d' },
];

export function AboutUsClient() {
  const container = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ requests: 15420000, uptime: 99.99 });

  useGSAP(() => {
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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = e.currentTarget.getAttribute('href');
    if (target && target.startsWith('#')) {
      e.preventDefault();
      gsap.to(window, { duration: 0.8, scrollTo: target, ease: 'power3.inOut' });
    }
  };

  return (
    <div ref={container} className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black">
      <LandingHeader />
      <div className="flex w-full">
        {/* Sidebar mimicking OpenAPI docs */}
        <aside className="hidden lg:block w-64 border-r border-white/20 p-6 h-[calc(100vh-64px)] sticky top-16 overflow-y-auto">
          <nav aria-label="About Us Navigation" className="space-y-4 text-sm">
            <div className="font-bold uppercase tracking-widest text-white/50 mb-2">/docs/about</div>
            <ul className="space-y-2 text-white/80">
              <li><a href="#abstract" onClick={handleNavClick} aria-label="Navigate to 1.0 Abstract" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-1">1.0 Abstract</a></li>
              <li><a href="#mission" onClick={handleNavClick} aria-label="Navigate to 2.0 Mission" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-1">2.0 Mission</a></li>
              <li><a href="#architecture" onClick={handleNavClick} aria-label="Navigate to 3.0 Architecture" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-1">3.0 Architecture</a></li>
              <li><a href="#endpoints" onClick={handleNavClick} aria-label="Navigate to 4.0 Capabilities" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-1">4.0 Capabilities</a></li>
              <li><a href="#team" onClick={handleNavClick} aria-label="Navigate to 5.0 Team" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-1">5.0 Team</a></li>
              <li><a href="#metrics" onClick={handleNavClick} aria-label="Navigate to 6.0 Live Metrics" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-1">6.0 Metrics</a></li>
            </ul>
            <div className="mt-8">
              <Link href="/" aria-label="Return to Root" className="inline-flex items-center text-xs border border-white/30 px-3 py-1.5 hover:bg-white hover:text-black transition-colors uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-white">
                &larr; Return to Root
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Content mimicking technical whitepaper */}
        <main className="flex-1 max-w-4xl px-6 py-12 lg:px-12 mx-auto focus:outline-none" tabIndex={-1}>
          <article className="prose prose-invert prose-p:font-mono prose-headings:font-mono prose-a:font-mono max-w-none">
            <header className="border-b border-white/20 pb-8 mb-8">
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-2 uppercase">SabNode Specification</h1>
              <div className="text-white/60 text-sm flex gap-4 uppercase tracking-wider">
                <span>Version: 1.0.0</span>
                <span>Status: Active</span>
                <span>Classification: Public</span>
              </div>
            </header>

            <section id="abstract" className="mb-12">
              <h2 className="text-2xl font-bold uppercase border-l-4 border-white pl-4 mb-6">1.0 Abstract</h2>
              <p className="text-white/80 leading-relaxed text-sm md:text-base">
                Welcome to SabNode. This document outlines the foundational principles and technical objectives of our all-in-one business communication and marketing automation infrastructure. SabNode is designed to orchestrate customer engagement workflows programmatically, prioritizing reliability, scale, and uncompromising precision.
              </p>
            </section>

            <section id="mission" className="mb-12">
              <h2 className="text-2xl font-bold uppercase border-l-4 border-white pl-4 mb-6">2.0 Mission</h2>
              <p className="text-white/80 leading-relaxed text-sm md:text-base">
                Our objective is to abstract the complexities of omni-channel messaging routing. By providing a unified interface to fragmented communication protocols (e.g., WhatsApp, Meta APIs), SabNode empowers developers and enterprises to execute high-throughput campaigns and automated conversational states with minimal latency and maximal determinism.
              </p>
            </section>

            <section id="architecture" className="mb-12">
              <h2 className="text-2xl font-bold uppercase border-l-4 border-white pl-4 mb-6">3.0 Architecture Vision</h2>
              <div className="bg-white/5 border border-white/20 p-6 rounded-none font-mono text-sm">
                <p className="text-white/80 mb-4">
                  We engineer our systems around the following core tenets:
                </p>
                <ul className="space-y-2 list-none p-0 m-0">
                  <li className="flex gap-2"><span className="text-white font-bold">[SYS-01]</span> <span className="text-white/70">Stateless execution where possible.</span></li>
                  <li className="flex gap-2"><span className="text-white font-bold">[SYS-02]</span> <span className="text-white/70">Idempotent API design.</span></li>
                  <li className="flex gap-2"><span className="text-white font-bold">[SYS-03]</span> <span className="text-white/70">Strict typing and structural validation.</span></li>
                  <li className="flex gap-2"><span className="text-white font-bold">[SYS-04]</span> <span className="text-white/70">Developer-first observability.</span></li>
                </ul>
              </div>
            </section>

            <section id="endpoints" className="mb-12">
              <h2 className="text-2xl font-bold uppercase border-l-4 border-white pl-4 mb-6">4.0 Core Capabilities</h2>
              <p className="text-white/80 leading-relaxed text-sm md:text-base mb-6">
                The platform exposes primitive building blocks that can be composed into complex marketing state machines:
              </p>
              
              <div className="space-y-4">
                <div className="border border-white/20 p-4 hover:border-white/40 transition-colors focus-within:ring-2 focus-within:ring-white">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-white text-black px-2 py-0.5 text-xs font-bold uppercase">Execute</span>
                    <span className="font-bold">/campaigns/dispatch</span>
                  </div>
                  <p className="text-white/60 text-sm">Initiates high-volume message delivery across configured channels.</p>
                </div>
                
                <div className="border border-white/20 p-4 hover:border-white/40 transition-colors focus-within:ring-2 focus-within:ring-white">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-white text-black px-2 py-0.5 text-xs font-bold uppercase">Listen</span>
                    <span className="font-bold">/webhooks/incoming</span>
                  </div>
                  <p className="text-white/60 text-sm">Processes inbound payloads and triggers defined workflow heuristics.</p>
                </div>
              </div>
            </section>

            <section id="team" className="mb-12">
              <h2 className="text-2xl font-bold uppercase border-l-4 border-white pl-4 mb-6">5.0 Leadership Node</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TEAM_MEMBERS.map((member, i) => (
                  <div key={i} className="team-member border border-white/20 p-4 text-center hover:bg-white/5 transition-colors">
                    <img src={member.avatar} alt={`Avatar of ${member.name}`} className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-white/20" />
                    <h3 className="font-bold text-lg">{member.name}</h3>
                    <p className="text-sm text-white/60 uppercase tracking-wider">{member.role}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="metrics" className="mb-12">
              <h2 className="text-2xl font-bold uppercase border-l-4 border-white pl-4 mb-6">6.0 Live Telemetry</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/20 p-6 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold font-mono tracking-tighter text-[#4F46E5]">{metrics.requests.toLocaleString()}</span>
                  <span className="text-xs text-white/60 uppercase tracking-widest mt-2">Requests Processed</span>
                </div>
                <div className="bg-white/5 border border-white/20 p-6 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold font-mono tracking-tighter text-[#10B981]">{metrics.uptime}%</span>
                  <span className="text-xs text-white/60 uppercase tracking-widest mt-2">Uptime (30 Days)</span>
                </div>
              </div>
            </section>
            
            <footer className="border-t border-white/20 pt-8 text-center text-white/40 text-xs">
              <p>END OF SPECIFICATION // SABNODE_CORE</p>
            </footer>
          </article>
        </main>
      </div>
    </div>
  );
}
