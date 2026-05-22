import Link from 'next/link';
import { LandingHeader } from '@/components/landing/landing-header';

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black">
      <LandingHeader />
      <div className="flex w-full">
        {/* Sidebar mimicking OpenAPI docs */}
        <aside className="hidden lg:block w-64 border-r border-white/20 p-6 h-[calc(100vh-64px)] sticky top-16 overflow-y-auto">
          <nav className="space-y-4 text-sm">
            <div className="font-bold uppercase tracking-widest text-white/50 mb-2">/docs/about</div>
            <ul className="space-y-2 text-white/80">
              <li><a href="#abstract" className="hover:text-white transition-colors">1.0 Abstract</a></li>
              <li><a href="#mission" className="hover:text-white transition-colors">2.0 Mission</a></li>
              <li><a href="#architecture" className="hover:text-white transition-colors">3.0 Architecture</a></li>
              <li><a href="#endpoints" className="hover:text-white transition-colors">4.0 Capabilities</a></li>
            </ul>
            <div className="mt-8">
              <Link href="/" className="inline-flex items-center text-xs border border-white/30 px-3 py-1.5 hover:bg-white hover:text-black transition-colors uppercase tracking-wider">
                &larr; Return to Root
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Content mimicking technical whitepaper */}
        <main className="flex-1 max-w-4xl px-6 py-12 lg:px-12 mx-auto">
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
                <div className="border border-white/20 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-white text-black px-2 py-0.5 text-xs font-bold uppercase">Execute</span>
                    <span className="font-bold">/campaigns/dispatch</span>
                  </div>
                  <p className="text-white/60 text-sm">Initiates high-volume message delivery across configured channels.</p>
                </div>
                
                <div className="border border-white/20 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-white text-black px-2 py-0.5 text-xs font-bold uppercase">Listen</span>
                    <span className="font-bold">/webhooks/incoming</span>
                  </div>
                  <p className="text-white/60 text-sm">Processes inbound payloads and triggers defined workflow heuristics.</p>
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
