import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  ArrowRight, 
  Code2, 
  Terminal, 
  Users, 
  Building, 
  ChevronRight, 
  CheckCircle2, 
  Shield, 
  Zap, 
  FileJson,
  ArrowUpRight
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Partners | SabNode',
  description: 'Partner with SabNode through agency, developer, and referral programs for customer operations.',
};

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black antialiased">
      {/* Developer-First OpenAPI layout style */}
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/80 backdrop-blur-md px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold tracking-tighter text-xl hover:text-white/80 transition-colors">
            SabNode
          </Link>
          <span className="text-white/30">/</span>
          <span className="text-white/90 font-medium">Partners</span>
          
          <nav className="hidden lg:flex items-center gap-6 ml-8 text-sm text-white/50">
            <Link href="#agency" className="hover:text-white transition-colors">Agency</Link>
            <Link href="#developer" className="hover:text-white transition-colors">Developer</Link>
            <Link href="#referral" className="hover:text-white transition-colors">Referral</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/login" 
            className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block"
          >
            Partner Login
          </Link>
          <button className="text-sm px-5 py-2 bg-white text-black hover:bg-neutral-200 transition-colors rounded font-semibold flex items-center gap-2">
            Apply Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-73px)] items-stretch">
        {/* Left Sidebar - Navigation */}
        <aside className="w-full lg:w-64 border-r border-white/10 p-6 hidden lg:block overflow-y-auto shrink-0 bg-black sticky top-[73px] h-[calc(100vh-73px)]">
          <div className="space-y-10 text-sm">
            <div>
              <h3 className="font-bold text-white/40 uppercase tracking-widest mb-4 text-xs">Overview</h3>
              <ul className="space-y-3">
                <li><Link href="#introduction" className="text-white flex items-center justify-between group">Introduction <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"/></Link></li>
                <li><Link href="#benefits" className="text-white/50 hover:text-white transition-colors">Benefits</Link></li>
                <li><Link href="#requirements" className="text-white/50 hover:text-white transition-colors">Requirements</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white/40 uppercase tracking-widest mb-4 text-xs">Programs</h3>
              <ul className="space-y-3">
                <li><Link href="#agency" className="text-white/50 hover:text-white transition-colors flex items-center gap-2"><Building className="w-3.5 h-3.5"/> Agency Partner</Link></li>
                <li><Link href="#developer" className="text-white/50 hover:text-white transition-colors flex items-center gap-2"><Code2 className="w-3.5 h-3.5"/> Tech Partner</Link></li>
                <li><Link href="#referral" className="text-white/50 hover:text-white transition-colors flex items-center gap-2"><Users className="w-3.5 h-3.5"/> Referral Partner</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white/40 uppercase tracking-widest mb-4 text-xs">Resources</h3>
              <ul className="space-y-3">
                <li><Link href="#" className="text-white/50 hover:text-white transition-colors flex items-center gap-2">API Reference <ArrowUpRight className="w-3 h-3"/></Link></li>
                <li><Link href="#" className="text-white/50 hover:text-white transition-colors flex items-center gap-2">Brand Assets <ArrowUpRight className="w-3 h-3"/></Link></li>
                <li><Link href="#" className="text-white/50 hover:text-white transition-colors flex items-center gap-2">Support <ArrowUpRight className="w-3 h-3"/></Link></li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Main Content Area - Split into Docs & Code/Examples */}
        <main className="flex-1 flex flex-col xl:flex-row bg-black min-w-0">
          
          {/* Center Docs Column */}
          <div className="flex-1 p-6 md:p-12 lg:p-16 xl:max-w-3xl border-r border-white/10">
            <div className="max-w-2xl mx-auto space-y-20">
              
              {/* Hero Section */}
              <section id="introduction" className="space-y-8 scroll-mt-24">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-xs font-semibold bg-white/5 text-white/80">
                  <Terminal className="w-3.5 h-3.5" /> sabnode-partner-network
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                  Scale your operations <br/><span className="text-white/40">with SabNode.</span>
                </h1>
                <p className="text-lg text-white/60 leading-relaxed font-sans">
                  Join an elite network of agencies, developers, and consultants building the next generation of customer operations. Gain access to exclusive APIs, revenue sharing, and co-marketing opportunities.
                </p>
              </section>

              <hr className="border-white/10" />

              {/* Agency Program */}
              <section id="agency" className="space-y-8 scroll-mt-24">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white text-black rounded">
                      <Building className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Agency Program</h2>
                  </div>
                  <p className="text-white/60 leading-relaxed font-sans">
                    For digital agencies and system integrators. Deliver superior CRM, automation, and operational solutions to your clients on top of the SabNode architecture.
                  </p>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { title: "Revenue Share", desc: "Up to 30% lifetime commission on referred accounts." },
                    { title: "Sandbox Instances", desc: "Unlimited testing environments for client staging." },
                    { title: "Priority Support", desc: "Direct Slack channel with our engineering team." },
                    { title: "Co-Marketing", desc: "Featured case studies and joint webinars." }
                  ].map((item, i) => (
                    <div key={i} className="p-5 border border-white/10 rounded-lg bg-[#050505] hover:bg-white/5 transition-colors group">
                      <h4 className="font-bold text-sm flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" /> 
                        {item.title}
                      </h4>
                      <p className="text-sm text-white/50 font-sans leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
              
              <hr className="border-white/10" />

              {/* Developer Program */}
              <section id="developer" className="space-y-8 scroll-mt-24">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white text-black rounded">
                      <Code2 className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Technology Partner</h2>
                  </div>
                  <p className="text-white/60 leading-relaxed font-sans">
                    For ISVs and developers building integrations. Publish your app in the SabNode Marketplace and access thousands of potential customers.
                  </p>
                </div>
                
                <div className="bg-[#050505] border border-white/10 rounded-lg p-6">
                  <ul className="space-y-5">
                    {[
                      "OAuth 2.0 application registration and management.",
                      "Access to high-volume rate limits and webhook delivery.",
                      "Dedicated solutions engineering support for complex builds.",
                      "Revenue share for paid marketplace applications."
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-white/70 font-sans">
                        <Shield className="w-4 h-4 mt-0.5 text-white/30 shrink-0" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <hr className="border-white/10" />

              {/* Referral Program */}
              <section id="referral" className="space-y-8 scroll-mt-24 pb-20">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 border border-white/20 text-white rounded">
                      <Users className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Referral Partner</h2>
                  </div>
                  <p className="text-white/60 leading-relaxed font-sans">
                    For consultants, creators, and advisors. Simply refer clients to SabNode and earn a commission for every successful conversion.
                  </p>
                </div>
              </section>

            </div>
          </div>

          {/* Right Column - Code / Examples */}
          <div className="w-full xl:w-[480px] 2xl:w-[540px] p-6 lg:p-8 bg-[#050505] xl:sticky xl:top-[73px] xl:h-[calc(100vh-73px)] xl:overflow-y-auto">
            <div className="space-y-8">
              
              {/* Terminal Mockup */}
              <div className="rounded border border-white/10 bg-black overflow-hidden relative group">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0a0a0a]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors"></div>
                  </div>
                  <div className="text-xs text-white/40 font-mono tracking-wider">partner_init.sh</div>
                  <FileJson className="w-3.5 h-3.5 text-white/30" />
                </div>
                <div className="p-5 text-[13px] font-mono overflow-x-auto leading-relaxed">
                  <div className="text-white/30 mb-3"># Initialize a partner sandbox environment</div>
                  <div className="text-white flex items-center gap-2">
                    <span className="text-white/30">$</span> 
                    <span>sabnode partner init --type=agency</span>
                  </div>
                  <div className="text-white/50 mt-4">Creating sandbox workspace <span className="text-white">agency-demo-xyz</span>...</div>
                  <div className="text-white/50">Provisioning databases...</div>
                  <div className="text-white/50">Applying default schema...</div>
                  <div className="text-white mt-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-white" /> Done! Credentials saved to .env.partner
                  </div>
                </div>
              </div>

              {/* API Response Mockup */}
              <div className="rounded border border-white/10 bg-black overflow-hidden relative">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0a0a0a]">
                  <div className="px-2 py-0.5 bg-white text-black text-[10px] font-bold tracking-widest rounded-sm uppercase">GET</div>
                  <div className="text-xs text-white/50 font-mono">/v1/partners/commissions</div>
                </div>
                <div className="p-5 text-[13px] font-mono overflow-x-auto text-white/70 leading-relaxed">
<pre>{`{
  "object": "list",
  "data": [
    {
      "id": "com_1N2M3L",
      "amount": 45000,
      "currency": "usd",
      "status": "pending",
      "description": "Enterprise Plan - Q3",
      "referred_account_id": "acc_8X9Y0Z"
    },
    {
      "id": "com_7P8Q9R",
      "amount": 125000,
      "currency": "usd",
      "status": "paid",
      "description": "Annual Setup Fee",
      "referred_account_id": "acc_3A4B5C"
    }
  ],
  "has_more": false
}`}</pre>
                </div>
              </div>

              {/* Webhook Mockup */}
              <div className="rounded border border-white/10 bg-black overflow-hidden relative">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0a0a0a]">
                  <div className="px-2 py-0.5 border border-white/20 text-white text-[10px] font-bold tracking-widest rounded-sm uppercase">POST</div>
                  <div className="text-xs text-white/50 font-mono">webhook.receive</div>
                </div>
                <div className="p-5 text-[13px] font-mono overflow-x-auto text-white/50 leading-relaxed">
<pre>{`{
  "type": "partner.referral.converted",
  "created": 1698765432,
  "data": {
    "object": {
      "id": "ref_9A8B7C",
      "account_name": "Acme Corp",
      "plan": "enterprise",
      "commission_rate": 0.30
    }
  }
}`}</pre>
                </div>
              </div>

              {/* CTA Block in the code column */}
              <div className="p-6 rounded border border-white bg-white text-black mt-8">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Start Building
                </h3>
                <p className="text-sm opacity-80 mb-5 font-sans leading-relaxed">
                  Get your partner API keys instantly. No credit card required for sandbox environments.
                </p>
                <button className="w-full py-2.5 bg-black text-white rounded font-semibold text-sm hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
                  Generate API Key <ArrowRight className="w-4 h-4"/>
                </button>
              </div>

            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
