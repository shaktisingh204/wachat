'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  LoaderCircle,
  Factory,
  ShoppingCart,
  Briefcase,
  Building,
  Boxes,
  HeartPulse,
  BookOpen,
  Truck,
  Landmark,
  UtensilsCrossed,
  FlaskConical,
  Handshake,
  PenTool,
  BedDouble,
  Wrench,
} from 'lucide-react';

import { saveCrmIndustry } from '@/app/actions/crm.actions';
import { useToast } from '@/hooks/use-toast';
import { ClayCard, ClayButton } from '@/components/clay';
import { cn } from '@/lib/utils';

const industries = [
  { name: 'Manufacturing', description: 'For businesses that produce goods.', icon: Factory },
  { name: 'Retail & eCommerce', description: 'For online stores and physical shops.', icon: ShoppingCart },
  { name: 'Services (IT, Consulting, Agencies)', description: 'For service-based businesses.', icon: Briefcase },
  { name: 'Construction & Real Estate', description: 'For builders and real estate agents.', icon: Building },
  { name: 'Wholesale & Distribution', description: 'For businesses that sell in bulk.', icon: Boxes },
  { name: 'Healthcare', description: 'For clinics, hospitals, and practitioners.', icon: HeartPulse },
  { name: 'Education', description: 'For schools, colleges, and online courses.', icon: BookOpen },
  { name: 'Logistics & Transport', description: 'For companies managing supply chains.', icon: Truck },
  { name: 'Accounting & Finance', description: 'For financial services firms.', icon: Landmark },
  { name: 'Food & Beverage', description: 'For restaurants, cafes, and food producers.', icon: UtensilsCrossed },
  { name: 'Pharma & Life Sciences', description: 'For pharmaceutical companies.', icon: FlaskConical },
  { name: 'Nonprofits & NGOs', description: 'For non-profit organizations.', icon: Handshake },
  { name: 'Media & Creative Agencies', description: 'For marketing and creative firms.', icon: PenTool },
  { name: 'Hospitality (Hotels, Resorts)', description: 'For the travel and lodging industry.', icon: BedDouble },
];

export default function CrmSetupPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSelect = async () => {
    if (!selectedIndustry) {
      toast({ title: 'Please select an industry', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await saveCrmIndustry(selectedIndustry);
      if (result.success) {
        toast({
          title: 'CRM Setup Complete!',
          description: 'Your CRM has been customized for your industry.',
        });
        router.push('/dashboard/crm');
        router.refresh();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-clay-lg bg-clay-rose-soft">
          <Wrench className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-clay-ink">
            Welcome to the CRM Suite
          </h1>
          <p className="mt-2 max-w-2xl text-[13.5px] text-clay-ink-muted">
            To get started, select the industry that best describes your business. We'll tailor
            the CRM — stages, templates, and reports — to match.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {industries.map((industry) => {
          const Icon = industry.icon;
          const selected = selectedIndustry === industry.name;
          return (
            <button
              key={industry.name}
              type="button"
              onClick={() => setSelectedIndustry(industry.name)}
              className={cn(
                'group text-left transition-all',
                'rounded-clay-lg border bg-clay-surface p-5 shadow-clay-card',
                selected
                  ? 'border-clay-rose ring-2 ring-clay-rose/30'
                  : 'border-clay-border hover:border-clay-border-strong',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-clay-md',
                    selected ? 'bg-clay-rose text-white' : 'bg-clay-surface-2 text-clay-ink-muted',
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                {selected ? (
                  <Check className="h-5 w-5 text-clay-rose" strokeWidth={2} />
                ) : null}
              </div>
              <h3 className="mt-4 text-[14px] font-semibold leading-tight text-clay-ink">
                {industry.name}
              </h3>
              <p className="mt-1 text-[12px] leading-snug text-clay-ink-muted">
                {industry.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <ClayButton
          variant="obsidian"
          size="lg"
          onClick={handleSelect}
          disabled={!selectedIndustry || isPending}
          leading={
            isPending ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null
          }
        >
          Continue
        </ClayButton>
      </div>
    </div>
  );
}
