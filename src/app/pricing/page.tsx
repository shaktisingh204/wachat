"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { LandingHeader } from '@/components/landing/landing-header';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Check, X, ArrowRight, Terminal, DollarSign, CreditCard } from 'lucide-react';

const plans = [
    {
        id: 'basic',
        name: 'Basic_Node',
        description: '// Minimal configuration for experimental environments.',
        isPopular: false,
        features: [
            '1_Project_Runtime',
            '1000_Monthly_Requests',
            'Standard_API_Limits',
            'Community_Support_Only'
        ],
        cta: 'npm install --tier=basic'
    },
    {
        id: 'pro',
        name: 'Pro_Node',
        description: '// Production-ready infrastructure for heavy workloads.',
        isPopular: true,
        features: [
            '5_Project_Runtimes',
            '10000_Monthly_Requests',
            'Advanced_Flow_Processing',
            'AI_Copilot_Enabled',
            'Priority_Queue_Support'
        ],
        cta: 'npm install --tier=pro'
    },
    {
        id: 'enterprise',
        name: 'Enterprise_Cluster',
        description: '// Distributed, dedicated cluster with unlimited scale.',
        isPopular: false,
        features: [
            'Unlimited_Project_Runtimes',
            'Custom_Request_Quotas',
            'Dedicated_Sysadmin',
            'Root_API_Access',
            'Custom_Webhooks'
        ],
        cta: './init_handshake.sh'
    }
];

const pricingData = {
    INR: {
        symbol: '₹',
        monthly: {
            basic: 499,
            pro: 1499,
            enterprise: 'CUSTOM'
        },
        annual: {
            basic: 399,
            pro: 1199,
            enterprise: 'CUSTOM'
        }
    },
    USD: {
        symbol: '$',
        monthly: {
            basic: 9,
            pro: 29,
            enterprise: 'CUSTOM'
        },
        annual: {
            basic: 7,
            pro: 24,
            enterprise: 'CUSTOM'
        }
    }
};

const featureMatrix = [
    {
        category: 'Compute & Execution',
        items: [
            { name: 'Project Runtimes', basic: '1', pro: '5', enterprise: 'Unlimited' },
            { name: 'Monthly Requests', basic: '1,000', pro: '10,000', enterprise: 'Custom' },
            { name: 'Concurrent Executions', basic: '10', pro: '50', enterprise: 'Custom' },
        ]
    },
    {
        category: 'Development & API',
        items: [
            { name: 'API Access', basic: 'Standard', pro: 'Standard', enterprise: 'Root Access' },
            { name: 'Webhooks', basic: 'Limited (5)', pro: 'Standard (50)', enterprise: 'Unlimited' },
            { name: 'Flow Processing', basic: false, pro: 'Advanced', enterprise: 'Custom Logic' },
            { name: 'AI Copilot', basic: false, pro: true, enterprise: true },
        ]
    },
    {
        category: 'Support & SLAs',
        items: [
            { name: 'Support Level', basic: 'Community', pro: 'Priority Email', enterprise: 'Dedicated Sysadmin' },
            { name: 'Uptime SLA', basic: false, pro: '99.9%', enterprise: '99.99%' },
            { name: 'Custom Contracts', basic: false, pro: false, enterprise: true },
        ]
    }
];

export default function PricingPage() {
    const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        // Entrance animation
        gsap.from('.stagger-enter', {
            y: 30,
            opacity: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power3.out'
        });
    }, { scope: containerRef });

    // Handle price change animation when toggles change
    useGSAP(() => {
        gsap.from('.price-display', {
            y: -10,
            opacity: 0,
            duration: 0.3,
            stagger: 0.05,
            ease: 'power2.out'
        });
    }, { dependencies: [currency, billingCycle], scope: containerRef });

    const handleCheckout = (planId: string) => {
        setLoadingCheckout(planId);
        // Simulate Deep Billing Integration delay
        setTimeout(() => {
            alert(`Redirecting to Stripe Checkout for ${planId.toUpperCase()} plan...\n(Billing Engine Integration via Stripe)`);
            setLoadingCheckout(null);
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black" ref={containerRef}>
            <div className="border-b border-white/20 stagger-enter">
                <LandingHeader active="pricing" />
            </div>

            <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="mb-16 border-l-2 border-white pl-6 stagger-enter">
                    <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-flex items-center text-sm uppercase tracking-widest transition-colors">
                        <span className="mr-2">&lt;</span> cd ..
                    </Link>
                    <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter">GET /pricing</h1>
                    
                    <div className="mt-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div className="p-4 bg-white/5 border border-white/20 overflow-x-auto w-full md:w-auto">
                            <pre className="text-sm text-gray-300">
{`{
  "endpoint": "/v1/billing/tiers",
  "status": 200,
  "currency": "${currency}"
}`}
                            </pre>
                        </div>
                        
                        {/* Toggles */}
                        <div className="flex flex-col gap-4 self-stretch md:self-auto md:items-end">
                            {/* Billing Cycle Toggle */}
                            <div className="flex items-center border border-white/30 p-1 bg-black w-full md:w-auto">
                                <button
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors w-1/2 md:w-auto ${
                                        billingCycle === 'monthly' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setBillingCycle('annual')}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors w-1/2 md:w-auto flex items-center justify-center gap-2 ${
                                        billingCycle === 'annual' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    Annual <span className="text-[10px] bg-green-500/20 text-green-400 px-1 py-0.5 ml-1 border border-green-500/30">SAVE 20%</span>
                                </button>
                            </div>

                            {/* Currency Toggle */}
                            <div className="flex items-center border border-white/30 p-1 bg-black w-full md:w-auto">
                                <button
                                    onClick={() => setCurrency('INR')}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors w-1/2 md:w-auto ${
                                        currency === 'INR' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    ₹ INR
                                </button>
                                <button
                                    onClick={() => setCurrency('USD')}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors w-1/2 md:w-auto ${
                                        currency === 'USD' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    $ USD
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-24">
                    {plans.map((plan) => {
                        const price = pricingData[currency][billingCycle][plan.id as keyof typeof pricingData['INR']['monthly']];
                        const symbol = pricingData[currency].symbol;
                        const isCustom = price === 'CUSTOM';
                        
                        return (
                            <div 
                                key={plan.name} 
                                className={`stagger-enter relative flex flex-col h-full p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] ${
                                    plan.isPopular 
                                    ? 'bg-white text-black border-2 border-white' 
                                    : 'bg-black text-white border-2 border-white'
                                }`}
                            >
                                {plan.isPopular && (
                                    <div className="absolute -top-4 right-4 bg-black text-white px-4 py-1 text-xs font-bold border border-white tracking-widest uppercase">
                                        [ RECOMMENDED ]
                                    </div>
                                )}
                                
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">&lt;{plan.name} /&gt;</h2>
                                    <p className={`text-sm h-10 ${plan.isPopular ? 'text-gray-700' : 'text-gray-400'}`}>{plan.description}</p>
                                    
                                    <div className="mt-8 flex flex-col h-20">
                                        <span className="text-sm uppercase tracking-widest opacity-70 mb-1">
                                            Cost / {billingCycle === 'annual' ? 'Month (Billed Annually)' : 'Month'}
                                        </span>
                                        <div className="flex items-baseline gap-2 price-display">
                                            {isCustom ? (
                                                <span className="text-4xl font-bold tracking-tighter">CONTACT_US</span>
                                            ) : (
                                                <>
                                                    <span className="text-5xl font-bold tracking-tighter">{symbol}{price}</span>
                                                    <span className="text-lg">{currency}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex-grow space-y-4 mb-10">
                                    <div className={`text-xs uppercase tracking-widest mb-4 border-b pb-2 ${plan.isPopular ? 'border-black/20' : 'border-white/20'}`}>
                                        Parameters:
                                    </div>
                                    <ul className="space-y-4 font-mono text-sm">
                                        {plan.features.map(feature => (
                                            <li key={feature} className="flex items-start">
                                                <span className="mr-3 font-bold opacity-70">[x]</span>
                                                <span className="break-all">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                
                                <div className="mt-auto">
                                    <button 
                                        onClick={() => handleCheckout(plan.id)}
                                        disabled={loadingCheckout === plan.id}
                                        className={`w-full py-4 px-6 text-sm font-bold uppercase tracking-widest border-2 transition-colors flex items-center justify-center gap-2 ${
                                            plan.isPopular 
                                            ? 'bg-black text-white border-black hover:bg-white hover:text-black disabled:bg-gray-800 disabled:text-gray-400' 
                                            : 'bg-white text-black border-white hover:bg-black hover:text-white disabled:bg-gray-200 disabled:text-gray-500'
                                        }`}
                                    >
                                        {loadingCheckout === plan.id ? (
                                            <span className="animate-pulse">_PROCESSING...</span>
                                        ) : (
                                            <>
                                                <Terminal size={16} />
                                                <span>{plan.cta}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Feature Comparison Matrix */}
                <div className="stagger-enter mt-24">
                    <div className="mb-12 border-l-2 border-white pl-6">
                        <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter">Feature Matrix</h2>
                        <p className="text-gray-400 mt-2 text-sm uppercase tracking-widest">// Detailed specs for engineering teams</p>
                    </div>

                    <div className="overflow-x-auto border border-white/20">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="p-4 border-b border-white/20 bg-white/5 font-bold uppercase tracking-widest w-1/4">System Capability</th>
                                    <th className="p-4 border-b border-white/20 bg-white/5 font-bold uppercase tracking-widest w-1/4 text-center">Basic_Node</th>
                                    <th className="p-4 border-b border-white/20 bg-white text-black font-bold uppercase tracking-widest w-1/4 text-center">Pro_Node</th>
                                    <th className="p-4 border-b border-white/20 bg-white/5 font-bold uppercase tracking-widest w-1/4 text-center">Enterprise</th>
                                </tr>
                            </thead>
                            <tbody>
                                {featureMatrix.map((category, idx) => (
                                    <React.Fragment key={idx}>
                                        {/* Category Header */}
                                        <tr>
                                            <td colSpan={4} className="p-4 border-b border-white/20 bg-black text-gray-400 text-xs font-bold uppercase tracking-widest pt-8 pb-2">
                                                /* {category.category} */
                                            </td>
                                        </tr>
                                        {/* Items */}
                                        {category.items.map((item, itemIdx) => (
                                            <tr key={itemIdx} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 border-b border-white/10 text-sm">{item.name}</td>
                                                <td className="p-4 border-b border-white/10 text-sm text-center text-gray-300">
                                                    {typeof item.basic === 'boolean' ? (
                                                        item.basic ? <Check className="mx-auto text-green-400" size={18} /> : <X className="mx-auto text-red-400/50" size={18} />
                                                    ) : (
                                                        item.basic
                                                    )}
                                                </td>
                                                <td className="p-4 border-b border-white/10 text-sm text-center bg-white/5 font-medium">
                                                    {typeof item.pro === 'boolean' ? (
                                                        item.pro ? <Check className="mx-auto text-green-400" size={18} /> : <X className="mx-auto text-red-400/50" size={18} />
                                                    ) : (
                                                        item.pro
                                                    )}
                                                </td>
                                                <td className="p-4 border-b border-white/10 text-sm text-center text-gray-300">
                                                    {typeof item.enterprise === 'boolean' ? (
                                                        item.enterprise ? <Check className="mx-auto text-green-400" size={18} /> : <X className="mx-auto text-red-400/50" size={18} />
                                                    ) : (
                                                        item.enterprise
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FAQ or Footer CTA */}
                <div className="stagger-enter mt-24 mb-16 border border-white p-8 md:p-12 bg-[url('/grid.svg')] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-2">Need a custom topology?</h3>
                            <p className="text-gray-400 max-w-xl">
                                Talk to our engineering team for specialized compliance requirements, dedicated hosting, or high-throughput SLAs.
                            </p>
                        </div>
                        <button className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-transparent hover:text-white border-2 border-white transition-all whitespace-nowrap flex items-center gap-2">
                            <span>Open Ticket</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
