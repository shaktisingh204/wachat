import type { Metadata } from 'next';
import { Terminal, Code, ChevronRight, FileJson, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Customers | SabNode',
  description: 'Technical case studies and architecture implementations of SabNode.',
};

export default function CustomersPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black flex flex-col md:flex-row">
      {/* Left Sidebar - Navigation */}
      <aside className="w-full md:w-64 border-r border-zinc-800 bg-black p-6 flex flex-col h-auto md:h-screen sticky top-0 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tighter uppercase border-b border-zinc-800 pb-4">
            Case Studies
          </h1>
        </div>
        <nav className="space-y-6 flex-1">
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase mb-3 tracking-widest">Enterprise</h2>
            <ul className="space-y-2">
              <li>
                <a href="#fintech-corp" className="text-sm flex items-center gap-2 text-white hover:bg-zinc-900 p-2 rounded transition-colors group">
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white" />
                  FintechCorp
                </a>
              </li>
              <li>
                <a href="#healthsync" className="text-sm flex items-center gap-2 text-zinc-400 hover:bg-zinc-900 p-2 rounded transition-colors group">
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white" />
                  HealthSync
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase mb-3 tracking-widest">Startups</h2>
            <ul className="space-y-2">
              <li>
                <a href="#aero-logistics" className="text-sm flex items-center gap-2 text-zinc-400 hover:bg-zinc-900 p-2 rounded transition-colors group">
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white" />
                  Aero Logistics
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      {/* Main Content Area - Center (Whitepaper) & Right (Code/Tech) */}
      <main className="flex-1 flex flex-col lg:flex-row min-w-0">
        
        {/* Center - Whitepaper Content */}
        <div className="flex-1 p-8 lg:p-12 max-w-3xl lg:border-r border-zinc-800">
          <header className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-zinc-800 rounded-full text-xs uppercase tracking-widest mb-6">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              Live Deployment
            </div>
            <h2 id="fintech-corp" className="text-4xl font-bold tracking-tight mb-4">FintechCorp Implementation</h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              High-frequency trading infrastructure scaling to 50k requests per second with SabNode distributed edge network.
            </p>
          </header>

          <section className="space-y-8 text-zinc-300 leading-relaxed">
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-zinc-800 pb-2">1. Abstract</h3>
              <p>
                FintechCorp required a highly resilient, low-latency infrastructure to handle peak trading volumes. 
                Legacy monolithic systems introduced unacceptable latency (avg. 240ms) during market open hours. 
                By migrating to SabNode&apos;s distributed architecture, latency was reduced by 85%.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-zinc-800 pb-2">2. Architectural Overhaul</h3>
              <p className="mb-4">
                The migration involved decoupling the order-matching engine from the user-facing websocket gateways.
                SabNode&apos;s global CDN and edge compute nodes were utilized to validate and route payloads before they hit the core database.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-400">
                <li><strong className="text-white">Edge Validation:</strong> JWT authentication moved to the edge.</li>
                <li><strong className="text-white">Data Layer:</strong> Multi-region Active-Active SabNode database clusters.</li>
                <li><strong className="text-white">Event Stream:</strong> Kafka integration via SabNode Streams.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-4 border-b border-zinc-800 pb-2">3. Performance Metrics</h3>
              <div className="grid grid-cols-2 gap-4 my-6">
                <div className="border border-zinc-800 p-4">
                  <div className="text-xs text-zinc-500 uppercase mb-1">P99 Latency</div>
                  <div className="text-3xl font-bold text-white">35ms</div>
                </div>
                <div className="border border-zinc-800 p-4">
                  <div className="text-xs text-zinc-500 uppercase mb-1">Throughput</div>
                  <div className="text-3xl font-bold text-white">50k req/s</div>
                </div>
                <div className="border border-zinc-800 p-4">
                  <div className="text-xs text-zinc-500 uppercase mb-1">Uptime</div>
                  <div className="text-3xl font-bold text-white">99.999%</div>
                </div>
                <div className="border border-zinc-800 p-4">
                  <div className="text-xs text-zinc-500 uppercase mb-1">Cost Reduction</div>
                  <div className="text-3xl font-bold text-white">42%</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right - Technical Specs / Code */}
        <div className="w-full lg:w-[450px] bg-[#0a0a0a] p-6 lg:p-8 flex flex-col gap-6 sticky top-0 h-auto lg:h-screen overflow-y-auto">
          
          <div className="flex items-center justify-between text-xs text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-4">
            <span>System Configuration</span>
            <FileJson className="w-4 h-4" />
          </div>

          <div className="bg-black border border-zinc-800 rounded-md overflow-hidden">
            <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 text-xs text-zinc-400 flex items-center gap-2">
              <Terminal className="w-3 h-3" /> sabnode.config.ts
            </div>
            <pre className="p-4 text-xs overflow-x-auto text-zinc-300">
              <code>
{`export default defineConfig({
  cluster: {
    regions: ['us-east-1', 'eu-west-1', 'ap-northeast-1'],
    strategy: 'active-active',
  },
  edge: {
    auth: {
      provider: 'jwt',
      validateAtEdge: true,
    },
    caching: {
      staleWhileRevalidate: 30,
      maxAge: 60,
    }
  },
  database: {
    consistency: 'eventual',
    replicationFactor: 3
  }
});`}
              </code>
            </pre>
          </div>

          <div className="bg-black border border-zinc-800 rounded-md overflow-hidden">
            <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 text-xs text-zinc-400 flex items-center gap-2">
              <Code className="w-3 h-3" /> Topology Output
            </div>
            <pre className="p-4 text-xs overflow-x-auto text-zinc-300">
              <code>
{`> sabnode topology inspect

[OK] Gateway (us-east-1)
  │
  ├─ Edge Worker [JWT Auth]
  │  └─ Latency: 4ms
  │
  ├─ SabNode Stream [Kafka]
  │  └─ Partitions: 64
  │
  └─ Database Replica
     └─ Sync Lag: 12ms
`}
              </code>
            </pre>
          </div>

          <div className="mt-auto pt-8">
            <button className="w-full py-3 bg-white text-black font-semibold text-sm uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
              View Full Documentation <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
