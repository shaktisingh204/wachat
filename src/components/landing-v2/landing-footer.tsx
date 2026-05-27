'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { Github, Linkedin, Twitter } from 'lucide-react';

const cols = [
    {
        title: 'Products',
        links: [
            { label: 'Wachat', href: '/dashboard/wachat' },
            { label: 'SabFlow', href: '/dashboard/sabflow' },
            { label: 'SabChat', href: '/dashboard/sabchat' },
            { label: 'CRM', href: '/dashboard/crm' },
            { label: 'SEO', href: '/dashboard/seo' },
            { label: 'HRM', href: '/dashboard/hrm' },
        ],
    },
    {
        title: 'Resources',
        links: [
            { label: 'Pricing', href: '/pricing' },
            { label: 'Customers', href: '/customers' },
            { label: 'Features', href: '/features' },
            { label: 'Blog', href: '/blog' },
            { label: 'Help center', href: '/help' },
            { label: 'Changelog', href: '/changelog' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About', href: '/about-us' },
            { label: 'Careers', href: '/careers' },
            { label: 'Contact', href: '/contact' },
            { label: 'Partners', href: '/partners' },
            { label: 'Press', href: '/press' },
        ],
    },
    {
        title: 'Legal',
        links: [
            { label: 'Terms', href: '/terms' },
            { label: 'Privacy', href: '/privacy' },
            { label: 'DPA', href: '/dpa' },
            { label: 'Security', href: '/security' },
            { label: 'Status', href: '/status' },
        ],
    },
];

export function LandingFooter() {
    return (
        <footer className="relative border-t border-zoru-line/70 bg-white">
            <div className="mx-auto max-w-7xl px-6 py-16">
                <div className="grid gap-12 md:grid-cols-12">
                    <div className="md:col-span-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-zoru-surface-2 via-zoru-ink to-zoru-ink shadow-lg shadow-zoru-line/30">
                                <span className="text-sm font-black text-white">S</span>
                            </div>
                            <span className="text-lg font-semibold tracking-tight text-zoru-ink">SabNode</span>
                        </Link>
                        <p className="mt-5 max-w-xs text-sm leading-relaxed text-zoru-ink">
                            The operating system for your customer-facing business. Six products, one tenant, one bill.
                        </p>
                        <div className="mt-6 flex items-center gap-2">
                            {[
                                { label: 'Twitter', href: 'https://twitter.com', icon: Twitter },
                                { label: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
                                { label: 'GitHub', href: 'https://github.com', icon: Github },
                            ].map((s) => {
                                const Icon = s.icon;
                                return (
                                    <a
                                        key={s.label}
                                        href={s.href}
                                        aria-label={s.label}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="grid h-9 w-9 place-items-center rounded-full border border-zoru-line bg-white text-zoru-ink transition hover:border-zoru-line hover:text-zoru-ink"
                                    >
                                        <Icon className="h-4 w-4" />
                                    </a>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 md:col-span-8 md:grid-cols-4">
                        {cols.map((col, i) => (
                            <m.div
                                key={col.title}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <h4 className="text-xs font-semibold uppercase tracking-widest text-zoru-ink">{col.title}</h4>
                                <ul className="mt-4 space-y-2.5">
                                    {col.links.map((l) => (
                                        <li key={l.href}>
                                            <Link href={l.href} className="text-sm text-zoru-ink transition hover:text-zoru-ink">
                                                {l.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </m.div>
                        ))}
                    </div>
                </div>

                <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-zoru-line/70 pt-6 text-xs text-zoru-ink md:flex-row">
                    <div>© {new Date().getFullYear()} SabNode. All rights reserved.</div>
                    <div className="flex items-center gap-2">
                        <span className="relative inline-flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zoru-surface-2 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-zoru-ink" />
                        </span>
                        <span>All systems operational</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
