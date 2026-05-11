import { Users, Plus } from 'lucide-react';
import { ObjectId } from 'mongodb';
import Link from 'next/link';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ZoruBadge,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { cn } from '@/lib/utils';

type AnyContact = {
  _id?: { toString(): string } | string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  relationship?: string; // decision-maker/influencer/champion/blocker
  stage?: string;
  owner?: string;
  leadScore?: number;
  status?: string;
  createdAt?: string | Date;
};

function relationshipVariant(
  rel?: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
  switch ((rel || '').toLowerCase()) {
    case 'decision-maker':
      return 'success';
    case 'champion':
      return 'warning';
    case 'blocker':
      return 'danger';
    default:
      return 'ghost';
  }
}

function formatRelationship(rel?: string): string {
  if (!rel) return '—';
  return rel
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('-');
}

export default async function CrmContactsPage() {
  const session = await getSession();
  let contacts: AnyContact[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = await db
        .collection('crm_contacts')
        .find({ userId: userObjectId } as any)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      contacts = JSON.parse(JSON.stringify(docs)) as AnyContact[];
    } catch (e) {
      console.error('Failed to load crm_contacts:', e);
      loadError = true;
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Contacts"
        subtitle="People linked to clients — decision-makers, champions and influencers."
        icon={Users}
        actions={
          <Link
            href="/dashboard/crm/sales-crm/contacts/new"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/90',
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New contact
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] text-zoru-ink">All Contacts</h2>
          <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
            Key stakeholders linked to your client accounts.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Email</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Phone</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Company</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Relationship</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Owner</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Could not load contacts. Please try again.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : contacts.length > 0 ? (
                contacts.map((contact, idx) => {
                  const id =
                    typeof contact._id === 'string'
                      ? contact._id
                      : (contact._id as any)?.toString?.() ?? String(idx);
                  const fullName =
                    [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—';
                  return (
                    <ZoruTableRow key={id} className="border-zoru-line">
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        {fullName}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {contact.email || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {contact.phone || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {contact.company || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {contact.title || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {contact.relationship ? (
                          <ZoruBadge variant={relationshipVariant(contact.relationship)}>
                            {formatRelationship(contact.relationship)}
                          </ZoruBadge>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {contact.owner || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {contact.status || '—'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No contacts yet. Add contacts linked to your clients to track key
                    stakeholders.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
