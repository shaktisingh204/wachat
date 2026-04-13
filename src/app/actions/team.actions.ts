

'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Invitation, User, Project } from '@/lib/definitions';
import { ObjectId, type WithId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { logActivity } from '@/app/actions/activity.actions';

import crypto from 'crypto';
import { getTransporter } from '@/lib/email-service';
import { PENDING_INVITE_COOKIE } from '@/lib/team-invites';
import { requirePermission } from '@/lib/rbac-server';

async function findUserByEmail(email: string) {
    const { db } = await connectToDatabase();
    return await db.collection('users').findOne({ email: email.toLowerCase() });
}

/**
 * Ensure the invitations collection has the indexes we rely on for
 * fast token lookups and duplicate-invite detection. Idempotent.
 */
async function ensureInvitationIndexes() {
    try {
        const { db } = await connectToDatabase();
        await Promise.all([
            db.collection('invitations').createIndex({ token: 1 }, { unique: true }),
            db.collection('invitations').createIndex({ inviteeEmail: 1, projectId: 1, status: 1 }),
            db.collection('invitations').createIndex({ expiresAt: 1 }),
        ]);
    } catch (err) {
        // createIndex is idempotent but may throw on conflicting existing indexes;
        // we swallow because the app still works without them (slower only).
        console.warn('[team.actions] ensureInvitationIndexes failed:', getErrorMessage(err));
    }
}

function buildInviteEmailHtml(opts: {
    inviteLink: string;
    inviterName: string;
    projectName: string;
    roleLabel: string;
    inviteeEmail: string;
    expiresAt: Date;
}) {
    const { inviteLink, inviterName, projectName, roleLabel, inviteeEmail, expiresAt } = opts;
    const expiresLabel = expiresAt.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You're invited to ${projectName}</title></head>
<body style="margin:0;padding:0;background:#F4F2EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EE;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E7E3DC;border-radius:18px;box-shadow:0 6px 24px rgba(28,25,23,0.06);">
        <tr><td style="padding:40px 40px 24px 40px;">
          <div style="display:inline-block;background:#F5E6E3;color:#6F2A28;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;padding:6px 12px;border-radius:999px;">Team invitation</div>
          <h1 style="margin:20px 0 8px 0;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:#1C1917;">You're invited to ${projectName}</h1>
          <p style="margin:0;font-size:14px;color:#57534E;line-height:1.55;">
            <strong>${inviterName}</strong> invited <strong>${inviteeEmail}</strong> to join the
            <strong>${projectName}</strong> team on SabNode as a <strong>${roleLabel}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:8px 40px 24px 40px;">
          <a href="${inviteLink}" style="display:inline-block;background:#1F1C1A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:12px 22px;border-radius:999px;">Review invitation</a>
        </td></tr>
        <tr><td style="padding:0 40px 8px 40px;">
          <p style="margin:0;font-size:12px;color:#78716C;line-height:1.6;">
            If the button doesn't work, paste this link into your browser:
          </p>
          <p style="margin:6px 0 0 0;font-size:12px;color:#B07B7B;word-break:break-all;">${inviteLink}</p>
        </td></tr>
        <tr><td style="padding:24px 40px 40px 40px;border-top:1px solid #F1EDE6;margin-top:8px;">
          <p style="margin:16px 0 0 0;font-size:11px;color:#A8A29E;">
            This invitation expires on <strong>${expiresLabel}</strong>. If you weren't expecting it, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:11px;color:#A8A29E;">SabNode · Teams</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function roleLabel(role: string): string {
    if (role === 'admin') return 'Admin';
    if (role === 'agent') return 'Agent';
    if (role === 'owner') return 'Owner';
    if (role === 'member') return 'Member';
    return role.charAt(0).toUpperCase() + role.slice(1);
}

export async function getInvitedUsers(): Promise<WithId<User & { roles: Record<string, string> }>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();

        const userProjects = await db.collection('projects').find({ userId: new ObjectId(session.user._id) }).toArray();

        let agentUserIds: ObjectId[] = [];
        userProjects.forEach(project => {
            if (project.agents) {
                project.agents.forEach((agent: any) => {
                    if (agent.userId && !agentUserIds.some(id => id.equals(agent.userId))) {
                        agentUserIds.push(agent.userId);
                    }
                });
            }
        });

        if (agentUserIds.length === 0) return [];

        const users = await db.collection<User>('users').find({ _id: { $in: agentUserIds } }).project({ password: 0 }).toArray();

        const usersWithRoles = users.map(user => {
            const roles: Record<string, string> = {};
            userProjects.forEach(project => {
                const agentInfo = project.agents?.find((a: any) => a.userId.equals(user._id));
                if (agentInfo) {
                    roles[project.name] = agentInfo.role;
                }
            });
            return { ...user, roles };
        });

        return JSON.parse(JSON.stringify(usersWithRoles));
    } catch (e: any) {
        console.error("Error fetching invited users:", e);
        return [];
    }
}

export async function handleInviteAgent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    const projectId = formData.get('projectId') as string; // This can be null for global invites

    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!email || !role) return { error: 'Missing required fields.' };

    const guard = await requirePermission('team_users', 'create', projectId || null);
    if (!guard.ok) return { error: guard.error };

    const invitee = await findUserByEmail(email);

    // Logic for non-registered users (Invitation Flow)
    if (!invitee) {
        try {
            await ensureInvitationIndexes();
            const { db } = await connectToDatabase();

            // Check for existing pending invitation scoped to the same project
            const existingInvite = await db.collection<Invitation>('invitations').findOne({
                inviteeEmail: email.toLowerCase(),
                projectId: projectId && ObjectId.isValid(projectId) ? new ObjectId(projectId) : { $exists: false } as any,
                status: 'pending',
            } as any);
            if (existingInvite) {
                return { error: `An invitation is already pending for ${email}.` };
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            const invitation: any = {
                inviterId: new ObjectId(session.user._id),
                inviterName: session.user.name,
                inviteeEmail: email.toLowerCase(),
                role: role,
                token: token,
                status: 'pending',
                expiresAt: expiresAt,
                createdAt: new Date(),
            };

            let projectName = 'SabNode Team';

            if (projectId && ObjectId.isValid(projectId)) {
                const project = await db.collection<WithId<Project>>('projects').findOne({ _id: new ObjectId(projectId) });
                if (!project) return { error: "Project not found." };
                if (project.userId.toString() !== session.user._id.toString()) return { error: "You do not own this project." };
                invitation.projectId = new ObjectId(projectId);
                invitation.projectName = project.name;
                projectName = project.name;
            }

            await db.collection('invitations').insertOne(invitation);

            // Send Email
            try {
                const transporter = await getTransporter(session.user._id);
                const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/invite/${token}`;
                const emailHtml = buildInviteEmailHtml({
                    inviteLink,
                    inviterName: session.user.name,
                    projectName,
                    roleLabel: roleLabel(role),
                    inviteeEmail: email,
                    expiresAt,
                });

                await transporter.sendMail({
                    from: `"SabNode Team" <${process.env.EMAIL_FROM || 'noreply@sabnode.com'}>`,
                    to: email,
                    subject: `${session.user.name} invited you to ${projectName} on SabNode`,
                    html: emailHtml,
                });

                await logActivity('MEMBER_INVITED', { email, role, type: 'Email Invite', project: projectName }, projectId || undefined);
                revalidatePath('/dashboard/team/manage-users');
                return { message: `Invitation sent to ${email}.` };
            } catch (emailError: any) {
                console.error("Email sending failed", emailError);
                revalidatePath('/dashboard/team/manage-users');
                return { error: `Invitation created, but email failed: ${emailError.message || 'Check Email Settings'}` };
            }
        } catch (e: any) {
            console.error("Invitation error:", e);
            return { error: "Failed to create invitation." };
        }
    }
    if (invitee._id.toString() === session.user._id.toString()) {
        return { error: "You cannot invite yourself." };
    }

    try {
        const { db } = await connectToDatabase();

        // If a specific project ID is provided, invite to that project only.
        if (projectId && ObjectId.isValid(projectId)) {
            const project = await db.collection<WithId<Project>>('projects').findOne({ _id: new ObjectId(projectId) });

            if (!project || project.userId.toString() !== session.user._id.toString()) {
                return { error: "Project not found or you are not the owner." };
            }

            if (project.agents?.some((agent: any) => agent.userId.equals(invitee._id))) {
                return { error: "This user is already an agent on this project." };
            }

            await db.collection('projects').updateOne(
                { _id: project._id },
                { $addToSet: { agents: { userId: invitee._id, email: invitee.email, name: invitee.name, role: role } } }
            );

            revalidatePath('/dashboard/settings');
            revalidatePath('/dashboard/team/manage-users');
            await logActivity('MEMBER_INVITED', { email, role, project: project.name }, project._id);
            return { message: `Invitation sent to ${email} for project ${project.name}.` };
        } else {
            // If no project ID, invite to all projects owned by the user.
            const userProjects = await db.collection<WithId<Project>>('projects').find({ userId: new ObjectId(session.user._id) }).toArray();

            if (userProjects.length === 0) {
                return { error: "You do not own any projects to invite a team member to." };
            }

            let updatedCount = 0;
            for (const project of userProjects) {
                if (project.agents?.some((agent: any) => agent.userId.equals(invitee._id))) {
                    console.log(`User ${email} is already an agent on project ${project.name}.Skipping.`);
                    continue;
                }

                await db.collection('projects').updateOne(
                    { _id: project._id },
                    { $addToSet: { agents: { userId: invitee._id, email: invitee.email, name: invitee.name, role: role } } }
                );
                updatedCount++;
            }

            if (updatedCount === 0) {
                return { message: `User ${email} is already a member of all your projects.` };
            }

            revalidatePath('/dashboard/settings');
            revalidatePath('/dashboard/team/manage-users');
            await logActivity('MEMBER_INVITED', { email, role, count: updatedCount, type: 'Global Invite' });
            return { message: `Invitation sent to ${email}. They have been added to ${updatedCount} project(s).` };
        }
    } catch (e: any) {
        console.error("Agent invitation failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
}

export async function handleRemoveAgent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const agentUserId = formData.get('agentUserId') as string;
    const projectId = formData.get('projectId') as string | null;
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!agentUserId || !ObjectId.isValid(agentUserId)) {
        return { error: 'Invalid Agent ID.' };
    }

    const removeGuard = await requirePermission('team_users', 'delete', projectId || null);
    if (!removeGuard.ok) return { error: removeGuard.error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const agentObjectId = new ObjectId(agentUserId);

        if (projectId && ObjectId.isValid(projectId)) {
            // Case 1: Remove from a specific project
            await db.collection('projects').updateOne(
                { _id: new ObjectId(projectId), userId: userObjectId },
                { $pull: { agents: { userId: agentObjectId } } } as any
            );
        } else {
            // Case 2: Remove from all projects owned by the user
            await db.collection('projects').updateMany(
                { userId: userObjectId },
                { $pull: { agents: { userId: agentObjectId } } } as any
            );
        }

        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard/team/manage-users');
        await logActivity('MEMBER_REMOVED', { agentId: agentUserId, scope: projectId ? 'Single Project' : 'All Projects' }, projectId || undefined);
        return { message: 'Agent removed successfully.' };
    } catch (e: any) {
        console.error("Agent removal failed:", e);
        return { error: 'An unexpected error occurred.' };
    }
}


/* ──────────────────────────────────────────────────────────────────────── */
/*  INVITATION LIFECYCLE — view / accept / decline / resend / revoke        */
/* ──────────────────────────────────────────────────────────────────────── */

export type InvitationView = {
    _id: string;
    token: string;
    inviteeEmail: string;
    role: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    inviterId: string;
    inviterName?: string;
    inviterEmail?: string;
    projectId?: string;
    projectName?: string;
    expiresAt: string;
    createdAt: string;
    isExpired: boolean;
};

function toInvitationView(
    invite: WithId<Invitation & { inviterEmail?: string; status: InvitationView['status'] }>,
): InvitationView {
    const expired = invite.status === 'pending' && invite.expiresAt.getTime() < Date.now();
    return {
        _id: invite._id.toString(),
        token: invite.token,
        inviteeEmail: invite.inviteeEmail,
        role: invite.role,
        status: expired ? 'expired' : invite.status,
        inviterId: invite.inviterId.toString(),
        inviterName: invite.inviterName,
        inviterEmail: invite.inviterEmail,
        projectId: invite.projectId?.toString(),
        projectName: invite.projectName,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        isExpired: expired,
    };
}

/**
 * Public lookup by token for the /invite/[token] landing page.
 * Hydrates inviter email from the users collection so the page can render a rich card.
 */
export async function getInvitationByToken(token: string): Promise<InvitationView | null> {
    if (!token || typeof token !== 'string') return null;
    try {
        const { db } = await connectToDatabase();
        const invite = await db.collection<Invitation>('invitations').findOne({ token });
        if (!invite) return null;

        let inviterEmail: string | undefined;
        try {
            const inviter = await db.collection('users').findOne(
                { _id: invite.inviterId },
                { projection: { email: 1 } },
            );
            inviterEmail = inviter?.email;
        } catch {
            /* swallow — inviterEmail is optional */
        }

        return toInvitationView({ ...invite, inviterEmail } as any);
    } catch (e) {
        console.error('[getInvitationByToken] failed:', getErrorMessage(e));
        return null;
    }
}

/**
 * Accept an invitation as the currently logged-in user.
 * Requires the session email to match the invitee email (case-insensitive).
 */
export async function acceptInvitation(
    token: string,
): Promise<{ success: boolean; error?: string; projectId?: string; projectName?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'You must be signed in to accept an invitation.' };

    if (!token || typeof token !== 'string') {
        return { success: false, error: 'Missing invitation token.' };
    }

    try {
        const { db } = await connectToDatabase();
        const invite = await db.collection<Invitation>('invitations').findOne({ token });
        if (!invite) return { success: false, error: 'Invitation not found.' };

        if (invite.status !== 'pending') {
            return { success: false, error: `This invitation is ${invite.status}.` };
        }
        if (invite.expiresAt.getTime() < Date.now()) {
            await db.collection('invitations').updateOne({ _id: invite._id }, { $set: { status: 'expired' } });
            return { success: false, error: 'This invitation has expired. Ask the sender to resend it.' };
        }
        if (invite.inviteeEmail.toLowerCase() !== session.user.email.toLowerCase()) {
            return {
                success: false,
                error: `This invitation was sent to ${invite.inviteeEmail}. You are signed in as ${session.user.email}.`,
            };
        }

        const sessionUserId = new ObjectId(session.user._id);
        const agentEntry = {
            userId: sessionUserId,
            email: session.user.email,
            name: session.user.name || session.user.email,
            role: invite.role,
        };

        let attachedProjectId: ObjectId | undefined;
        let attachedProjectName: string | undefined;

        if (invite.projectId) {
            const project = await db
                .collection<WithId<Project>>('projects')
                .findOne({ _id: invite.projectId });
            if (!project) return { success: false, error: 'The project for this invitation no longer exists.' };
            if (project.userId.equals(sessionUserId)) {
                return { success: false, error: 'You already own this project.' };
            }
            const alreadyAgent = project.agents?.some((a: any) => a.userId?.equals?.(sessionUserId));
            if (!alreadyAgent) {
                await db.collection('projects').updateOne(
                    { _id: project._id },
                    { $addToSet: { agents: agentEntry } },
                );
            }
            attachedProjectId = project._id;
            attachedProjectName = project.name;
        } else {
            // Global invite — attach to all of inviter's projects we're not already on.
            const inviterProjects = await db
                .collection<WithId<Project>>('projects')
                .find({ userId: invite.inviterId })
                .toArray();
            for (const project of inviterProjects) {
                if (project.userId.equals(sessionUserId)) continue;
                const alreadyAgent = project.agents?.some((a: any) => a.userId?.equals?.(sessionUserId));
                if (alreadyAgent) continue;
                await db.collection('projects').updateOne(
                    { _id: project._id },
                    { $addToSet: { agents: agentEntry } },
                );
                if (!attachedProjectId) {
                    attachedProjectId = project._id;
                    attachedProjectName = project.name;
                }
            }
        }

        await db.collection('invitations').updateOne(
            { _id: invite._id },
            { $set: { status: 'accepted', acceptedAt: new Date(), acceptedByUserId: sessionUserId } as any },
        );

        // Set the accepted project as the new user's active project for a smooth first-run.
        if (attachedProjectId) {
            await db.collection('users').updateOne(
                { _id: sessionUserId },
                { $set: { activeProjectId: attachedProjectId } },
            );
        }

        // Clear any pending cookie now that we've consumed the invitation.
        try {
            const store = await cookies();
            store.delete(PENDING_INVITE_COOKIE);
        } catch {
            /* no-op outside a request context */
        }

        await logActivity(
            'MEMBER_JOINED',
            { email: session.user.email, role: invite.role, via: 'invitation' },
            attachedProjectId?.toString() || invite.projectId?.toString(),
        );

        revalidatePath('/dashboard/team/manage-users');
        revalidatePath('/dashboard');

        return {
            success: true,
            projectId: attachedProjectId?.toString(),
            projectName: attachedProjectName,
        };
    } catch (e) {
        console.error('[acceptInvitation] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function declineInvitation(token: string): Promise<{ success: boolean; error?: string }> {
    if (!token) return { success: false, error: 'Missing token.' };
    try {
        const { db } = await connectToDatabase();
        const invite = await db.collection<Invitation>('invitations').findOne({ token });
        if (!invite) return { success: false, error: 'Invitation not found.' };
        if (invite.status !== 'pending') {
            return { success: false, error: `This invitation is ${invite.status}.` };
        }
        await db.collection('invitations').updateOne(
            { _id: invite._id },
            { $set: { status: 'revoked', declinedAt: new Date() } as any },
        );
        try {
            const store = await cookies();
            store.delete(PENDING_INVITE_COOKIE);
        } catch {
            /* no-op */
        }
        await logActivity(
            'MEMBER_INVITE_DECLINED',
            { email: invite.inviteeEmail },
            invite.projectId?.toString(),
        );
        revalidatePath('/dashboard/team/manage-users');
        return { success: true };
    } catch (e) {
        console.error('[declineInvitation] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Inviter can resend the email for an existing pending invitation.
 * If the invitation has expired we also extend the expiry by another 7 days.
 */
export async function resendInvitation(
    invitationId: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    if (!invitationId || !ObjectId.isValid(invitationId)) return { success: false, error: 'Invalid invitation id.' };

    try {
        const { db } = await connectToDatabase();
        const invite = await db
            .collection<Invitation>('invitations')
            .findOne({ _id: new ObjectId(invitationId) });
        if (!invite) return { success: false, error: 'Invitation not found.' };
        if (invite.inviterId.toString() !== session.user._id.toString()) {
            return { success: false, error: 'Only the original inviter can resend this.' };
        }
        if (invite.status === 'accepted') return { success: false, error: 'Already accepted.' };

        const guard = await requirePermission('team_users', 'edit', invite.projectId?.toString() || null);
        if (!guard.ok) return { success: false, error: guard.error };

        const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.collection('invitations').updateOne(
            { _id: invite._id },
            { $set: { status: 'pending', expiresAt: newExpires, resentAt: new Date() } as any },
        );

        const transporter = await getTransporter(session.user._id);
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/invite/${invite.token}`;
        const emailHtml = buildInviteEmailHtml({
            inviteLink,
            inviterName: invite.inviterName || session.user.name,
            projectName: invite.projectName || 'SabNode Team',
            roleLabel: roleLabel(invite.role),
            inviteeEmail: invite.inviteeEmail,
            expiresAt: newExpires,
        });
        await transporter.sendMail({
            from: `"SabNode Team" <${process.env.EMAIL_FROM || 'noreply@sabnode.com'}>`,
            to: invite.inviteeEmail,
            subject: `Reminder: You're invited to ${invite.projectName || 'SabNode'}`,
            html: emailHtml,
        });

        revalidatePath('/dashboard/team/manage-users');
        return { success: true, message: `Invitation resent to ${invite.inviteeEmail}.` };
    } catch (e) {
        console.error('[resendInvitation] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function revokeInvitation(
    invitationId: string,
): Promise<{ success: boolean; error?: string; message?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    if (!invitationId || !ObjectId.isValid(invitationId)) return { success: false, error: 'Invalid invitation id.' };

    try {
        const { db } = await connectToDatabase();
        const invite = await db
            .collection<Invitation>('invitations')
            .findOne({ _id: new ObjectId(invitationId) });
        if (!invite) return { success: false, error: 'Invitation not found.' };
        if (invite.inviterId.toString() !== session.user._id.toString()) {
            return { success: false, error: 'Only the original inviter can revoke this.' };
        }
        const guard = await requirePermission('team_users', 'delete', invite.projectId?.toString() || null);
        if (!guard.ok) return { success: false, error: guard.error };
        await db.collection('invitations').updateOne(
            { _id: invite._id },
            { $set: { status: 'revoked', revokedAt: new Date() } as any },
        );
        await logActivity('MEMBER_INVITE_REVOKED', { email: invite.inviteeEmail }, invite.projectId?.toString());
        revalidatePath('/dashboard/team/manage-users');
        return { success: true, message: `Invitation to ${invite.inviteeEmail} revoked.` };
    } catch (e) {
        console.error('[revokeInvitation] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Pending invitations for the inviter's Manage Users page (plus invitations
 * to projects the current user owns, so admins see everything).
 */
export async function listPendingInvitations(): Promise<InvitationView[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const ownedProjects = await db
            .collection('projects')
            .find({ userId: userObjectId }, { projection: { _id: 1 } })
            .toArray();
        const ownedProjectIds = ownedProjects.map((p) => p._id);

        const invitations = await db
            .collection<Invitation>('invitations')
            .find({
                $or: [
                    { inviterId: userObjectId },
                    ...(ownedProjectIds.length ? [{ projectId: { $in: ownedProjectIds } }] : []),
                ],
                status: { $in: ['pending', 'expired'] },
            })
            .sort({ createdAt: -1 })
            .toArray();

        return invitations.map((inv) => toInvitationView(inv as any));
    } catch (e) {
        console.error('[listPendingInvitations] failed:', e);
        return [];
    }
}

/**
 * Store an invite token in an httpOnly cookie so that the signup/login
 * flow can auto-consume it when the user finishes authenticating.
 */
export async function rememberPendingInviteToken(token: string): Promise<void> {
    if (!token || typeof token !== 'string') return;
    const store = await cookies();
    store.set(PENDING_INVITE_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });
}

export async function forgetPendingInviteToken(): Promise<void> {
    const store = await cookies();
    store.delete(PENDING_INVITE_COOKIE);
}

/**
 * Called after signup/login (post `/api/auth/session`) to auto-attach the
 * user to the inviter's project if a pending invite cookie is present.
 * Safe to call on every dashboard load — it's a no-op if no cookie is set.
 */
export async function consumePendingInviteToken(): Promise<{
    consumed: boolean;
    projectId?: string;
    projectName?: string;
    error?: string;
}> {
    try {
        const store = await cookies();
        const token = store.get(PENDING_INVITE_COOKIE)?.value;
        if (!token) return { consumed: false };

        const result = await acceptInvitation(token);
        if (!result.success) {
            // Silent failures keep the fallback flow going (e.g. wrong email).
            return { consumed: false, error: result.error };
        }
        return { consumed: true, projectId: result.projectId, projectName: result.projectName };
    } catch (e) {
        return { consumed: false, error: getErrorMessage(e) };
    }
}

/**
 * Change a team member's role on a single project. Only the project owner may do this.
 */
export async function changeAgentRole(args: {
    projectId: string;
    agentUserId: string;
    role: string;
}): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    const { projectId, agentUserId, role } = args;
    if (!projectId || !ObjectId.isValid(projectId)) return { success: false, error: 'Invalid project.' };
    if (!agentUserId || !ObjectId.isValid(agentUserId)) return { success: false, error: 'Invalid agent.' };
    if (!role) return { success: false, error: 'Missing role.' };

    const guard = await requirePermission('team_users', 'edit', projectId);
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            {
                _id: new ObjectId(projectId),
                userId: new ObjectId(session.user._id),
                'agents.userId': new ObjectId(agentUserId),
            },
            { $set: { 'agents.$.role': role } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Project or agent not found, or you are not the owner.' };
        }
        await logActivity('MEMBER_ROLE_CHANGED', { agentUserId, role }, projectId);
        revalidatePath('/dashboard/team/manage-users');
        return { success: true };
    } catch (e) {
        console.error('[changeAgentRole] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}
