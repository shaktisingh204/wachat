import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
  Inbox,
  Mail,
  Send,
  FileText,
  Settings,
  } from 'lucide-react';

/**
 * CRM → Email module overview.
 *
 * Was a `redirect('/dashboard/email')` shim. Now a proper landing
 * page describing how email integrates with CRM contacts / leads, and
 * deep-linking into the standalone mail module.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
  { href: '/dashboard/email', title: 'Open Mail', description: 'Full SabNode mail client — inbox, sent, drafts.', icon: Inbox },
  { href: '/dashboard/email/compose', title: 'Compose', description: 'Write and send a new email.', icon: Send },
  { href: '/dashboard/crm/settings/email-templates', title: 'Email Templates', description: 'Reusable templates for outbound CRM emails.', icon: FileText },
  { href: '/dashboard/crm/contacts', title: 'Contacts', description: 'CRM contacts you can send email to.', icon: Mail },
  { href: '/dashboard/crm/settings', title: 'Email Settings', description: 'SMTP / IMAP configuration and signatures.', icon: Settings },
];

export default function CrmEmailHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Email</ZoruPageTitle>
          <ZoruPageDescription>
            Send mail from CRM, manage templates, and open the full mail client.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
