"use client";

import React, { useState } from 'react';
import {
  Zap, Plus, Search, Filter, Play, Activity,
  AlertCircle, ArrowRight, Save, Trash2, Edit, MoreHorizontal,
  GitBranch, Terminal, FileJson
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  StatCard,
  Input,
  Textarea,
  Field,
  Badge,
  Dot,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

const mockTriggers = [
  { id: 't1', name: 'Auto-assign VIP Tickets', event: 'Ticket Created', active: true, conditions: 2, actions: 1, lastRun: '2 mins ago' },
  { id: 't2', name: 'SLA Warning Escalation', event: 'Time Based', active: true, conditions: 3, actions: 2, lastRun: '15 mins ago' },
  { id: 't3', name: 'Spam Filter Auto-close', event: 'Ticket Created', active: false, conditions: 5, actions: 3, lastRun: '2 days ago' },
  { id: 't4', name: 'Notify Manager on Negative CSAT', event: 'CSAT Received', active: true, conditions: 1, actions: 2, lastRun: '1 hr ago' },
  { id: 't5', name: 'Auto-reply outside Business Hours', event: 'Ticket Created', active: true, conditions: 2, actions: 1, lastRun: '5 hrs ago' },
];

export default function TriggersPage() {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle className="flex items-center gap-3">
              <Zap className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" />
              Event Triggers
            </PageTitle>
            <PageDescription>
              Set up powerful automations that run when specific events occur in your helpdesk.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="primary" iconLeft={Plus} onClick={() => setActiveTab('builder')}>
              New Trigger
            </Button>
          </PageActions>
        </PageHeader>

        {activeTab === 'list' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Active Triggers" value="42" icon={Activity} accent="var(--st-status-ok)" />
              <StatCard label="Executions (24h)" value="15.4k" icon={Play} accent="var(--st-accent)" />
              <StatCard label="Failed Executions" value="3" icon={AlertCircle} accent="var(--st-danger)" />
            </div>

            <Card padding="none">
              <div className="p-4 border-b border-[var(--st-border)] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="w-full sm:w-72">
                  <Field label="Search triggers" className="!gap-0">
                    <Input
                      type="text"
                      placeholder="Search triggers..."
                      iconLeft={Search}
                      aria-label="Search triggers"
                    />
                  </Field>
                </div>
                <Button variant="outline" iconLeft={Filter}>
                  Filter
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Trigger Event</Th>
                      <Th>Complexity</Th>
                      <Th>Status</Th>
                      <Th>Last Run</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {mockTriggers.map((trigger) => (
                      <Tr key={trigger.id}>
                        <Td>
                          <span className="font-medium text-[var(--st-text)]">{trigger.name}</span>
                        </Td>
                        <Td>
                          <Badge tone="neutral" kind="outline">
                            <Play className="w-3 h-3 text-[var(--st-status-ok)]" aria-hidden="true" />
                            {trigger.event}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-1 text-xs text-[var(--st-text-secondary)]">
                            <span>{trigger.conditions} Conditions</span>
                            <span>{trigger.actions} Actions</span>
                          </div>
                        </Td>
                        <Td>
                          {trigger.active ? (
                            <span className="inline-flex items-center gap-1.5 text-[var(--st-status-ok)] text-sm font-medium">
                              <Dot tone="success" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[var(--st-text-tertiary)] text-sm font-medium">
                              <Dot tone="neutral" /> Inactive
                            </span>
                          )}
                        </Td>
                        <Td>
                          <span className="text-sm text-[var(--st-text-secondary)]">{trigger.lastRun}</span>
                        </Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-2">
                            <IconButton
                              label="Edit trigger"
                              icon={Edit}
                              size="sm"
                              onClick={() => setActiveTab('builder')}
                            />
                            <IconButton label="More options" icon={MoreHorizontal} size="sm" />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'builder' && (
          <Card padding="none">
            <div className="p-4 border-b border-[var(--st-border)] flex justify-between items-center sticky top-0 z-20 bg-[var(--st-bg-secondary)]">
              <div className="flex items-center gap-4">
                <IconButton
                  label="Back to triggers"
                  icon={ArrowRight}
                  className="rotate-180"
                  onClick={() => setActiveTab('list')}
                />
                <h2 className="text-xl font-bold text-[var(--st-text)]">Create Automation Trigger</h2>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setActiveTab('list')}>
                  Cancel
                </Button>
                <Button variant="primary" iconLeft={Save}>
                  Save &amp; Activate
                </Button>
              </div>
            </div>

            <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-12">

              {/* Trigger Name */}
              <Field label="Trigger Name">
                <Input
                  type="text"
                  inputSize="lg"
                  placeholder="e.g. Escalate VIP tickets created off-hours"
                />
              </Field>

              {/* Event Section */}
              <div className="relative border-l-2 border-[var(--st-accent)] pl-8 pb-8">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-[var(--st-radius-pill)] bg-[var(--st-accent-soft)] border-2 border-[var(--st-accent)] flex items-center justify-center">
                  <Play className="w-4 h-4 text-[var(--st-accent)] ml-0.5" aria-hidden="true" />
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--st-text)]">1. When this event occurs</h3>
                    <p className="text-sm text-[var(--st-text-secondary)]">Choose what triggers this automation to run.</p>
                  </div>

                  <div className="w-64">
                    <Field label="Trigger event" className="!gap-0">
                      <Select defaultValue="created">
                        <SelectTrigger aria-label="Trigger event">
                          <SelectValue placeholder="Select an event" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="created">Ticket is Created</SelectItem>
                          <SelectItem value="updated">Ticket is Updated</SelectItem>
                          <SelectItem value="message">New Message Added</SelectItem>
                          <SelectItem value="cron">Time Based (Cron)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Conditions Section */}
              <div className="relative border-l-2 border-[var(--st-warn)] pl-8 pb-8">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-[var(--st-radius-pill)] bg-[var(--st-bg-muted)] border-2 border-[var(--st-warn)] flex items-center justify-center">
                  <GitBranch className="w-4 h-4 text-[var(--st-warn)]" aria-hidden="true" />
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--st-text)]">2. Check these conditions</h3>
                    <p className="text-sm text-[var(--st-text-secondary)]">Only proceed if the ticket matches these criteria.</p>
                  </div>

                  {/* ALL Conditions */}
                  <Card variant="ghost" padding="md" className="bg-[var(--st-bg-secondary)] space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" kind="solid">MATCH ALL</Badge>
                      <span className="text-sm text-[var(--st-text-secondary)]">of the following conditions:</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Condition Row 1 */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="w-48">
                          <Select defaultValue="priority">
                            <SelectTrigger aria-label="Condition field">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="priority">Ticket: Priority</SelectItem>
                              <SelectItem value="status">Ticket: Status</SelectItem>
                              <SelectItem value="email">Requester: Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32">
                          <Select defaultValue="is">
                            <SelectTrigger aria-label="Condition operator">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="is">Is</SelectItem>
                              <SelectItem value="is-not">Is not</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                          <Select defaultValue="urgent">
                            <SelectTrigger aria-label="Condition value">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="urgent">Urgent</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <IconButton label="Remove condition" icon={Trash2} variant="danger" size="sm" />
                      </div>

                      {/* Condition Row 2 */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="w-48">
                          <Select defaultValue="vip">
                            <SelectTrigger aria-label="Condition field">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vip">Requester: VIP Status</SelectItem>
                              <SelectItem value="status">Ticket: Status</SelectItem>
                              <SelectItem value="email">Requester: Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32">
                          <Select defaultValue="true">
                            <SelectTrigger aria-label="Condition operator">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Is True</SelectItem>
                              <SelectItem value="false">Is False</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <IconButton label="Remove condition" icon={Trash2} variant="danger" size="sm" />
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" iconLeft={Plus}>
                      Add &quot;ALL&quot; Condition
                    </Button>
                  </Card>

                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 h-px bg-[var(--st-border)]" />
                    <Badge tone="neutral" kind="outline">AND</Badge>
                    <div className="flex-1 h-px bg-[var(--st-border)]" />
                  </div>

                  {/* ANY Conditions */}
                  <Card variant="ghost" padding="md" className="bg-[var(--st-bg-secondary)] space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" kind="solid">MATCH ANY</Badge>
                      <span className="text-sm text-[var(--st-text-secondary)]">of the following conditions (optional):</span>
                    </div>

                    <Button variant="ghost" size="sm" iconLeft={Plus}>
                      Add &quot;ANY&quot; Condition
                    </Button>
                  </Card>

                </div>
              </div>

              {/* Actions Section */}
              <div className="relative border-l-2 border-[var(--st-accent)] pl-8">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-[var(--st-radius-pill)] bg-[var(--st-accent-soft)] border-2 border-[var(--st-accent)] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--st-text)]">3. Perform these actions</h3>
                    <p className="text-sm text-[var(--st-text-secondary)]">What should happen when the conditions are met?</p>
                  </div>

                  <Card variant="ghost" padding="md" className="bg-[var(--st-bg-secondary)] space-y-4">
                    <div className="flex flex-col gap-4">

                      {/* Action Row 1 */}
                      <Card variant="outlined" padding="md" className="flex gap-4 items-start">
                        <div className="mt-1">
                          <Terminal className="w-5 h-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-center gap-2">
                            <div className="w-48">
                              <Select defaultValue="webhook">
                                <SelectTrigger aria-label="Action type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="webhook">Trigger Webhook</SelectItem>
                                  <SelectItem value="assign">Assign to Agent</SelectItem>
                                  <SelectItem value="email">Send Email</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <IconButton label="Remove action" icon={Trash2} variant="danger" size="sm" />
                          </div>

                          <div className="space-y-3 pt-2">
                            <Field label="Endpoint URL">
                              <Input
                                type="text"
                                inputSize="sm"
                                className="font-mono"
                                defaultValue="https://api.internal.corp/notify-escalation"
                              />
                            </Field>
                            <Field
                              label={
                                <span className="flex items-center justify-between">
                                  Payload (JSON)
                                  <FileJson className="w-3 h-3" aria-hidden="true" />
                                </span>
                              }
                            >
                              <Textarea
                                rows={4}
                                className="font-mono text-xs resize-none"
                                defaultValue={`{\n  "ticket_id": "{ticket.id}",\n  "priority": "{ticket.priority}",\n  "alert_channel": "#urgent-support"\n}`}
                              />
                            </Field>
                          </div>
                        </div>
                      </Card>

                    </div>

                    <Button variant="outline" block iconLeft={Plus} className="py-4 border-dashed">
                      Add Action
                    </Button>
                  </Card>

                </div>
              </div>

            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
