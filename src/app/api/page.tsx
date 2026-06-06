'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Terminal, FileCode, ArrowRight, Github, Command, Cpu, Code2, Layers, Shield
} from 'lucide-react';
import { Button, Badge, Card, Separator, ZoruKbd, ScrollArea } from '@/components/sabcrm/20ui/compat';
import { getSession } from '@/app/actions';

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
    <div className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black antialiased">
      <GlobalMonochromeStyles />

      {/* Navigation */}
      <nav className="border-b border-zoru-line sticky top-0 bg-black/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Terminal className="h-5 w-5 text-white" />
            <span className="font-bold tracking-tight text-white">SABNODE_API_DOCS</span>
            <Badge variant="outline" className="text-zoru-ink-muted border-zoru-line rounded-none text-xs">v2.0.0-rc.4</Badge>
          </div>
          <div className="flex items-center gap-6 text-sm text-zoru-ink-muted hidden sm:flex">
            <Link href="#endpoints" className="hover:text-white transition-colors">/endpoints</Link>
            <Link href="#authentication" className="hover:text-white transition-colors">/auth</Link>
            <Link href="#architecture" className="hover:text-white transition-colors">/architecture</Link>
            <Link href="https://github.com" className="hover:text-white transition-colors flex items-center gap-2">
              <Github className="h-4 w-4" />
              Source
            </Link>
            {loading ? null : session?.user ? (
              <Link href="/wachat">
                <Button className="bg-white text-black hover:bg-zoru-surface-2 rounded-none h-8 font-mono text-xs">
                  [ENTER_WORKSPACE]
                </Button>
              </Link>
            ) : (
              <Link href="/signup">
                <Button className="bg-white text-black hover:bg-zoru-surface-2 rounded-none h-8 font-mono text-xs">
                  [INITIATE_AUTH]
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Main Layout - Document Driven */}
      <div className="container mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12">
        
        {/* Sidebar */}
        <aside className="lg:w-64 flex-shrink-0 hidden lg:block">
          <ScrollArea className="h-[calc(100vh-6rem)] sticky top-20">
            <div className="space-y-8 pb-8">
              <div>
                <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-widest">Introduction</h4>
                <ul className="space-y-2 text-sm text-zoru-ink-muted">
                  <li><a href="#" className="hover:text-white">Getting Started</a></li>
                  <li><a href="#authentication" className="hover:text-white">Authentication</a></li>
                  <li><a href="#" className="hover:text-white">Errors</a></li>
                  <li><a href="#" className="hover:text-white">Pagination</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-widest">Resources</h4>
                <ul className="space-y-2 text-sm text-zoru-ink-muted">
                  <li><a href="#endpoints" className="hover:text-white">Messages</a></li>
                  <li><a href="#" className="hover:text-white">Conversations</a></li>
                  <li><a href="#" className="hover:text-white">Workflows</a></li>
                  <li><a href="#" className="hover:text-white">Agents</a></li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-4xl">
          <header className="mb-16">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6">SabNode Core API</h1>
            <p className="text-xl text-zoru-ink-muted leading-relaxed mb-8">
              The foundational protocol for unified customer operations. Integrate WhatsApp, AI agents, CRM, and real-time messaging directly into your stack.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button className="bg-white text-black hover:bg-zoru-surface-2 rounded-none font-mono flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                curl https://api.sabnode.com/v2/init
              </Button>
              <Button variant="outline" className="border-zoru-line text-white hover:bg-zoru-ink rounded-none font-mono">
                View Swagger JSON
              </Button>
            </div>
          </header>

          <Separator className="bg-zoru-ink my-12" />

          {/* Setup / Authentication */}
          <section id="authentication" className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-6 w-6 text-zoru-ink-muted" />
              <h2 className="text-2xl font-bold">Authentication</h2>
            </div>
            <p className="text-zoru-ink-muted mb-6 leading-relaxed">
              Authenticate requests to the SabNode API using Bearer tokens in the Authorization header. Manage your API keys in the dashboard.
            </p>
            
            <Card className="bg-zoru-ink border-zoru-line rounded-none overflow-hidden mb-8">
              <div className="bg-zoru-ink border-b border-zoru-line px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-zoru-ink-muted">Request Example</span>
                <ZoruKbd className="bg-zoru-ink text-zoru-ink-muted border-none">bash</ZoruKbd>
              </div>
              <div className="p-4 overflow-x-auto text-sm text-zoru-ink-muted whitespace-pre">
                <code>
<span className="text-zoru-ink"># Authenticate your request</span>{'\n'}
curl https://api.sabnode.com/v2/workspaces \{'\n'}
  -H <span className="text-white">"Authorization: Bearer sk_live_..."</span>
                </code>
              </div>
            </Card>
          </section>

          {/* Endpoints */}
          <section id="endpoints" className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <Code2 className="h-6 w-6 text-zoru-ink-muted" />
              <h2 className="text-2xl font-bold">Core Endpoints</h2>
            </div>
            
            <div className="space-y-8">
              {/* Endpoint 1 */}
              <div className="border border-zoru-line p-6 bg-zoru-ink/50">
                <div className="flex items-center gap-4 mb-4">
                  <Badge className="bg-white text-black hover:bg-zoru-surface-2 rounded-none font-bold">POST</Badge>
                  <code className="text-lg">/v2/messages/send</code>
                </div>
                <p className="text-zoru-ink-muted mb-6 text-sm">
                  Dispatches a payload through connected channels (WhatsApp, Web Chat, SMS).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider mb-3 text-zoru-ink">Parameters</h5>
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between border-b border-zoru-line pb-2">
                        <code className="text-white">channel</code>
                        <span className="text-zoru-ink">string (required)</span>
                      </li>
                      <li className="flex justify-between border-b border-zoru-line pb-2">
                        <code className="text-white">to</code>
                        <span className="text-zoru-ink">string (required)</span>
                      </li>
                      <li className="flex justify-between border-b border-zoru-line pb-2">
                        <code className="text-white">payload</code>
                        <span className="text-zoru-ink">object (required)</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider mb-3 text-zoru-ink">Response <span className="text-zoru-ink-muted">200 OK</span></h5>
                    <pre className="text-xs text-zoru-ink-muted bg-black border border-zoru-line p-3 overflow-x-auto">
{`{
  "id": "msg_01H...",
  "status": "queued",
  "channel": "whatsapp",
  "created_at": "2026-05-23T01:10:18Z"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Endpoint 2 */}
              <div className="border border-zoru-line p-6 bg-zoru-ink/50">
                <div className="flex items-center gap-4 mb-4">
                  <Badge variant="outline" className="border-zoru-line text-zoru-ink-muted rounded-none font-bold">GET</Badge>
                  <code className="text-lg">/v2/workflows/active</code>
                </div>
                <p className="text-zoru-ink-muted mb-6 text-sm">
                  Retrieve all actively running workflows for the authenticated workspace.
                </p>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section id="architecture">
            <div className="flex items-center gap-3 mb-6">
              <Layers className="h-6 w-6 text-zoru-ink-muted" />
              <h2 className="text-2xl font-bold">System Architecture</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-zoru-line p-5 hover:border-zoru-line transition-colors bg-zoru-ink">
                <Cpu className="h-8 w-8 mb-4 text-white" />
                <h3 className="font-bold mb-2">Event Engine</h3>
                <p className="text-xs text-zoru-ink-muted leading-relaxed">
                  Processes millions of inbound hooks with sub-50ms latency using Rust-based workers.
                </p>
              </div>
              <div className="border border-zoru-line p-5 hover:border-zoru-line transition-colors bg-zoru-ink">
                <Command className="h-8 w-8 mb-4 text-white" />
                <h3 className="font-bold mb-2">Agent Matrix</h3>
                <p className="text-xs text-zoru-ink-muted leading-relaxed">
                  Distributed LLM orchestration layer routing intents to specialized subagents.
                </p>
              </div>
              <div className="border border-zoru-line p-5 hover:border-zoru-line transition-colors bg-zoru-ink">
                <FileCode className="h-8 w-8 mb-4 text-white" />
                <h3 className="font-bold mb-2">State Sync</h3>
                <p className="text-xs text-zoru-ink-muted leading-relaxed">
                  Real-time CRDT propagation ensures UI state perfectly mirrors backend realities.
                </p>
              </div>
            </div>
          </section>

        </main>
      </div>
      
      {/* Footer */}
      <footer className="border-t border-zoru-line py-12 mt-20">
        <div className="container mx-auto px-6 text-center text-sm text-zoru-ink font-mono">
          <p>© {new Date().getFullYear()} SabNode Inc. // SYST_STATUS: ONLINE // LATENCY: 12ms</p>
        </div>
      </footer>
    </div>
  );
}

/* Global Styles for Monochrome Zoru UI Theme */
function GlobalMonochromeStyles() {
  return (
    <style>{`
      :root {
        --background: 0 0% 0%;
        --foreground: 0 0% 100%;
        --card: 0 0% 4%;
        --card-foreground: 0 0% 100%;
        --popover: 0 0% 4%;
        --popover-foreground: 0 0% 100%;
        --primary: 0 0% 100%;
        --primary-foreground: 0 0% 0%;
        --secondary: 0 0% 15%;
        --secondary-foreground: 0 0% 100%;
        --muted: 0 0% 15%;
        --muted-foreground: 0 0% 65%;
        --accent: 0 0% 15%;
        --accent-foreground: 0 0% 100%;
        --destructive: 0 0% 30%;
        --destructive-foreground: 0 0% 100%;
        --border: 0 0% 15%;
        --input: 0 0% 15%;
        --ring: 0 0% 100%;
        --radius: 0rem; /* Strict brutalist/terminal style */
      }

      body {
        background-color: black;
        color: white;
      }

      /* Custom scrollbar for terminal feel */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #000;
        border-left: 1px solid #27272a;
      }
      ::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border: 1px solid #000;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #71717a;
      }
    `}</style>
  );
}
