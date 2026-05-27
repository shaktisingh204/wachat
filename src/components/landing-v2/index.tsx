'use client';

import { LandingNav } from './landing-nav';
import { LandingFooter } from './landing-footer';
import { Hero } from './sections/hero';
import { TrustBar } from './sections/trust-bar';
import { ModulesGrid } from './sections/modules-grid';
import { SabchatFeature } from './sections/sabchat-feature';
import { SabflowDemo } from './sections/sabflow-demo';
import { WachatDemo } from './sections/wachat-demo';
import { CrmDemo } from './sections/crm-demo';
import { SeoDemo } from './sections/seo-demo';
import { HrmDemo } from './sections/hrm-demo';
import { AiFeatures } from './sections/ai-features';
import { HowItWorks } from './sections/how-it-works';
import { Integrations } from './sections/integrations';
import { Comparison } from './sections/comparison';
import { StatsBanner } from './sections/stats-banner';
import { Security } from './sections/security';
import { PricingTeaser } from './sections/pricing-teaser';
import { Testimonials } from './sections/testimonials';
import { Faq } from './sections/faq';
import { FinalCta } from './sections/final-cta';

interface LandingV2Props {
    initialSession: { user?: unknown } | null;
}

export function LandingV2({ initialSession }: LandingV2Props) {
    return (
        <div className="relative min-h-screen overflow-x-clip bg-zoru-surface text-zoru-ink antialiased">
            {/* page-wide ambient backdrop */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.08), transparent 60%), radial-gradient(ellipse 80% 50% at 50% 110%, rgba(244,63,94,0.06), transparent 60%)',
                }}
            />

            <LandingNav session={initialSession} />

            <main className="relative z-10">
                <Hero session={initialSession} />
                <TrustBar />
                <ModulesGrid />
                <SabchatFeature />
                <SabflowDemo />
                <WachatDemo />
                <CrmDemo />
                <SeoDemo />
                <HrmDemo />
                <AiFeatures />
                <HowItWorks />
                <Integrations />
                <Comparison />
                <StatsBanner />
                <Security />
                <PricingTeaser />
                <Testimonials />
                <Faq />
                <FinalCta session={initialSession} />
            </main>

            <LandingFooter />
        </div>
    );
}
