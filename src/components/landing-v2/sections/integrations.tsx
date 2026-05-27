'use client';

import { m } from 'motion/react';

const integrations = [
    'WhatsApp', 'Instagram', 'Facebook', 'Telegram', 'Gmail', 'Outlook',
    'Stripe', 'Razorpay', 'PayPal', 'Shopify', 'WooCommerce', 'Magento',
    'Salesforce', 'HubSpot', 'Zoho', 'Pipedrive', 'Slack', 'Microsoft Teams',
    'Notion', 'Linear', 'Jira', 'GitHub', 'GitLab', 'Twilio',
    'SendGrid', 'Mailgun', 'Calendly', 'Zoom', 'Google Calendar', 'Zapier',
];

const row1 = integrations.slice(0, 15);
const row2 = integrations.slice(15);

function MarqueeRow({ items, direction = 1 }: { items: string[]; direction?: 1 | -1 }) {
    const doubled = [...items, ...items];
    return (
        <div className="relative overflow-hidden">
            <m.div
                className="flex gap-8"
                animate={{ x: direction === 1 ? ['0%', '-50%'] : ['-50%', '0%'] }}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            >
                {doubled.map((name, i) => (
                    <div
                        key={`${name}-${i}`}
                        className="flex-shrink-0 text-2xl font-semibold tracking-tight text-zoru-ink-muted hover:text-zoru-ink"
                    >
                        {name}
                    </div>
                ))}
            </m.div>
        </div>
    );
}

export function Integrations() {
    return (
        <section className="relative overflow-hidden py-28">
            <div className="mx-auto max-w-3xl px-6 text-center">
                <m.h2
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-balance text-4xl font-semibold tracking-tight text-zoru-ink sm:text-5xl md:text-6xl"
                >
                    Connects to everything you already use.
                </m.h2>
                <m.p
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.08 }}
                    className="mt-5 text-lg text-zoru-ink"
                >
                    900+ integrations. Native or one-click. No code, no zaps, no glue jobs.
                </m.p>
            </div>

            <div
                className="mt-16 space-y-6"
                style={{
                    maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                }}
            >
                <MarqueeRow items={row1} direction={1} />
                <MarqueeRow items={row2} direction={-1} />
            </div>
        </section>
    );
}
