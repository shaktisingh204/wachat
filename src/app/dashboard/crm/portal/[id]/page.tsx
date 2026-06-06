import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';

/**
 * Portal user detail — `/dashboard/crm/portal/[id]`.
 *
 * Per §1D.2: 7 actions, body cards (Overview · Capabilities · Login
 * history · Linked entity · Notes), right rail w/ last-login, linked
 * entity, status, active sessions.
 */

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { getPortalUserById } from '@/app/actions/crm-portal.actions';

import React from 'react';
import { PortalDetailActions } from '../_components/portal-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

type PortalUserDoc = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  portalType?: string;
  capabilities?: string[];
  status?: string;
  notes?: string;
  linkedEntityId?: string;
  linkedEntityKind?: string;
  loginHistory?: Array<{
    _id?: string;
    at?: string;
    ip?: string;
    userAgent?: string;
  }>;
  activeSessions?: number;
  lastLoginAt?: string;
  lastMagicLinkAt?: string;
  suspendedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

function statusTone(status?: string): EntityStatusTone {
  switch (status) {
    case 'active':
      return 'green';
    case 'pending':
      return 'amber';
    case 'suspended':
      return 'red';
    default:
      return 'neutral';
  }
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{value ?? '—'}</div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = (await getPortalUserById(id)) as PortalUserDoc | null;
  if (!user) notFound();

  const status = user.status ?? 'pending';
  const capabilities = Array.isArray(user.capabilities) ? user.capabilities : [];
  const loginHistory = Array.isArray(user.loginHistory)
    ? user.loginHistory
    : [];

  return (
    <EntityDetailShell
      title={user.name || user.email || 'Portal user'}
      eyebrow={`PORTAL · ${(user.portalType || 'customer').toUpperCase()}`}
      status={{ label: status, tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/portal', label: 'All portal users' }}
      actions={<PortalDetailActions portalUserId={id} status={status} />}
      audit={
        <React.Suspense fallback={<div className="h-64 w-full animate-pulse bg-[var(--st-bg-muted)] rounded-md" />}>
          <EntityAuditTimeline entityKind="portal_user" entityId={id} />
        </React.Suspense>
      }
      rightRail={
        <>
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Status</span>
                  <Badge variant="outline">{status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-secondary)]">Last login</span>
                  <span className="font-mono tabular-nums text-[12px]">
                    {fmtDateTime(user.lastLoginAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-2">
                  <span className="text-[var(--st-text-secondary)]">Active sessions</span>
                  <span>{user.activeSessions ?? 0}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked entity</CardTitle>
            </CardHeader>
            <CardBody>
              {user.linkedEntityId ? (
                <Link
                  href={
                    user.linkedEntityKind === 'vendor'
                      ? `/dashboard/crm/vendors/${user.linkedEntityId}`
                      : `/dashboard/crm/accounts/${user.linkedEntityId}`
                  }
                  className="text-[12.5px] text-[var(--st-text)] hover:underline"
                >
                  Open {user.linkedEntityKind || 'account'} →
                </Link>
              ) : (
                <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                  Not linked
                </span>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Last invite</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="text-[12.5px] text-[var(--st-text)]">
                {fmtDateTime(user.lastMagicLinkAt)}
              </div>
            </CardBody>
          </Card>
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" value={user.name || '—'} />
            <Field label="Email" value={user.email || '—'} />
            <Field label="Phone" value={user.phone || '—'} />
            <Field label="Portal type" value={user.portalType || '—'} />
            <Field
              label="Status"
              value={<Badge variant="outline">{status}</Badge>}
            />
            <Field
              label="Suspended at"
              value={fmtDateTime(user.suspendedAt)}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
        </CardHeader>
        <CardBody>
          {capabilities.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              No capabilities granted.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {capabilities.map((c) => (
                <Badge key={c} variant="outline">
                  {c.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login history</CardTitle>
        </CardHeader>
        <CardBody>
          {loginHistory.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              {/* TODO 1D.2: portal login-history collection not yet wired */}
              No login activity yet.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--st-border)]/60 text-left text-[11px] uppercase text-[var(--st-text-secondary)]">
                  <th className="py-2">When</th>
                  <th className="py-2">IP</th>
                  <th className="py-2">User agent</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.slice(0, 50).map((row, idx) => (
                  <tr
                    key={row._id ?? `${row.at}-${idx}`}
                    className="border-b border-[var(--st-border)]/40 last:border-0"
                  >
                    <td className="py-2">{fmtDateTime(row.at)}</td>
                    <td className="py-2 text-[var(--st-text-secondary)]">
                      {row.ip || '—'}
                    </td>
                    <td className="py-2 text-[var(--st-text-secondary)] text-[12px]">
                      {row.userAgent || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked entity</CardTitle>
        </CardHeader>
        <CardBody>
          {user.linkedEntityId ? (
            <Link
              href={
                user.linkedEntityKind === 'vendor'
                  ? `/dashboard/crm/vendors/${user.linkedEntityId}`
                  : `/dashboard/crm/accounts/${user.linkedEntityId}`
              }
              className="text-[13px] text-[var(--st-text)] hover:underline"
            >
              Open {user.linkedEntityKind || 'account'} →
            </Link>
          ) : (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              No entity linked yet. Edit the portal user to attach an account
              or vendor.
            </p>
          )}
        </CardBody>
      </Card>

      {user.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {user.notes}
            </p>
          </CardBody>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
