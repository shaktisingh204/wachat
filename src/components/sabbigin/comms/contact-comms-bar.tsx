'use client';

/**
 * Communication bar for a contact — Email (SabMail), WhatsApp (WaChat) and
 * File Cabinet (SabFiles), each reusing the existing module rather than
 * rebuilding. Rendered on the contact detail page.
 */

import { Card } from '@/components/sabcrm/20ui';

import { EmailComposeButton } from './email-compose-button';
import { WhatsAppButton } from './whatsapp-button';
import { FileCabinetButton } from './file-cabinet-button';

export function ContactCommsBar({
  contactId,
  email,
  phone,
}: {
  contactId: string;
  email?: string;
  phone?: string;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className="mr-1 text-xs font-medium text-[var(--st-text-secondary)]">
        Reach out
      </span>
      <EmailComposeButton contactId={contactId} defaultTo={email} />
      {phone ? <WhatsAppButton contactId={contactId} /> : null}
      <FileCabinetButton contactId={contactId} />
    </Card>
  );
}
