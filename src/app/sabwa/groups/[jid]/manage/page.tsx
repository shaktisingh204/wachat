import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings2 } from 'lucide-react';

export const metadata = { title: 'Group Manager — SabWa' };

export default async function Page({ params }: { params: Promise<{ jid: string }> }) {
  const { jid } = await params;
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Settings2 className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Group Manager</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            jid: {jid}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Full admin console for a single WhatsApp group: identity, membership, permissions, and outreach.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Everything a group admin needs in one place, with safety rails on member outreach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Edit subject, description, and icon.</li>
            <li>Add or remove members &mdash; paste numbers or pick from contacts.</li>
            <li>Promote or demote admins, plus per-permission controls (send / edit info / disappearing-message timer).</li>
            <li>Review pending join requests for community groups.</li>
            <li>Generate or revoke invite links and view scan analytics.</li>
            <li>Export member list and run a rate-limited bulk DM to all members.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
