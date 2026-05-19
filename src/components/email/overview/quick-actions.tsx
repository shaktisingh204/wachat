'use client';

import Link from 'next/link';
import { PlusCircle, Users, Mail, Workflow, ShieldCheck } from 'lucide-react';
import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';

interface EmailQuickActionsProps {
  accountId?: string;
}

export function EmailQuickActions({ accountId }: EmailQuickActionsProps) {
  const qs = accountId ? `?accountId=${accountId}` : '';
  const actions = [
    { href: `/dashboard/email/campaigns${qs}`,  label: 'New campaign',     icon: PlusCircle },
    { href: `/dashboard/email/audience${qs}`,   label: 'Import contacts',  icon: Users },
    { href: `/dashboard/email/journeys${qs}`,   label: 'Create journey',   icon: Workflow },
    { href: `/dashboard/email/inbox${qs}`,      label: 'Open inbox',       icon: Mail },
    { href: `/dashboard/email/deliverability${qs}`, label: 'Check deliverability', icon: ShieldCheck },
  ];

  return (
    <ZoruCard className="p-0">
      <ZoruCardHeader>
        <ZoruCardTitle>Quick actions</ZoruCardTitle>
        <ZoruCardDescription>Jump straight to what you want to do.</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="grid gap-2">
        {actions.map((a) => (
          <ZoruButton
            key={a.href}
            asChild
            variant="outline"
            className="w-full justify-start gap-2"
          >
            <Link href={a.href}>
              <a.icon className="h-4 w-4" />
              {a.label}
            </Link>
          </ZoruButton>
        ))}
      </ZoruCardContent>
    </ZoruCard>
  );
}
