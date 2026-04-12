'use client';

/**
 * Footer — glossy emerald glass panel with links, socials, and contact info.
 * (Previously wrapped a root-system SVG; the tree illustration has been
 * removed and only the content panel remains.)
 */

import * as React from 'react';
import Link from 'next/link';
import { Linkedin } from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import {
  FacebookIcon as FacebookAppIcon,
  InstagramIcon,
} from '@/components/wabasimplify/custom-sidebar-components';

export function Footer() {
  return (
    <footer className="relative pt-24 pb-10">
      <div className="container mx-auto px-6 relative z-10">
        <div
          className="rounded-3xl p-8 md:p-12"
          style={{
            background:
              'linear-gradient(155deg, rgba(240,253,244,0.92) 0%, rgba(209,250,229,0.6) 100%)',
            backdropFilter: 'blur(14px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
            border: '1px solid rgba(167, 243, 208, 0.7)',
            boxShadow:
              '0 30px 80px -30px rgba(6, 78, 59, 0.25), 0 0 0 1px rgba(255,255,255,0.6) inset',
          }}
        >
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 md:col-span-5 space-y-4">
              <SabNodeLogo className="h-8 w-auto" />
              <p className="text-sm text-emerald-900/70 max-w-sm leading-relaxed">
                A connected platform for WhatsApp, marketing, sales and daily
                business operations. Built for execution.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <FooterIcon>
                  <FacebookAppIcon className="h-4 w-4" />
                </FooterIcon>
                <FooterIcon>
                  <InstagramIcon className="h-4 w-4" />
                </FooterIcon>
                <FooterIcon>
                  <Linkedin className="h-4 w-4" />
                </FooterIcon>
              </div>
              <div className="text-xs text-emerald-800/60 space-y-0.5 pt-4">
                <p>info@sabnode.in</p>
                <p>D829 Sector 5, Malviya Nagar, Jaipur 302017</p>
              </div>
            </div>

            <FooterGroup
              title="Modules"
              links={[
                { href: '#modules', label: 'Modules' },
                { href: '#use-cases', label: 'Use cases' },
                { href: '/pricing', label: 'Pricing' },
                { href: '/login', label: 'Sign in' },
              ]}
            />
            <FooterGroup
              title="Company"
              links={[
                { href: '/about-us', label: 'About' },
                { href: '/contact', label: 'Contact' },
                { href: '/careers', label: 'Careers' },
                { href: '/blog', label: 'Blog' },
              ]}
            />
            <FooterGroup
              title="Legal"
              links={[
                { href: '/terms-and-conditions', label: 'Terms' },
                { href: '/privacy-policy', label: 'Privacy' },
              ]}
            />
          </div>

          <div className="mt-12 pt-6 border-t border-emerald-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-800/60">
            <p>© {new Date().getFullYear()} SabNode. Built for execution.</p>
            <p className="tracking-[0.12em] uppercase">Proof &gt; Promise</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterIcon({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href="#"
      className="h-9 w-9 rounded-full border border-emerald-200 bg-white/70 flex items-center justify-center text-emerald-700 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 transition-colors"
    >
      {children}
    </Link>
  );
}

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="col-span-6 md:col-span-2">
      <h3 className="text-[11px] tracking-[0.12em] uppercase text-emerald-950 font-semibold mb-4">
        {title}
      </h3>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-emerald-900/70 hover:text-emerald-700 transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
