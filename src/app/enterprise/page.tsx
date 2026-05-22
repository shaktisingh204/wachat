'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Textarea,
  Label,
} from '@/components/zoruui';
import { Terminal, Shield, Cpu, Layers, HelpCircle, CheckCircle } from 'lucide-react';

export default function EnterprisePage() {
  const [formData, setFormData] = React.useState({
    organization: '',
    email: '',
    volume: '100k-500k',
    useCase: '',
  });
  
  const [responseState, setResponseState] = React.useState<'idle' | 'executing' | 'success'>('idle');
  const [responsePayload, setResponsePayload] = React.useState<any>(null);

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.organization || !formData.email) {
      alert('Please fill out all required fields (*)');
      return;
    }

    setResponseState('executing');
    setTimeout(() => {
      setResponseState('success');
      setResponsePayload({
        status: 201,
        status_text: "Created",
        transaction_id: "tx_ent_" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        payload: {
          organization: formData.organization,
          email: formData.email,
          volume: formData.volume,
          message: "Handshake initiated. A SabNode solutions engineer will contact you in < 2 hours."
        }
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col md:flex-row selection:bg-white selection:text-black">
      {/* Global Monochrome Style overrides */}
      <style jsx global>{`
        body {
          background-color: black !important;
          color: white !important;
        }
      `}</style>

      {/* Left Sidebar */}
      <aside className="w-full md:w-64 border-r border-white/20 p-6 flex flex-col gap-4 bg-black">
        <Link href="/" className="hover:underline text-sm uppercase tracking-widest text-white/70">
          &larr; Back to Home
        </Link>
        <div className="mt-8">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">Endpoints</h3>
          <ul className="space-y-2 text-sm">
            <li className="font-bold border-l-2 border-white pl-3 text-white">POST /enterprise/inquire</li>
            <li className="text-white/50 pl-3 hover:text-white transition-colors cursor-pointer">GET /enterprise/sla</li>
            <li className="text-white/50 pl-3 hover:text-white transition-colors cursor-pointer">GET /enterprise/soc2</li>
            <li className="text-white/50 pl-3 hover:text-white transition-colors cursor-pointer">GET /enterprise/vpc</li>
          </ul>
        </div>
      </aside>

      {/* Middle Content */}
      <main className="flex-1 p-8 lg:p-12 overflow-y-auto border-r border-white/20 bg-black">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-white text-black px-2 py-1 text-xs font-bold rounded-none uppercase tracking-widest">POST</span>
            <h1 className="text-3xl font-bold tracking-tight">/v1/enterprise/inquire</h1>
          </div>
          
          <p className="text-white/70 mb-8 leading-relaxed">
            Submit a custom integration, VPC deployment, or high-throughput enterprise cluster request. Our solutions engineering team will provision a secure staging sandbox and schedule a technical roadmap evaluation.
          </p>

          {/* Core Specs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="border border-white/20 p-5 bg-white/5">
              <Shield className="h-6 w-6 mb-3 text-white" />
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2">SOC2 & VPC</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                HIPAA & SOC2 compliant nodes deployed inside your private VPC (AWS, GCP, Azure).
              </p>
            </div>
            <div className="border border-white/20 p-5 bg-white/5">
              <Cpu className="h-6 w-6 mb-3 text-white" />
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2">SLA & Scale</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                99.99% uptime guarantees with dedicated rate limits scaling to 5,000+ RPS.
              </p>
            </div>
            <div className="border border-white/20 p-5 bg-white/5">
              <Layers className="h-6 w-6 mb-3 text-white" />
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2">SSO & RBAC</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Granular team scoping with OIDC/SAML single-sign-on integration.
              </p>
            </div>
          </div>

          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 border-b border-white/20 pb-2">Request Body Schema</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 bg-white/5">
                <div className="col-span-3 font-semibold text-sm">organization</div>
                <div className="col-span-2 text-xs text-white/50">string</div>
                <div className="col-span-7 text-sm text-white/70">Legal company name or workspace identity. Required.</div>
              </div>
              <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 bg-white/5">
                <div className="col-span-3 font-semibold text-sm">email</div>
                <div className="col-span-2 text-xs text-white/50">string (email)</div>
                <div className="col-span-7 text-sm text-white/70">Corporate email address. Personal emails are rejected by policy. Required.</div>
              </div>
              <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 bg-white/5">
                <div className="col-span-3 font-semibold text-sm">volume</div>
                <div className="col-span-2 text-xs text-white/50">enum</div>
                <div className="col-span-7 text-sm text-white/70">Expected monthly message payload scale. Choices: `&lt;100k`, `100k-500k`, `500k-2m`, `2m+`.</div>
              </div>
              <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 bg-white/5">
                <div className="col-span-3 font-semibold text-sm">use_case</div>
                <div className="col-span-2 text-xs text-white/50">string</div>
                <div className="col-span-7 text-sm text-white/70">Describe your architectural requirements and compliance scope. Optional.</div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4 border-b border-white/20 pb-2">Technical Alignment Matrix</h2>
            <div className="space-y-2 text-sm text-white/70">
              <p><strong className="text-white">Enterprise Escalations:</strong> engineering@sabnode.in</p>
              <p><strong className="text-white">Compliance:</strong> SOC2 Type II, HIPAA, ISO-27001 Audit Logs</p>
              <p><strong className="text-white">Hosting Options:</strong> On-Premise, Private AWS Cloud, Shared Cluster (Standard)</p>
            </div>
          </div>
        </div>
      </main>

      {/* Right Column: API Simulator & Form */}
      <div className="w-full lg:w-[450px] xl:w-[550px] bg-zinc-950 border-l border-white/20 p-6 flex flex-col md:h-screen md:overflow-y-auto">
        <div className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-3">Example Request</h3>
          <div className="bg-black border border-white/20 p-4 text-xs font-mono text-white/80 overflow-x-auto">
<pre>{`curl -X POST https://api.sabnode.in/v1/enterprise/inquire \\
  -H "Content-Type: application/json" \\
  -d '{
    "organization": "${formData.organization || 'Acme Corp'}",
    "email": "${formData.email || 'cto@acme.com'}",
    "volume": "${formData.volume}",
    "use_case": "${formData.useCase || 'Private cluster'}"
  }'`}</pre>
          </div>
        </div>

        <div className="flex-grow">
          <Card className="bg-black border-white/20 text-white rounded-none shadow-none mb-6">
            <ZoruCardHeader className="border-b border-white/20 pb-4">
              <ZoruCardTitle className="text-lg font-bold">Try it out</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="org" className="text-white">organization <span className="text-white/50">*</span></Label>
                <Input 
                  id="org" 
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  placeholder="string" 
                  className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">email <span className="text-white/50">*</span></Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="string ($email)" 
                  className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume" className="text-white">volume</Label>
                <select 
                  id="volume" 
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  className="w-full h-9 bg-zinc-900 border border-white/20 text-white px-3 text-sm rounded-none focus-visible:outline-none focus-visible:border-white"
                >
                  <option value="<100k">&lt; 100k</option>
                  <option value="100k-500k">100k - 500k</option>
                  <option value="500k-2m">500k - 2m</option>
                  <option value="2m+">2m+</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="use_case" className="text-white">use_case</Label>
                <Textarea 
                  id="use_case" 
                  value={formData.useCase}
                  onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                  placeholder="string" 
                  className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none min-h-[100px] focus-visible:ring-1 focus-visible:ring-white" 
                />
              </div>
              <Button 
                onClick={handleExecute}
                className="w-full bg-white text-black hover:bg-zinc-200 rounded-none font-bold uppercase tracking-widest mt-4 flex items-center justify-center gap-2"
                disabled={responseState === 'executing'}
              >
                {responseState === 'executing' ? (
                  <>
                    <span className="h-4 w-4 animate-spin border-2 border-black border-t-transparent rounded-full" />
                    Executing...
                  </>
                ) : 'Execute'}
              </Button>
            </ZoruCardContent>
          </Card>

          {/* Response Box */}
          {responseState !== 'idle' && (
            <div className="border border-white/20 p-4 bg-black">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
                {responseState === 'success' ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-white" />
                    Response Received
                  </>
                ) : (
                  <>
                    <Terminal className="h-4 w-4 animate-pulse" />
                    Waiting for Server Response...
                  </>
                )}
              </h4>
              {responseState === 'success' && responsePayload ? (
                <div className="space-y-3">
                  <div className="flex gap-4 text-xs font-bold">
                    <span className="text-white bg-white/10 px-2 py-0.5">HTTP {responsePayload.status}</span>
                    <span className="text-white/60">{responsePayload.status_text}</span>
                  </div>
                  <pre className="text-xs text-white/80 font-mono bg-white/5 p-3 overflow-x-auto max-h-[220px]">
                    <code>{JSON.stringify(responsePayload, null, 2)}</code>
                  </pre>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center border border-dashed border-white/20 text-xs text-white/40">
                  Negotiating WebSocket connection...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
