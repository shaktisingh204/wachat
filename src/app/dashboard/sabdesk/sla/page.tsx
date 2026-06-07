"use client";

import React, { useState } from 'react';
import {
  ShieldAlert, Clock, Filter, AlertTriangle,
  Settings, Bell, Mail, MessageSquare, Plus,
  Trash2, StopCircle,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Badge,
  Dot,
  Input,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

const mockSLAs = [
  { id: 'sla-1', name: 'Enterprise Default SLA', desc: 'Standard targets for enterprise-tier customers.', targets: 4, active: true, matching: 1240 },
  { id: 'sla-2', name: 'Global VIP Support', desc: 'Aggressive targets for Top 100 accounts.', targets: 4, active: true, matching: 85 },
  { id: 'sla-3', name: 'Free Tier Basic', desc: 'Best effort responses for free accounts.', targets: 4, active: true, matching: 45200 },
  { id: 'sla-4', name: 'Holiday Special Override', desc: 'Extended targets during holiday season.', targets: 4, active: false, matching: 0 },
];

const targetRows: Array<{ priority: string; tone: 'danger' | 'warning' | 'info' | 'neutral'; first: number; next: number; resolution: number; resolutionUnit: string }> = [
  { priority: 'Urgent', tone: 'danger', first: 15, next: 30, resolution: 4, resolutionUnit: 'hrs' },
  { priority: 'High', tone: 'warning', first: 30, next: 60, resolution: 8, resolutionUnit: 'hrs' },
  { priority: 'Medium', tone: 'info', first: 60, next: 120, resolution: 24, resolutionUnit: 'days' },
  { priority: 'Low', tone: 'neutral', first: 60, next: 120, resolution: 24, resolutionUnit: 'days' },
];

export default function SLAPage() {
  const [selectedSLA, setSelectedSLA] = useState<string | null>('sla-1');

  const activeCount = mockSLAs.filter((s) => s.active).length;

  return (
    <div className="ui20 dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">

        {/* Left Sidebar: Policies List */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <Card variant="elevated" padding="lg">
            <PageHeader bordered={false} compact>
              <PageHeaderHeading>
                <PageTitle className="flex items-center gap-3">
                  <ShieldAlert className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" />
                  SLA Policies
                </PageTitle>
                <PageDescription>
                  Define response and resolution times to maintain support standards.
                </PageDescription>
              </PageHeaderHeading>
            </PageHeader>
            <PageActions className="mt-5">
              <Button variant="primary" block iconLeft={Plus}>
                Create Policy
              </Button>
            </PageActions>
          </Card>

          <Card variant="elevated" padding="none" className="flex-1 overflow-hidden flex flex-col min-h-[500px]">
            <CardHeader className="flex justify-between items-center border-b border-[var(--st-border)]">
              <CardTitle>Active Policies ({activeCount})</CardTitle>
              <IconButton label="Policy list settings" icon={Settings} size="sm" />
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {mockSLAs.map((sla) => {
                const isSelected = selectedSLA === sla.id;
                return (
                  <Card
                    key={sla.id}
                    variant="interactive"
                    padding="md"
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedSLA(sla.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSLA(sla.id);
                      }
                    }}
                    className={isSelected ? 'ring-2 ring-[var(--st-accent)]' : undefined}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`text-sm font-semibold ${isSelected ? 'text-[var(--st-accent)]' : 'text-[var(--st-text)]'}`}>
                        {sla.name}
                      </h3>
                      <Dot
                        tone={sla.active ? 'success' : 'neutral'}
                        pulse={sla.active}
                        aria-label={sla.active ? 'Active policy' : 'Inactive policy'}
                      />
                    </div>
                    <p className="text-xs text-[var(--st-text-secondary)] line-clamp-2 mb-3">{sla.desc}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[var(--st-text-secondary)] flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" /> {sla.targets} Targets
                      </span>
                      <Badge tone="neutral" kind="soft">
                        {sla.matching.toLocaleString()} tickets
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Content: Policy Editor */}
        <div className="w-full lg:w-2/3">
          {selectedSLA ? (
            <Card variant="elevated" padding="none" className="h-full flex flex-col">

              {/* Editor Header */}
              <CardHeader className="flex justify-between items-start border-b border-[var(--st-border)]">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <CardTitle className="text-xl">Enterprise Default SLA</CardTitle>
                    <Badge tone="success" kind="soft">Active</Badge>
                  </div>
                  <CardDescription>Applies to 1,240 currently active tickets.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton label="Pause this policy" icon={StopCircle} variant="outline" />
                  <IconButton label="Delete this policy" icon={Trash2} variant="danger" />
                  <Button variant="primary" className="ml-2">Save Changes</Button>
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10">

                {/* Apply To */}
                <section>
                  <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Filter className="w-4 h-4" aria-hidden="true" /> 1. Apply this SLA when:
                  </h3>
                  <Card variant="outlined" padding="md">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-[var(--st-text)]">Ticket</span>
                      <Select defaultValue="organization">
                        <SelectTrigger aria-label="Ticket attribute" className="w-auto min-w-[160px]">
                          <SelectValue placeholder="Attribute" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organization">Organization</SelectItem>
                          <SelectItem value="priority">Priority</SelectItem>
                          <SelectItem value="channel">Channel</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-[var(--st-text)]">is</span>
                      <Select defaultValue="enterprise">
                        <SelectTrigger aria-label="Attribute value" className="w-auto min-w-[160px]">
                          <SelectValue placeholder="Value" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enterprise">Enterprise Tier</SelectItem>
                          <SelectItem value="business">Business Tier</SelectItem>
                          <SelectItem value="free">Free Tier</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                </section>

                {/* SLA Targets */}
                <section>
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4" aria-hidden="true" /> 2. Set SLA Targets
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--st-text-secondary)]">Business Hours:</span>
                      <Select defaultValue="24-7">
                        <SelectTrigger aria-label="Business hours calendar" className="w-auto min-w-[140px]">
                          <SelectValue placeholder="Calendar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24-7">24/7 Support</SelectItem>
                          <SelectItem value="us-east">US East (9-5)</SelectItem>
                          <SelectItem value="emea">EMEA (9-5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Card variant="outlined" padding="none" className="overflow-hidden">
                    <Table density="comfortable" hover>
                      <THead>
                        <Tr>
                          <Th width="25%">Priority</Th>
                          <Th>First Response</Th>
                          <Th>Next Response</Th>
                          <Th>Resolution</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {targetRows.map((row) => (
                          <Tr key={row.priority}>
                            <Td>
                              <Badge tone={row.tone} kind="soft">{row.priority}</Badge>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  inputSize="sm"
                                  defaultValue={row.first}
                                  aria-label={`${row.priority} first response value`}
                                  className="w-16 text-center"
                                />
                                <Select defaultValue="mins">
                                  <SelectTrigger aria-label={`${row.priority} first response unit`} className="w-auto min-w-[88px]">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mins">mins</SelectItem>
                                    <SelectItem value="hrs">hrs</SelectItem>
                                    <SelectItem value="days">days</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  inputSize="sm"
                                  defaultValue={row.next}
                                  aria-label={`${row.priority} next response value`}
                                  className="w-16 text-center"
                                />
                                <Select defaultValue="mins">
                                  <SelectTrigger aria-label={`${row.priority} next response unit`} className="w-auto min-w-[88px]">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mins">mins</SelectItem>
                                    <SelectItem value="hrs">hrs</SelectItem>
                                    <SelectItem value="days">days</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  inputSize="sm"
                                  defaultValue={row.resolution}
                                  aria-label={`${row.priority} resolution value`}
                                  className="w-16 text-center"
                                />
                                <Select defaultValue={row.resolutionUnit}>
                                  <SelectTrigger aria-label={`${row.priority} resolution unit`} className="w-auto min-w-[88px]">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mins">mins</SelectItem>
                                    <SelectItem value="hrs">hrs</SelectItem>
                                    <SelectItem value="days">days</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </Card>
                </section>

                {/* Escalations */}
                <section>
                  <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" /> 3. Escalation Rules (What happens on breach)
                  </h3>

                  <div className="space-y-4">
                    {/* Breach Rule 1 */}
                    <Card variant="outlined" padding="md" className="border-l-4 border-l-[var(--st-warn)]">
                      <div className="flex flex-wrap gap-4 items-center">
                        <span className="text-sm font-medium text-[var(--st-text)]">When</span>
                        <Select defaultValue="first-response">
                          <SelectTrigger aria-label="Escalation trigger metric" className="w-auto min-w-[180px]">
                            <SelectValue placeholder="Metric" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="first-response">First Response time</SelectItem>
                            <SelectItem value="resolution">Resolution time</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm font-medium text-[var(--st-text)]">is approaching in</span>
                        <Input
                          type="number"
                          inputSize="sm"
                          defaultValue={15}
                          aria-label="Approaching threshold minutes"
                          className="w-16 text-center"
                        />
                        <span className="text-sm font-medium text-[var(--st-text)]">mins, do:</span>
                      </div>

                      <div className="mt-4 pl-4 border-l-2 border-[var(--st-border)] space-y-3">
                        <div className="flex items-center gap-3">
                          <Bell className="w-4 h-4 text-[var(--st-warn)]" aria-hidden="true" />
                          <span className="text-sm text-[var(--st-text-secondary)]">Notify assigned agent via internal alert</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-[var(--st-warn)]" aria-hidden="true" />
                          <span className="text-sm text-[var(--st-text-secondary)]">Email supervisor (manager@sabdesk.internal)</span>
                        </div>
                      </div>
                    </Card>

                    {/* Breach Rule 2 */}
                    <Card variant="outlined" padding="md" className="border-l-4 border-l-[var(--st-danger)]">
                      <div className="flex flex-wrap gap-4 items-center">
                        <span className="text-sm font-medium text-[var(--st-text)]">When</span>
                        <Select defaultValue="resolution">
                          <SelectTrigger aria-label="Breach trigger metric" className="w-auto min-w-[180px]">
                            <SelectValue placeholder="Metric" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="resolution">Resolution time</SelectItem>
                            <SelectItem value="first-response">First Response time</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm font-medium text-[var(--st-text)]">is</span>
                        <Badge tone="danger" kind="soft">Breached</Badge>
                        <span className="text-sm font-medium text-[var(--st-text)]">, do:</span>
                      </div>

                      <div className="mt-4 pl-4 border-l-2 border-[var(--st-border)] space-y-3">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-4 h-4 text-[var(--st-danger)]" aria-hidden="true" />
                          <span className="text-sm text-[var(--st-text-secondary)]">
                            Escalate ticket priority to <strong className="text-[var(--st-text)]">Urgent</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-4 h-4 text-[var(--st-danger)]" aria-hidden="true" />
                          <span className="text-sm text-[var(--st-text-secondary)]">Add private note warning of breach</span>
                        </div>
                      </div>
                    </Card>

                    <Button variant="ghost" block iconLeft={Plus}>
                      Add Escalation Rule
                    </Button>
                  </div>
                </section>

              </div>
            </Card>
          ) : (
            <Card variant="outlined" padding="lg" className="h-full flex items-center justify-center">
              <EmptyState
                icon={ShieldAlert}
                title="No policy selected"
                description="Select a policy from the list to view or edit its targets and escalation rules."
              />
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
