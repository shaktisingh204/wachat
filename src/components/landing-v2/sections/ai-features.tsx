'use client';

import { m } from 'motion/react';
import { Wand2, Languages, HeartPulse, Bot } from 'lucide-react';

const features = [
    {
        name: 'Smart drafts',
        desc: 'AI writes the next reply in your tone — pulls customer history, past tickets, plan tier, order status.',
        icon: Wand2,
        accent: 'from-zoru-surface-2 to-zoru-ink',
    },
    {
        name: 'Live translate',
        desc: 'Speak any language. Inbound + outbound auto-translate to 60+ languages in real time.',
        icon: Languages,
        accent: 'from-zoru-surface-2 to-zoru-ink',
    },
    {
        name: 'Sentiment radar',
        desc: 'Detect angry, churn-risk, or upsell moments the second they appear. Auto-escalate VIPs.',
        icon: HeartPulse,
        accent: 'from-zoru-surface-2 to-zoru-ink',
    },
    {
        name: 'Resolve bot',
        desc: 'Auto-answers tier-1 questions from your help center. Confidence-gated. Always hands off cleanly.',
        icon: Bot,
        accent: 'from-zoru-surface-2 to-zoru-ink',
    },
];

export function AiFeatures() {
    return (
        <section className="relative py-32">
            <div className="mx-auto max-w-7xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mx-auto max-w-3xl text-center"
                >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zoru-ink">
                        Smart Assist
                    </p>
                    <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zoru-ink sm:text-5xl md:text-6xl">
                        AI that actually closes tickets.
                    </h2>
                    <p className="mt-5 text-pretty text-lg text-zoru-ink">
                        Not a chat widget bolted onto a database. SabNode reads every channel, every CRM
                        record, every order — then helps your team reply faster, smarter, and in any language.
                    </p>
                </m.div>

                <div className="mt-20 grid grid-cols-1 gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-4">
                    {features.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <m.div
                                key={f.name}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08 }}
                                className="group relative"
                            >
                                <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${f.accent} shadow-md`}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold tracking-tight text-zoru-ink">{f.name}</h3>
                                <p className="mt-2 text-[15px] leading-relaxed text-zoru-ink">{f.desc}</p>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
