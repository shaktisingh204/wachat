'use client';

import { m } from 'motion/react';

/* Real brand SVGs scraped into public/brand-logos/ by
 * scripts/fetch-brand-logos.mjs (Iconify `logos` + simpleicons.org). */
const BRANDS: { name: string; file: string }[] = [
    { name: 'Google', file: 'google' },
    { name: 'Meta', file: 'meta' },
    { name: 'Shopify', file: 'shopify' },
    { name: 'Razorpay', file: 'razorpay' },
    { name: 'Stripe', file: 'stripe' },
    { name: 'Slack', file: 'slack' },
    { name: 'Notion', file: 'notion' },
    { name: 'Zapier', file: 'zapier' },
    { name: 'HubSpot', file: 'hubspot' },
    { name: 'Salesforce', file: 'salesforce' },
    { name: 'Linear', file: 'linear' },
    { name: 'GitHub', file: 'github' },
    { name: 'Postgres', file: 'postgres' },
    { name: 'MongoDB', file: 'mongodb' },
    { name: 'Redis', file: 'redis' },
    { name: 'AWS S3', file: 'awss3' },
];

export function Integrations() {
    return (
        <section className="relative overflow-hidden py-28">
            <div className="mx-auto max-w-6xl px-6">
                <div className="mx-auto max-w-3xl text-center">
                    <m.h2
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl md:text-6xl"
                    >
                        Talks to everything your stack already runs on.
                    </m.h2>
                    <m.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.08 }}
                        className="mt-6"
                    >
                        <a
                            href="/integrations"
                            aria-label="See all 900+ integrations"
                            className="group inline-flex items-center gap-1.5 text-base font-semibold text-zinc-900 underline-offset-4 transition-colors hover:text-orange-600 hover:underline"
                        >
                            See all 900+
                            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                        </a>
                    </m.div>
                </div>

                <ul className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" role="list">
                    {BRANDS.map((brand, i) => (
                        <m.li
                            key={brand.file}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.45, delay: (i % 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-col items-center gap-2.5 rounded-xl border border-zinc-200/70 bg-white/60 px-3 py-5 transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-zinc-300"
                        >
                            <span className="flex h-8 w-8 items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element -- static same-origin SVG */}
                                <img
                                    src={`/brand-logos/${brand.file}.svg`}
                                    alt=""
                                    aria-hidden
                                    width={32}
                                    height={32}
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-8 max-w-8 object-contain"
                                />
                            </span>
                            <span className="text-[13px] font-medium leading-none text-zinc-700">{brand.name}</span>
                        </m.li>
                    ))}
                </ul>

                <m.p
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="mx-auto mt-12 max-w-2xl text-center text-lg text-zinc-600"
                >
                    Plus a clean <span className="font-medium text-zinc-900">REST + Webhook API</span>, signed
                    events, and SDKs for <span className="font-medium text-zinc-900">Node, Python, Go</span>.
                </m.p>
            </div>
        </section>
    );
}
