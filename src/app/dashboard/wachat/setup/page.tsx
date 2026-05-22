'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Checkbox,
  Label,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Badge,
  Select,
} from '@/components/zoruui';
import {
  useState } from 'react';
import EmbeddedSignup from '@/components/wabasimplify/embedded-signup';
import {
    AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  CheckCircle2,
  Lock,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
  } from 'lucide-react';

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* What you unlock                                                      */
/* ------------------------------------------------------------------ */

const UNLOCKS = [
    { icon: Send,      label: 'Bulk Broadcasts',      description: 'Reach thousands with a single click' },
    { icon: MessageCircle, label: 'Live Chat Inbox',  description: 'Reply to conversations in real-time' },
    { icon: Workflow,  label: 'Flow Automation',      description: 'Auto-reply & drip campaigns' },
    { icon: Users,     label: 'Contact Management',   description: 'Segments, tags & smart lists' },
    { icon: Bot,       label: 'AI Chatbot',           description: 'Handles queries 24/7' },
    { icon: Briefcase, label: 'CRM Integration',      description: 'Leads, deals & pipeline' },
];

const TRUST = [
    { icon: ShieldCheck, text: 'Official Meta Partner — uses the secure Embedded Signup flow' },
    { icon: Lock,        text: 'No passwords stored — access via OAuth token only' },
    { icon: BadgeCheck,  text: 'Revoke access anytime from your Meta Business Settings' },
];

const STEPS = [
    { n: '1', title: 'Click "Connect WhatsApp"', sub: 'Opens the official Meta authorization flow in a popup.' },
    { n: '2', title: 'Log in to Facebook',        sub: 'Use the Facebook account linked to your Business portfolio.' },
    { n: '3', title: 'Select your WABA',          sub: 'Choose an existing WhatsApp Business Account or create one.' },
    { n: '4', title: 'You\'re live',              sub: 'Return here — your project appears instantly.' },
];

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function SetupPage() {
    const appId    = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;
    const [includeCatalog, setIncludeCatalog] = useState(true);

    /* Config error state */
    if (!appId || !configId) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <ZoruAlert variant="destructive" className="max-w-lg w-full rounded-2xl">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>Configuration Missing</ZoruAlertTitle>
                    <ZoruAlertDescription className="space-y-2 mt-2">
                        <p>Add these env variables to your <code>.env</code> file:</p>
                        <ul className="list-disc list-inside text-xs space-y-1 font-mono bg-destructive/10 rounded-lg p-3">
                            <li>NEXT_PUBLIC_META_ONBOARDING_APP_ID</li>
                            <li>NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID</li>
                        </ul>
                    </ZoruAlertDescription>
                </ZoruAlert>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="mx-auto max-w-6xl pb-12">

                {/* ── HERO ── */}
                <div className="mb-14 text-center space-y-5">
                    {/* Icon */}
                    <div className="relative mx-auto w-fit">
                        <div className="absolute inset-0 rounded-3xl bg-emerald-200 opacity-40 blur-xl scale-110" />
                        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 shadow-[0_8px_32px_rgba(5,150,105,0.28)]">
                            <MessageCircle className="h-10 w-10 text-white" />
                        </div>
                        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-lime-400 shadow-lg shadow-lime-400/50" />
                        <div className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-teal-400 shadow-lg" />
                    </div>

                    <ZoruBadge className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-1 text-xs font-semibold hover:bg-emerald-100">
                        <Sparkles className="mr-1.5 h-3 w-3" /> Official Meta Embedded Signup
                    </ZoruBadge>

                    <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                        Connect Your{' '}
                        <span className="text-emerald-700">
                            WhatsApp Account
                        </span>
                    </h1>

                    <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
                        Securely link your WhatsApp Business Account to unlock messaging, automation, CRM and AI — all from one dashboard.
                    </p>

                    {/* Primary CTA */}
                    <ZoruDialog>
                        <ZoruDialogTrigger asChild>
                            <ZoruButton size="lg" className="rounded-full px-10 text-base shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.03] transition-all mt-2">
                                <MessageCircle className="mr-2 h-5 w-5" />
                                Connect WhatsApp Account
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </ZoruButton>
                        </ZoruDialogTrigger>
                        <ZoruDialogContent className="sm:max-w-md rounded-3xl border-emerald-200/40">
                            <ZoruDialogHeader>
                                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600">
                                    <MessageCircle className="h-5 w-5 text-white" />
                                </div>
                                <ZoruDialogTitle className="text-lg">Guided WhatsApp Setup</ZoruDialogTitle>
                                <ZoruDialogDescription>
                                    You'll be redirected to Facebook to authorize access. It only takes a minute.
                                </ZoruDialogDescription>
                            </ZoruDialogHeader>

                            <div className="py-4 space-y-5">
                                <EmbeddedSignup
                                    appId={appId}
                                    configId={configId}
                                    includeCatalog={includeCatalog}
                                    state="whatsapp"
                                />

                                <div className="flex items-start gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3">
                                    <ZoruCheckbox
                                        id="include-catalog"
                                        checked={includeCatalog}
                                        onCheckedChange={(c) => setIncludeCatalog(Boolean(c))}
                                        className="mt-0.5 border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                    />
                                    <div>
                                        <ZoruLabel htmlFor="include-catalog" className="text-sm font-medium cursor-pointer">
                                            Include Catalog Management
                                        </ZoruLabel>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Grants permission to manage your WhatsApp product catalog
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {TRUST.slice(0, 2).map((t) => (
                                        <div key={t.text} className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <t.icon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                            {t.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ZoruDialogContent>
                    </ZoruDialog>
                </div>

                {/* ── MAIN GRID ── */}
                <div className="grid gap-6 lg:grid-cols-3">

                    {/* Left: What you unlock */}
                    <div className="lg:col-span-2 rounded-3xl border border-emerald-200/40 bg-white/70 backdrop-blur-xl p-6 md:p-8 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-6">
                            What you unlock
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                            {UNLOCKS.map((u) => (
                                <div key={u.label} className="group flex flex-col gap-2.5 rounded-2xl border border-emerald-100/60 bg-white p-4 transition hover:shadow-md hover:border-emerald-200">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                        <u.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{u.label}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{u.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* How it works */}
                        <div className="mt-8 pt-6 border-t border-emerald-100/60">
                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-5">How it works</p>
                            <div className="space-y-0">
                                {STEPS.map((s, idx) => (
                                    <div key={s.n} className="flex gap-4">
                                        {/* Step line */}
                                        <div className="flex flex-col items-center">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-md shadow-emerald-500/25">
                                                {s.n}
                                            </div>
                                            {idx < STEPS.length - 1 && (
                                                <div className="mt-1 mb-1 w-px flex-1 bg-emerald-200" style={{ minHeight: 24 }} />
                                            )}
                                        </div>
                                        <div className="pb-5">
                                            <p className="font-semibold text-sm">{s.title}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Trust + CTA card */}
                    <div className="flex flex-col gap-4">

                        {/* Trust card */}
                        <div className="rounded-3xl border border-emerald-200/40 bg-white/70 backdrop-blur-xl p-6 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-4">Security & Trust</p>
                            <div className="space-y-4">
                                {TRUST.map((t) => (
                                    <div key={t.text} className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                                            <t.icon className="h-3.5 w-3.5" />
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-snug">{t.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Requirements card */}
                        <div className="rounded-3xl border border-emerald-200/40 bg-white/70 backdrop-blur-xl p-6 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-4">Before you start</p>
                            <ul className="space-y-3">
                                {[
                                    'A Facebook account with admin access to your Business portfolio',
                                    'A verified Meta Business Account',
                                    'A phone number not already registered on WhatsApp personal',
                                ].map((req) => (
                                    <li key={req} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                        {req}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* CTA card */}
                        <div className="relative overflow-hidden rounded-3xl border border-emerald-700 bg-emerald-700 p-6 text-white shadow-xl shadow-emerald-500/25">
                            <div className="relative space-y-3">
                                <Zap className="h-7 w-7 text-lime-300" />
                                <p className="font-bold text-lg leading-snug">Ready to start reaching customers?</p>
                                <p className="text-sm text-white/90">Connect your account in under 2 minutes.</p>
                                <ZoruDialog>
                                    <ZoruDialogTrigger asChild>
                                        <ZoruButton className="w-full rounded-xl bg-white text-emerald-700 hover:bg-white/90 font-semibold shadow-lg mt-1">
                                            <MessageCircle className="mr-2 h-4 w-4" />
                                            Connect Now
                                        </ZoruButton>
                                    </ZoruDialogTrigger>
                                    <ZoruDialogContent className="sm:max-w-md rounded-3xl border-emerald-200/40">
                                        <ZoruDialogHeader>
                                            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600">
                                                <MessageCircle className="h-5 w-5 text-white" />
                                            </div>
                                            <ZoruDialogTitle className="text-lg">Guided WhatsApp Setup</ZoruDialogTitle>
                                            <ZoruDialogDescription>
                                                You'll be redirected to Facebook to authorize access.
                                            </ZoruDialogDescription>
                                        </ZoruDialogHeader>
                                        <div className="py-4 space-y-5">
                                            <EmbeddedSignup
                                                appId={appId}
                                                configId={configId}
                                                includeCatalog={includeCatalog}
                                                state="whatsapp"
                                            />
                                            <div className="flex items-start gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3">
                                                <ZoruCheckbox
                                                    id="include-catalog-2"
                                                    checked={includeCatalog}
                                                    onCheckedChange={(c) => setIncludeCatalog(Boolean(c))}
                                                    className="mt-0.5 border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                />
                                                <div>
                                                    <ZoruLabel htmlFor="include-catalog-2" className="text-sm font-medium cursor-pointer">
                                                        Include Catalog Management
                                                    </ZoruLabel>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Grants permission to manage your WhatsApp product catalog
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </ZoruDialogContent>
                                </ZoruDialog>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
