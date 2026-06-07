'use client';
import React, { useMemo, useState } from 'react';
import {
  Activity,
  Users,
  ShieldCheck,
  Clock,
  Filter,
  Download,
  Search,
  Bell,
  Plus,
  RefreshCw,
  Zap,
  CalendarClock,
} from 'lucide-react';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Input,
  Field,
  SegmentedControl,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';

type SwapStatus = 'Approved' | 'Pending' | 'Declined';
type SwapPriority = 'High' | 'Medium' | 'Low';

interface SwapRequest {
  id: string;
  requester: string;
  shift: string;
  coverBy: string;
  status: SwapStatus;
  priority: SwapPriority;
}

const STATUS_TONE: Record<SwapStatus, 'success' | 'warning' | 'danger'> = {
  Approved: 'success',
  Pending: 'warning',
  Declined: 'danger',
};

const PRIORITY_TONE: Record<SwapPriority, 'danger' | 'warning' | 'neutral'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
};

const SWAP_REQUESTS: SwapRequest[] = [
  { id: 'SWP-1042', requester: 'Aisha Khan', shift: 'Mon 06:00 - 14:00', coverBy: 'Daniel Cruz', status: 'Approved', priority: 'High' },
  { id: 'SWP-1041', requester: 'Marcus Lee', shift: 'Tue 14:00 - 22:00', coverBy: 'Priya Nair', status: 'Pending', priority: 'Medium' },
  { id: 'SWP-1040', requester: 'Elena Rossi', shift: 'Wed 22:00 - 06:00', coverBy: 'Open pool', status: 'Pending', priority: 'High' },
  { id: 'SWP-1039', requester: 'Tom Becker', shift: 'Thu 09:00 - 17:00', coverBy: 'Sara Okonkwo', status: 'Approved', priority: 'Low' },
  { id: 'SWP-1038', requester: 'Jin Park', shift: 'Fri 12:00 - 20:00', coverBy: 'Hassan Ali', status: 'Declined', priority: 'Medium' },
  { id: 'SWP-1037', requester: 'Nora Smith', shift: 'Sat 08:00 - 16:00', coverBy: 'Leo Martins', status: 'Approved', priority: 'Low' },
  { id: 'SWP-1036', requester: 'Omar Farah', shift: 'Sun 16:00 - 00:00', coverBy: 'Open pool', status: 'Pending', priority: 'High' },
  { id: 'SWP-1035', requester: 'Grace Wong', shift: 'Mon 14:00 - 22:00', coverBy: 'Ben Carter', status: 'Approved', priority: 'Medium' },
];

const INSIGHTS = [
  { title: 'Coverage gap on night shift', body: 'Wednesday 22:00 to 06:00 has an unfilled swap. Suggest routing to the open pool.' },
  { title: 'Repeated swaps detected', body: 'Marcus Lee has requested 4 swaps this month. Review for scheduling fairness.' },
  { title: 'Auto-approve candidate', body: 'Sara Okonkwo meets all overlap and skill rules for the Thursday day shift.' },
  { title: 'Overtime risk', body: 'Approving SWP-1036 would push Omar Farah past 40 hours this week.' },
  { title: 'Faster turnaround', body: 'Average approval time dropped to 1.2 hours after enabling rule-based routing.' },
];

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom' },
] as const;

type RangeValue = (typeof RANGE_OPTIONS)[number]['value'];

export default function WorkforceShiftSwapsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<RangeValue>('7d');

  const filteredRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return SWAP_REQUESTS;
    return SWAP_REQUESTS.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.requester.toLowerCase().includes(q) ||
        r.coverBy.toLowerCase().includes(q) ||
        r.shift.toLowerCase().includes(q),
    );
  }, [searchTerm]);

  return (
    <div className="ui20 flex flex-col w-full min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <PageHeader className="px-8">
        <PageHeaderHeading>
          <PageTitle>Workforce Shift Swaps</PageTitle>
          <PageDescription>
            Review, approve, and optimize shift swap requests across your workforce.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <IconButton label="Search" icon={Search} variant="ghost" />
          <IconButton label="Notifications" icon={Bell} variant="ghost" />
          <Button variant="primary" iconLeft={Plus}>
            New swap request
          </Button>
        </PageActions>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <SegmentedControl
          items={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          aria-label="Date range"
        />
        <div className="flex items-center gap-2">
          <Field className="w-64" label="">
            <Input
              type="search"
              placeholder="Search by name, ID, or shift"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              iconLeft={Search}
              aria-label="Search swap requests"
            />
          </Field>
          <Button variant="outline" iconLeft={Filter}>
            Filter
          </Button>
          <Button variant="outline" iconLeft={Download}>
            Export
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <main className="flex-1 p-8 grid grid-cols-12 gap-6 overflow-y-auto">
        {/* KPI Cards */}
        <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Requests"
            value="1,248"
            icon={Activity}
            delta={{ value: '+14%', tone: 'up' }}
          />
          <StatCard
            label="Covered Shifts"
            value="842"
            icon={Users}
            delta={{ value: '+5%', tone: 'up' }}
          />
          <StatCard
            label="Approval Rate"
            value="99.9%"
            icon={ShieldCheck}
            delta={{ value: 'Stable', tone: 'neutral' }}
          />
          <StatCard
            label="Avg Resolution"
            value="1.2 hrs"
            icon={Clock}
            delta={{ value: '-12%', tone: 'down' }}
          />
        </div>

        {/* Live Data Feed */}
        <div className="col-span-12 lg:col-span-8">
          <Card padding="none" className="flex flex-col h-[600px]">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Live Swap Requests</CardTitle>
              <IconButton label="Refresh requests" icon={RefreshCw} variant="ghost" />
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto">
              {filteredRequests.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No matching requests"
                  description="Try a different search term or widen the date range."
                />
              ) : (
                <Table hover stickyHeader>
                  <THead>
                    <Tr>
                      <Th>ID</Th>
                      <Th>Requester</Th>
                      <Th>Shift</Th>
                      <Th>Cover by</Th>
                      <Th>Status</Th>
                      <Th>Priority</Th>
                      <Th align="right">Action</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {filteredRequests.map((req) => (
                      <Tr key={req.id}>
                        <Td className="font-mono text-[var(--st-text-secondary)]">{req.id}</Td>
                        <Td className="font-medium">{req.requester}</Td>
                        <Td className="text-[var(--st-text-secondary)]">{req.shift}</Td>
                        <Td className="text-[var(--st-text-secondary)]">{req.coverBy}</Td>
                        <Td>
                          <Badge tone={STATUS_TONE[req.status]}>{req.status}</Badge>
                        </Td>
                        <Td>
                          <Badge tone={PRIORITY_TONE[req.priority]} kind="outline">
                            {req.priority}
                          </Badge>
                        </Td>
                        <Td align="right">
                          <Button variant="ghost" size="sm">
                            View details
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="col-span-12 lg:col-span-4">
          <Card padding="none" className="flex flex-col h-[600px]">
            <CardHeader className="flex items-center gap-2">
              <Zap size={18} className="text-[var(--st-warn)]" aria-hidden="true" />
              <CardTitle>AI Insights</CardTitle>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto space-y-3">
              {INSIGHTS.map((insight) => (
                <Card key={insight.title} variant="outlined" padding="md">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="font-medium text-[var(--st-text)]">{insight.title}</h4>
                    <Badge tone="warning" kind="soft">
                      Action
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)]">{insight.body}</p>
                </Card>
              ))}
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
