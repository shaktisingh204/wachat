'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Plus, CheckCircle2 } from 'lucide-react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruEmptyState,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import type { WithId, EmailSettings } from '@/lib/definitions';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';

interface EmailAccountListProps {
  accounts: WithId<EmailSettings>[];
}

export function EmailAccountList({ accounts }: EmailAccountListProps) {
  const router = useRouter();

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Mail className="h-7 w-7" /> Email Suite
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Pick an account to manage, or connect a new sender.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruButton asChild>
          <Link href="/dashboard/email/settings?view=connect">
            <Plus className="h-4 w-4" /> Connect new account
          </Link>
        </ZoruButton>
      </ZoruPageHeader>

      {accounts.length === 0 ? (
        <ZoruEmptyState
          icon={<Mail />}
          title="No email accounts connected"
          description="Connect a Google, Outlook, or SMTP sender to start using the email suite."
          action={
            <ZoruButton asChild>
              <Link href="/dashboard/email/settings?view=connect">
                <Plus className="h-4 w-4" /> Connect your first account
              </Link>
            </ZoruButton>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const Icon =
              account.provider === 'google'
                ? GoogleIcon
                : account.provider === 'outlook'
                  ? OutlookIcon
                  : Mail;
            return (
              <ZoruCard
                key={account._id.toString()}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() =>
                  router.push(`/dashboard/email?accountId=${account._id.toString()}`)
                }
              >
                <ZoruCardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 bg-zoru-surface-raised rounded-lg">
                      <Icon className="h-5 w-5 text-zoru-ink" />
                    </div>
                    <ZoruBadge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </ZoruBadge>
                  </div>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <ZoruCardTitle className="truncate">
                    {account.fromName || 'Unnamed sender'}
                  </ZoruCardTitle>
                  <ZoruCardDescription className="truncate">
                    {account.fromEmail || account.provider}
                  </ZoruCardDescription>
                </ZoruCardContent>
                <ZoruCardFooter>
                  <ZoruButton
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link
                      href={`/dashboard/email?accountId=${account._id.toString()}`}
                    >
                      Open
                    </Link>
                  </ZoruButton>
                </ZoruCardFooter>
              </ZoruCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
