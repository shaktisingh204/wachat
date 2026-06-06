/**
 * /portal/support — customer-facing helpdesk landing.
 *
 * Lists the calling user's own tickets (requesterId scope), surfaces the
 * SLA timer + channel as badges per row, and links into the new-request
 * form and the public knowledge base.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { AlertTriangle, BookOpen, MessageSquare, Plus } from 'lucide-react';

import { Badge, Button, Card, CardBody, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { EmptyState } from '@/components/sabcrm/20ui/compat';

import { listSupportTicketsForRequester } from '@/app/actions/helpdesk.actions';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'ghost'> = {
  open: 'info',
  pending: 'warning',
  on_hold: 'warning',
  resolved: 'success',
  closed: 'ghost',
  reopened: 'danger',
};

function slaBadge(dueBy?: string, status?: string): { variant: 'success' | 'warning' | 'danger' | 'ghost'; label: string } {
  if (!dueBy || status === 'closed' || status === 'resolved') return { variant: 'ghost', label: 'No SLA' };
  const diff = new Date(dueBy).getTime() - Date.now();
  if (!Number.isFinite(diff)) return { variant: 'ghost', label: 'No SLA' };
  if (diff <= 0) return { variant: 'danger', label: 'Breached' };
  if (diff < 60 * 60_000) return { variant: 'warning', label: `Due in ${Math.floor(diff / 60_000)}m` };
  if (diff < 24 * 60 * 60_000) return { variant: 'warning', label: `Due in ${Math.floor(diff / 3_600_000)}h` };
  return { variant: 'success', label: `Due in ${Math.floor(diff / 86_400_000)}d` };
}

export default async function SupportPortalLandingPage() {
  const { tickets, error } = await listSupportTicketsForRequester();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="text-[12px] text-[var(--st-text-secondary)]">Open a request</p>
              <p className="mt-1 text-[14px] font-medium text-[var(--st-text)]">Tell us what's wrong</p>
            </div>
            <Button asChild size="sm">
              <Link href="/portal/support/new">
                <Plus className="mr-1 h-3 w-3" /> New
              </Link>
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="text-[12px] text-[var(--st-text-secondary)]">Knowledge base</p>
              <p className="mt-1 text-[14px] font-medium text-[var(--st-text)]">Browse public articles</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/portal/support/kb">
                <BookOpen className="mr-1 h-3 w-3" /> Browse
              </Link>
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="text-[12px] text-[var(--st-text-secondary)]">Your tickets</p>
              <p className="mt-1 text-[14px] font-medium text-[var(--st-text)]">
                {tickets.length} on file
              </p>
            </div>
            <MessageSquare className="h-5 w-5 text-[var(--st-text-secondary)]" />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-0">
          {error ? (
            <div className="p-6 text-[13px] text-[var(--st-danger)]">{error}</div>
          ) : tickets.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No tickets yet"
                description="When you open a request, it will show up here so you can track progress."
                action={
                  <Button asChild>
                    <Link href="/portal/support/new">
                      <Plus className="mr-1 h-3 w-3" /> Open a request
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Subject</Th>
                  <Th>Channel</Th>
                  <Th>Status</Th>
                  <Th>SLA</Th>
                  <Th>Updated</Th>
                </Tr>
              </THead>
              <TBody>
                {tickets.map((t) => {
                  const sla = slaBadge(t.dueBy, t.status);
                  return (
                    <Tr key={t._id}>
                      <Td>
                        <Link
                          href={`/portal/support/${t._id}`}
                          className="font-medium text-[var(--st-text)] hover:underline"
                        >
                          {t.subject}
                        </Link>
                      </Td>
                      <Td>
                        <Badge variant="ghost">{t.channel ?? 'web'}</Badge>
                      </Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[t.status] ?? 'ghost'}>
                          {t.status}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge variant={sla.variant}>
                          {sla.variant === 'danger' ? (
                            <AlertTriangle className="mr-1 h-3 w-3" />
                          ) : null}
                          {sla.label}
                        </Badge>
                      </Td>
                      <Td className="text-[12px] text-[var(--st-text-secondary)]">
                        {t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '—'}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
