import { ZoruCard } from '@/components/zoruui';
import { ArrowUpRight } from 'lucide-react';

import Link from 'next/link';

import { CrmPageHeader } from './crm-page-header';

export interface CrmModuleSection {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

export interface CrmModuleOverviewProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  sections: CrmModuleSection[];
}

/**
 * CrmModuleOverview — Zoru-styled module landing page with a grid of
 * section cards. Used as the entry point for CRM modules (sales,
 * accounting, inventory, banking, purchases, etc.) to give users a
 * visual directory into the module's sub-sections.
 */
export function CrmModuleOverview({
  title,
  subtitle,
  icon,
  sections,
}: CrmModuleOverviewProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader title={title} subtitle={subtitle} icon={icon} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <ZoruCard className="flex h-full flex-col p-6 transition-colors hover:border-zoru-ink-muted">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2">
                  <Icon className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14.5px] text-zoru-ink">{label}</h3>
                    <ArrowUpRight
                      className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink"
                      strokeWidth={1.75}
                    />
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-zoru-ink-muted">
                    {description}
                  </p>
                </div>
              </div>
            </ZoruCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
