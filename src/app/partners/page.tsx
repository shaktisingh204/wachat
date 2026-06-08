import type { Metadata } from 'next';
import Link from 'next/link';
export const dynamic = 'force-dynamic';

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
  ArrowUpRight,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
import { MobileSidebar } from './components/MobileSidebar';
import { PartnerApplicationForm } from './components/PartnerApplicationForm';
import { PartnerDirectory } from './components/PartnerDirectory';
import { CommissionCalculator } from './components/CommissionCalculator';
import { CopyableCodeBlock } from './components/CopyableCodeBlock';
import { TerminalMockup } from './components/TerminalMockup';

export const metadata: Metadata = {
  title: 'Partners | SabNode',
  description: 'Partner with SabNode through agency, developer, and referral programs for customer operations.',
};

export default function PartnersPage() {
  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] font-mono antialiased">
      {/* Developer-First OpenAPI layout style */}
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg)]/80 backdrop-blur-md px-6 py-4">
        <div className="flex items-center gap-4">
          <MobileSidebar />
          <Link href="/" className="font-bold tracking-tighter text-xl text-[var(--st-text)] hover:text-[var(--st-text-secondary)] transition-colors">
            SabNode
          </Link>
          <span className="text-[var(--st-text-tertiary)]">/</span>
          <span className="text-[var(--st-text)] font-medium">Partners</span>

          <nav className="hidden lg:flex items-center gap-6 ml-8 text-sm text-[var(--st-text-secondary)]">
            <Link href="#agency" className="hover:text-[var(--st-text)] transition-colors">Agency</Link>
            <Link href="#developer" className="hover:text-[var(--st-text)] transition-colors">Developer</Link>
            <Link href="#referral" className="hover:text-[var(--st-text)] transition-colors">Referral</Link>
            <Link href="#directory" className="hover:text-[var(--st-text)] transition-colors">Directory</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors hidden sm:block"
          >
            Partner Login
          </Link>
          <PartnerApplicationForm />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-73px)] items-stretch">
        {/* Left Sidebar - Navigation */}
        <aside className="w-full lg:w-64 border-r border-[var(--st-border)] p-6 hidden lg:block overflow-y-auto shrink-0 bg-[var(--st-bg)] sticky top-[73px] h-[calc(100vh-73px)]">
          <div className="space-y-10 text-sm">
            <div>
              <h3 className="font-bold text-[var(--st-text-tertiary)] uppercase tracking-widest mb-4 text-xs">Overview</h3>
              <ul className="space-y-3">
                <li><Link href="#introduction" className="text-[var(--st-text)] flex items-center justify-between group">Introduction <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" /></Link></li>
                <li><Link href="#benefits" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors">Benefits</Link></li>
                <li><Link href="#requirements" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors">Requirements</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[var(--st-text-tertiary)] uppercase tracking-widest mb-4 text-xs">Programs</h3>
              <ul className="space-y-3">
                <li><Link href="#agency" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"><Building className="w-3.5 h-3.5" aria-hidden="true" /> Agency Partner</Link></li>
                <li><Link href="#developer" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"><Code2 className="w-3.5 h-3.5" aria-hidden="true" /> Tech Partner</Link></li>
                <li><Link href="#referral" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"><Users className="w-3.5 h-3.5" aria-hidden="true" /> Referral Partner</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[var(--st-text-tertiary)] uppercase tracking-widest mb-4 text-xs">Resources</h3>
              <ul className="space-y-3">
                <li><Link href="#directory" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2">Partner Directory <ArrowRight className="w-3 h-3" aria-hidden="true" /></Link></li>
                <li><Link href="#" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2">API Reference <ArrowUpRight className="w-3 h-3" aria-hidden="true" /></Link></li>
                <li><Link href="#" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2">Brand Assets <ArrowUpRight className="w-3 h-3" aria-hidden="true" /></Link></li>
                <li><Link href="#" className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2">Support <ArrowUpRight className="w-3 h-3" aria-hidden="true" /></Link></li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Main Content Area - Split into Docs & Code/Examples */}
        <main className="flex-1 flex flex-col xl:flex-row bg-[var(--st-bg)] min-w-0">

          {/* Center Docs Column */}
          <div className="flex-1 p-6 md:p-12 lg:p-16 xl:max-w-3xl border-r border-[var(--st-border)]">
            <div className="max-w-2xl mx-auto space-y-20">

              {/* Hero Section */}
              <section id="introduction" className="scroll-mt-24">
                <PageHeader bordered={false}>
                  <PageHeaderHeading>
                    <PageEyebrow>
                      <Badge tone="neutral" kind="outline" className="font-mono">
                        <Terminal className="w-3.5 h-3.5" aria-hidden="true" /> sabnode-partner-network
                      </Badge>
                    </PageEyebrow>
                    <PageTitle className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                      Scale your operations{' '}
                      <span className="text-[var(--st-text-tertiary)]">with SabNode.</span>
                    </PageTitle>
                    <PageDescription className="text-lg text-[var(--st-text-secondary)] leading-relaxed font-sans">
                      Join an elite network of agencies, developers, and consultants building the next generation of customer operations. Gain access to exclusive APIs, revenue sharing, and co-marketing opportunities.
                    </PageDescription>
                  </PageHeaderHeading>
                </PageHeader>
              </section>

              <Separator />

              {/* Agency Program */}
              <section id="agency" className="space-y-8 scroll-mt-24">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[var(--st-text)] text-[var(--st-bg)] rounded-[var(--st-radius)]">
                      <Building className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-[var(--st-text)]">Agency Program</h2>
                  </div>
                  <p className="text-[var(--st-text-secondary)] leading-relaxed font-sans">
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
                    <Card key={i} variant="interactive" padding="md" className="bg-[var(--st-bg-secondary)] group">
                      <h4 className="font-bold text-sm flex items-center gap-2 mb-2 text-[var(--st-text)]">
                        <CheckCircle2 className="w-4 h-4 text-[var(--st-text-tertiary)] group-hover:text-[var(--st-text)] transition-colors" aria-hidden="true" />
                        {item.title}
                      </h4>
                      <p className="text-sm text-[var(--st-text-secondary)] font-sans leading-relaxed">{item.desc}</p>
                    </Card>
                  ))}
                </div>
              </section>

              <Separator />

              {/* Developer Program */}
              <section id="developer" className="space-y-8 scroll-mt-24">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[var(--st-text)] text-[var(--st-bg)] rounded-[var(--st-radius)]">
                      <Code2 className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-[var(--st-text)]">Technology Partner</h2>
                  </div>
                  <p className="text-[var(--st-text-secondary)] leading-relaxed font-sans">
                    For ISVs and developers building integrations. Publish your app in the SabNode Marketplace and access thousands of potential customers.
                  </p>
                </div>

                <Card variant="outlined" padding="lg" className="bg-[var(--st-bg-secondary)]">
                  <ul className="space-y-5">
                    {[
                      "OAuth 2.0 application registration and management.",
                      "Access to high-volume rate limits and webhook delivery.",
                      "Dedicated solutions engineering support for complex builds.",
                      "Revenue share for paid marketplace applications."
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[var(--st-text-secondary)] font-sans">
                        <Shield className="w-4 h-4 mt-0.5 text-[var(--st-text-tertiary)] shrink-0" aria-hidden="true" />
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>

              <Separator />

              {/* Referral Program */}
              <section id="referral" className="space-y-8 scroll-mt-24 pb-20">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 border border-[var(--st-border-strong)] text-[var(--st-text)] rounded-[var(--st-radius)]">
                      <Users className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-[var(--st-text)]">Referral Partner</h2>
                  </div>
                  <p className="text-[var(--st-text-secondary)] leading-relaxed font-sans">
                    For consultants, creators, and advisors. Simply refer clients to SabNode and earn a commission for every successful conversion.
                  </p>
                </div>
                <CommissionCalculator />
              </section>

              <Separator />

              <section id="directory" className="space-y-8 scroll-mt-24 pb-20">
                <PartnerDirectory />
              </section>

            </div>
          </div>

          {/* Right Column - Code / Examples */}
          <div className="w-full xl:w-[480px] 2xl:w-[540px] p-6 lg:p-8 bg-[var(--st-bg-secondary)] xl:sticky xl:top-[73px] xl:h-[calc(100vh-73px)] xl:overflow-y-auto">
            <div className="space-y-8">

              {/* Terminal Mockup */}
              <TerminalMockup />

              {/* API Response Mockup */}
              <CopyableCodeBlock
                method="GET"
                endpoint="/v1/partners/commissions"
                code={`{
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
}`}
              />

              {/* Webhook Mockup */}
              <CopyableCodeBlock
                method="POST"
                endpoint="webhook.receive"
                isWebhook={true}
                code={`{
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
}`}
              />

              {/* CTA Block in the code column */}
              <Card variant="elevated" padding="lg" className="bg-[var(--st-accent)] text-[var(--st-text-inverted)] mt-8">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5" aria-hidden="true" /> Start Building
                </h3>
                <p className="text-sm opacity-90 mb-5 font-sans leading-relaxed">
                  Get your partner API keys instantly. No credit card required for sandbox environments.
                </p>
                <Button variant="secondary" block iconRight={ArrowRight}>
                  Generate API Key
                </Button>
              </Card>

            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
