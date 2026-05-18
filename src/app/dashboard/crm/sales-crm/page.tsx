import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Building2,
  ClipboardList,
  Contact,
  FileSpreadsheet,
  Filter,
  GitBranch,
  Handshake,
  LayoutList,
  ListChecks,
  ListTree,
  Package,
  PieChart,
  ScrollText,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Tag,
  Target,
  TrendingUp,
  UserCog,
  Users,
  } from 'lucide-react';

/**
 * Sales-CRM module overview — tile grid linking every sub-feature.
 *
 * Was a `redirect('/dashboard/crm/sales-crm/leads')` shim.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
  { href: '/dashboard/crm/sales-crm/all-leads', title: 'All Leads', description: 'Every lead in the system, regardless of stage.', icon: Users },
  { href: '/dashboard/crm/sales-crm/leads-summary', title: 'Leads Summary', description: 'Headline metrics across every active pipeline.', icon: TrendingUp },
  { href: '/dashboard/crm/sales-crm/leads', title: 'Leads', description: 'Working list of leads to act on next.', icon: Filter },
  { href: '/dashboard/crm/sales-crm/clients', title: 'Clients', description: 'Converted lead → client accounts.', icon: Building2 },
  { href: '/dashboard/crm/sales-crm/contacts', title: 'Contacts', description: 'People associated with leads and clients.', icon: Contact },
  { href: '/dashboard/crm/sales-crm/deals', title: 'Deals', description: 'Open opportunities being worked.', icon: Handshake },
  { href: '/dashboard/crm/sales-crm/pipelines', title: 'Pipelines', description: 'Stage-based pipelines and their funnels.', icon: GitBranch },
  { href: '/dashboard/crm/sales-crm/pipeline-stages', title: 'Pipeline Stages', description: 'Configure stages across pipelines.', icon: ListTree },
  { href: '/dashboard/crm/sales-crm/all-pipelines', title: 'All Pipelines', description: 'Flat list of every pipeline.', icon: LayoutList },
  { href: '/dashboard/crm/sales-crm/agents', title: 'Lead Agents', description: 'Employees assigned to specific leads.', icon: UserCog },
  { href: '/dashboard/crm/sales-crm/sources', title: 'Lead Sources', description: 'Where leads are coming from.', icon: Tag },
  { href: '/dashboard/crm/sales-crm/statuses', title: 'Lead Statuses', description: 'Lifecycle statuses applied to leads.', icon: BadgeCheck },
  { href: '/dashboard/crm/sales-crm/categories', title: 'Categories', description: 'Categorisation taxonomy for leads.', icon: ListChecks },
  { href: '/dashboard/crm/sales-crm/tasks', title: 'Tasks', description: 'Follow-ups and call-back tasks per lead.', icon: ClipboardList },
  { href: '/dashboard/crm/sales-crm/notes', title: 'Notes', description: 'Lead notes — calls, meetings, observations.', icon: StickyNote },
  { href: '/dashboard/crm/sales-crm/products', title: 'Lead Products', description: 'Products of interest, line-itemised by lead.', icon: Package },
  { href: '/dashboard/crm/sales-crm/forms', title: 'Forms', description: 'Public lead-capture forms.', icon: ClipboardList },
  { href: '/dashboard/crm/sales-crm/custom-forms', title: 'Custom Fields', description: 'Extra fields you collect on leads.', icon: FileSpreadsheet },
  { href: '/dashboard/crm/sales-crm/automations', title: 'Automations', description: 'Rules that fire on lead lifecycle events.', icon: Bot },
  { href: '/dashboard/crm/sales-crm/conversions', title: 'Conversions', description: 'Lead → client conversion log.', icon: Target },
  { href: '/dashboard/crm/sales-crm/consent', title: 'Consent', description: 'GDPR / marketing consent records.', icon: ShieldCheck },
  { href: '/dashboard/crm/sales-crm/lead-source-report', title: 'Source Report', description: 'Performance by lead source.', icon: PieChart },
  { href: '/dashboard/crm/sales-crm/team-sales-report', title: 'Team Report', description: 'Performance broken down by sales rep.', icon: BarChart3 },
  { href: '/dashboard/crm/sales-crm/client-performance-report', title: 'Client Report', description: 'Revenue and activity per client.', icon: BarChart3 },
  { href: '/dashboard/crm/sales-crm/settings', title: 'Sales-CRM Settings', description: 'Form IDs, share links, and module settings.', icon: Sparkles },
];

export default function CrmSalesCrmHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Sales CRM</ZoruPageTitle>
          <ZoruPageDescription>
            Leads, deals, pipelines, automations, and lead-funnel reporting.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="group">
              <ZoruCard className="h-full p-5 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-zoru-ink">{tile.title}</p>
                  <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                  {tile.description}
                </p>
              </ZoruCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
