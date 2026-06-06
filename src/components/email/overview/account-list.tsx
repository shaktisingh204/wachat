'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Plus, CheckCircle2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
import type { WithId, EmailSettings } from '@/lib/definitions';
import { GoogleIcon, OutlookIcon } from '@/components/zoruui-domain/custom-sidebar-components';

interface EmailAccountListProps {
  accounts: WithId<EmailSettings>[];
}

export function EmailAccountList({ accounts }: EmailAccountListProps) {
  const router = useRouter();

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      <PageHeader>
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
        <Button asChild>
          <Link href="/dashboard/email/settings?view=connect">
            <Plus className="h-4 w-4" /> Connect new account
          </Link>
        </Button>
      </PageHeader>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title="No email accounts connected"
          description="Connect a Google, Outlook, or SMTP sender to start using the email suite."
          action={
            <Button asChild>
              <Link href="/dashboard/email/settings?view=connect">
                <Plus className="h-4 w-4" /> Connect your first account
              </Link>
            </Button>
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
              <Card
                key={account._id.toString()}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() =>
                  router.push(`/dashboard/email?accountId=${account._id.toString()}`)
                }
              >
                <ZoruCardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 bg-zoru-surface-raised rounded-lg">
                      <Icon className="h-5 w-5 text-[var(--st-text)]" />
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </Badge>
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
                  <Button
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
                  </Button>
                </ZoruCardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
