'use client';

/**
 * SabCRM — Members settings (`/sabcrm/settings/members`), Twenty-style.
 *
 * Read-only roster of the active project's workspace members, each row showing
 * the member's avatar, name + email, workspace role, and derived SabCRM
 * capability chip. Data comes from `listMembersAction`, scoped to the active
 * project via `useProject()`.
 *
 * Role management is intentionally read-only here — changing a member's role is
 * a SabNode workspace operation done in Settings → Team. The action re-runs the
 * full session → project → RBAC → plan gate so the page fails closed.
 *
 * States: skeleton while project resolves / data loads, empty roster, error
 * banner, and a graceful "no project" notice.
 */

import * as React from 'react';
import { Users, ShieldCheck, Shield, Eye, AlertTriangle } from 'lucide-react';

import { TwentyPageHeader, TwentyAvatar } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import type { CrmMember, CrmMemberRole } from '@/lib/sabcrm/members.server';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';

// ---------------------------------------------------------------------------
// Capability descriptors
// ---------------------------------------------------------------------------

interface CapabilityInfo {
  label: string;
  Icon: React.ElementType;
}

const CAPABILITY_INFO: Record<CrmMemberRole, CapabilityInfo> = {
  admin: { label: 'Admin', Icon: ShieldCheck },
  manage: { label: 'Manager', Icon: Shield },
  view: { label: 'Viewer', Icon: Eye },
};

// ---------------------------------------------------------------------------
// Capability chip — TwentyChip only renders an optional color dot, so this
// wraps the base `.st-chip` markup to prepend the capability icon.
// ---------------------------------------------------------------------------

function CapabilityChip({ role }: { role: CrmMemberRole }): React.JSX.Element {
  const cap = CAPABILITY_INFO[role];
  const { Icon } = cap;
  return (
    <span className="st-chip">
      <Icon size={12} aria-hidden="true" />
      <span className="st-chip__label">{cap.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function MembersSkeleton(): React.JSX.Element {
  return (
    <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmMembersSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [members, setMembers] = React.useState<CrmMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await listMembersAction(activeProjectId);
        if (cancelled) return;
        if (res.ok) {
          setMembers(res.data);
        } else {
          setError(res.error);
        }
      } catch {
        if (!cancelled) setError('Members could not be loaded. The service may be unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isLoadingProject]);

  const adminCount = members.filter((m) => m.crmRole === 'admin').length;
  const managerCount = members.filter((m) => m.crmRole === 'manage').length;
  const viewerCount = members.filter((m) => m.crmRole === 'view').length;

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Members" icon={Users} />
        <p className="st-settings__intro">
          Workspace members and their SabCRM access level. Roles are managed
          centrally in the SabNode workspace settings (Settings → Team).
        </p>

        {isLoadingProject || loading ? (
          <MembersSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to view its members.
            </p>
          </div>
        ) : error ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{error}</span>
          </div>
        ) : members.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <Users size={20} />
            </span>
            <h2 className="st-empty__title">No members found</h2>
            <p className="st-empty__desc">
              This workspace has no members, or member data could not be loaded.
            </p>
          </div>
        ) : (
          <>
            <div className="st-table-wrap">
              <table className="st-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Workspace role</th>
                    <th>SabCRM access</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userId} className="st-row">
                      <td>
                        <div className="st-identity">
                          <TwentyAvatar
                            name={member.name.trim() || member.email}
                            src={member.image}
                            size="sm"
                          />
                          <div className="st-identity__text">
                            <span className="st-identity__name">
                              {member.name.trim() || member.email}
                              {member.isOwner ? (
                                <span className="st-owner-tag">(owner)</span>
                              ) : null}
                            </span>
                            <span className="st-identity__sub">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          textTransform: 'capitalize',
                          color: 'var(--st-text-secondary)',
                        }}
                      >
                        {member.projectRole}
                      </td>
                      <td>
                        <CapabilityChip role={member.crmRole} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="st-footnote">
              {members.length} member{members.length !== 1 ? 's' : ''} — {adminCount}{' '}
              admin{adminCount !== 1 ? 's' : ''}, {managerCount} manager
              {managerCount !== 1 ? 's' : ''}, {viewerCount} viewer
              {viewerCount !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
