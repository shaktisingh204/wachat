'use client';

import { m, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Plus } from 'lucide-react';

const faqs = [
    {
        q: 'Do I really need to replace all my tools?',
        a: 'Not at once. Most teams start with SabChat + Wachat, then bring the CRM and SabFlow over once their team logs in daily. The other tools can stay until you decide to switch.',
    },
    {
        q: 'Will SabNode talk to my existing Stripe, Shopify, Gmail?',
        a: 'Yes — 900+ native integrations, OAuth in one click. The full list is in the docs and your data syncs in the background.',
    },
    {
        q: 'How is this different from Zoho One?',
        a: 'Zoho is 40 separate apps you log into separately. SabNode is one tenant, one inbox, one CRM, one bill — built for teams that hate context-switching.',
    },
    {
        q: 'Is my data safe?',
        a: 'SOC2 Type II in progress, GDPR + India DPDP toolkit shipped, SSO and SCIM available on Enterprise. EU/IN/US regional data residency on request.',
    },
    {
        q: 'Can I bring my own AI keys?',
        a: 'Yes — Smart Assist runs on our pooled credits by default; on Enterprise you can plug your own provider key for cost control.',
    },
    {
        q: 'What happens if I outgrow the plan?',
        a: 'Plans scale by usage, not by seat games. We&apos;ll alert you before you breach. No surprise overage charges, ever.',
    },
];

export function Faq() {
    const [open, setOpen] = useState<number | null>(0);

    return (
        <section className="relative py-32">
            <div className="mx-auto max-w-3xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center"
                >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zoru-ink">
                        Frequently asked
                    </p>
                    <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zoru-ink sm:text-5xl md:text-6xl">
                        Common questions, answered.
                    </h2>
                </m.div>

                <div className="mt-14 divide-y divide-zoru-line/70">
                    {faqs.map((item, i) => {
                        const isOpen = open === i;
                        return (
                            <div key={item.q}>
                                <button
                                    type="button"
                                    onClick={() => setOpen(isOpen ? null : i)}
                                    className="flex w-full items-center justify-between gap-4 py-5 text-left transition"
                                >
                                    <span className="text-lg font-medium text-zoru-ink">{item.q}</span>
                                    <m.span
                                        animate={{ rotate: isOpen ? 45 : 0 }}
                                        transition={{ type: 'spring', bounce: 0.3 }}
                                        className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-zoru-ink/5 text-zoru-ink"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </m.span>
                                </button>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <m.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="pb-6 pr-12 text-[15px] leading-relaxed text-zoru-ink">{item.a}</p>
                                        </m.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
