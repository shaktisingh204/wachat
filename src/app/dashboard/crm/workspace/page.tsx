import {
  BookOpen,
  Megaphone,
  Calendar,
  MessagesSquare,
  Award,
  StickyNote,
  LayoutGrid,
} from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function WorkspaceOverviewPage() {
  return (
    <CrmModuleOverview
      title="Workspace"
      subtitle="Knowledge, notices, events, discussions, awards — richer collaboration modules ported from Worksuite."
      icon={LayoutGrid}
      sections={[
        {
          href: '/dashboard/crm/workspace/knowledge-base',
          label: 'Knowledge Base',
          description: 'Articles, videos, audio, documents grouped by category.',
          icon: BookOpen,
        },
        {
          href: '/dashboard/crm/workspace/notices',
          label: 'Notices',
          description: 'Broadcast notices with read-tracking.',
          icon: Megaphone,
        },
        {
          href: '/dashboard/crm/workspace/events',
          label: 'Events & Calendar',
          description: 'Meetings, reminders, RSVPs, recurring schedules.',
          icon: Calendar,
        },
        {
          href: '/dashboard/crm/workspace/discussions',
          label: 'Discussions',
          description: 'Threaded team conversations with replies.',
          icon: MessagesSquare,
        },
        {
          href: '/dashboard/crm/workspace/awards',
          label: 'Awards & Appreciations',
          description: 'Define awards and recognize contributions.',
          icon: Award,
        },
        {
          href: '/dashboard/crm/workspace/sticky-notes',
          label: 'Sticky Notes',
          description: 'Personal colored sticky notes.',
          icon: StickyNote,
        },
      ]}
    />
  );
}
