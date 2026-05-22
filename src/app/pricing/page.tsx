import Link from 'next/link';
import { LandingHeader } from '@/components/landing/landing-header';

const plans = [
    {
        name: 'Basic_Node',
        price: '₹499',
        description: '// Minimal configuration for experimental environments.',
        features: [
            '1_Project_Runtime',
            '1000_Monthly_Requests',
            'Standard_API_Limits',
            'Community_Support_Only'
        ],
        cta: 'npm install --tier=basic'
    },
    {
        name: 'Pro_Node',
        price: '₹1499',
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
        name: 'Enterprise_Cluster',
        price: 'CONTACT_US',
        description: '// Distributed, dedicated cluster with unlimited scale.',
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

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black">
      <div className="border-b border-white/20">
        <LandingHeader active="pricing" />
      </div>
      <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        <div className="mb-16 border-l-2 border-white pl-6">
            <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-flex items-center text-sm uppercase tracking-widest transition-colors">
                <span className="mr-2">&lt;</span> cd ..
            </Link>
            <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter">GET /pricing</h1>
            <div className="mt-6 p-4 bg-white/5 border border-white/20 overflow-x-auto">
              <pre className="text-sm text-gray-300">
{`{
  "endpoint": "/v1/billing/tiers",
  "status": 200,
  "description": "Select operational parameters to initialize your environment.",
  "currency": "INR"
}`}
              </pre>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
                <div 
                    key={plan.name} 
                    className={`relative flex flex-col h-full p-8 transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] ${
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
                        <p className={`text-sm ${plan.isPopular ? 'text-gray-700' : 'text-gray-400'}`}>{plan.description}</p>
                        
                        <div className="mt-8 flex flex-col">
                            <span className="text-sm uppercase tracking-widest opacity-70 mb-1">Cost / Month</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-bold tracking-tighter">{plan.price}</span>
                                {plan.price.startsWith('₹') && <span className="text-lg">INR</span>}
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
                            className={`w-full py-4 px-6 text-sm font-bold uppercase tracking-widest border-2 transition-colors ${
                                plan.isPopular 
                                ? 'bg-black text-white border-black hover:bg-white hover:text-black' 
                                : 'bg-white text-black border-white hover:bg-black hover:text-white'
                            }`}
                        >
                            &gt;_ {plan.cta}
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
