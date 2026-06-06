'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Switch,
  useToast,
} from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { Bell, Mail, Save } from 'lucide-react';

type Prefs = {
  memberJoined: boolean;
  memberRemoved: boolean;
  roleChanged: boolean;
  inviteAccepted: boolean;
  inviteExpired: boolean;
  taskAssigned: boolean;
  mentioned: boolean;
  dailyDigest: boolean;
  weeklyDigest: boolean;
};

const DEFAULTS: Prefs = {
  memberJoined: true,
  memberRemoved: true,
  roleChanged: true,
  inviteAccepted: true,
  inviteExpired: false,
  taskAssigned: true,
  mentioned: true,
  dailyDigest: false,
  weeklyDigest: true,
};

const GROUPS: Array<{
  title: string;
  description: string;
  keys: Array<{ id: keyof Prefs; label: string; description: string }>;
}> = [
  {
    title: 'Membership events',
    description: 'Get notified when people join, leave, or change roles.',
    keys: [
      { id: 'memberJoined', label: 'Member joined', description: 'Someone accepts an invitation to your workspace.' },
      { id: 'memberRemoved', label: 'Member removed', description: 'An admin removes a teammate.' },
      { id: 'roleChanged', label: 'Role changed', description: "A teammate's permissions are updated." },
    ],
  },
  {
    title: 'Invitations',
    description: 'Keep tabs on outstanding invites.',
    keys: [
      { id: 'inviteAccepted', label: 'Invitation accepted', description: 'Your invite email turned into a new teammate.' },
      { id: 'inviteExpired', label: 'Invitation expired', description: 'A pending invite hit its 7-day TTL.' },
    ],
  },
  {
    title: 'Collaboration',
    description: 'Direct pings from tasks, chat, and activity.',
    keys: [
      { id: 'taskAssigned', label: 'Task assigned to me', description: 'Another teammate assigns you a task.' },
      { id: 'mentioned', label: 'Mentioned in chat', description: 'Someone @-mentions you in team chat.' },
    ],
  },
  {
    title: 'Digests',
    description: 'Periodic summaries, easy to skim in your inbox.',
    keys: [
      { id: 'dailyDigest', label: 'Daily digest email', description: "One email per morning with yesterday's activity." },
      { id: 'weeklyDigest', label: 'Weekly digest email', description: 'Monday-morning summary of the past week.' },
    ],
  },
];

export default function TeamNotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const toggle = (key: keyof Prefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    // Preferences are persisted client-side until the backend endpoint lands.
    // Keep parity with the shape the server expects when wired up.
    try {
      localStorage.setItem('team_notification_prefs', JSON.stringify(prefs));
      toast.success('Preferences saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/team">Team</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Notifications</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Notifications</PageTitle>
          <PageDescription>Choose which team events should land in your inbox.</PageDescription>
        </PageHeading>
        <Button variant="primary" size="sm" iconLeft={Save} loading={saving} onClick={handleSave}>
          {saving ? 'Saving' : 'Save preferences'}
        </Button>
      </PageHeader>

      <Card variant="elevated" className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]"
          aria-hidden="true"
        >
          <Mail className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[13px] text-[var(--st-text)]">Delivery channel</p>
          <p className="text-[12.5px] text-[var(--st-text-secondary)]">
            Emails go to your account address. Push and Slack delivery arrive later.
          </p>
        </div>
      </Card>

      {GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader className="flex items-start gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
              aria-hidden="true"
            >
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>{group.title}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-[var(--st-border)]">
              {group.keys.map((row) => {
                const descId = `${row.id}-desc`;
                return (
                  <li key={row.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <Label htmlFor={row.id} className="text-[13px] text-[var(--st-text)]">
                        {row.label}
                      </Label>
                      <p id={descId} className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                        {row.description}
                      </p>
                    </div>
                    <Switch
                      id={row.id}
                      checked={prefs[row.id]}
                      onCheckedChange={() => toggle(row.id)}
                      aria-describedby={descId}
                    />
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
