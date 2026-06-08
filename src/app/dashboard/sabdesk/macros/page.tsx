"use client";

import React, { useState } from 'react';
import {
  Bot, Plus, Search, Filter, GripVertical, Play,
  XCircle, Zap, CornerDownRight, CheckCircle2,
  BookOpen, Hash,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Tag,
  EmptyState,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

const mockMacros = Array.from({ length: 45 }).map((_, i) => ({
  id: `mac-${i}`,
  name: i % 3 === 0 ? 'Reset Password Flow' : i % 3 === 1 ? 'Refund Request Standard' : 'Escalate to L2 Tech',
  description: 'Standard procedure for handling incoming requests of this type.',
  category: i % 2 === 0 ? 'Billing' : 'Technical',
  usageCount: Math.floor(Math.random() * 5000),
  lastUpdated: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
  active: i % 5 !== 0,
  actions: Math.floor(Math.random() * 4) + 1,
}));

export default function MacrosPage() {
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const panelOpen = Boolean(selectedMacro) || isCreating;

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6 flex gap-6">

      {/* Main List Area */}
      <div className={`flex-1 transition-all duration-300 ${panelOpen ? 'hidden lg:block lg:w-1/2' : 'w-full'}`}>
        <div className="space-y-6">
          <Card variant="outlined" padding="lg">
            <PageHeader bordered={false}>
              <PageHeaderHeading>
                <PageTitle className="flex items-center gap-3">
                  <Bot className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" />
                  Macros &amp; Quick Actions
                </PageTitle>
                <PageDescription>
                  Automate repetitive tasks with one-click multi-action macros.
                </PageDescription>
              </PageHeaderHeading>
              <PageActions>
                <Button variant="primary" iconLeft={Plus} onClick={() => setIsCreating(true)}>
                  Create Macro
                </Button>
              </PageActions>
            </PageHeader>
          </Card>

          <Card variant="outlined" padding="none" className="overflow-hidden flex flex-col h-[calc(100vh-220px)]">
            <div className="p-4 border-b border-[var(--st-border)] flex flex-wrap gap-4 items-center justify-between bg-[var(--st-bg-secondary)]">
              <div className="relative flex-1 min-w-[250px]">
                <Input
                  type="text"
                  placeholder="Search macros by name or action..."
                  iconLeft={Search}
                  aria-label="Search macros"
                />
              </div>
              <div className="flex gap-2 items-center">
                <Select defaultValue="all">
                  <SelectTrigger aria-label="Filter by category" className="w-44">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
                <IconButton label="More filters" icon={Filter} variant="outline" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {mockMacros.length === 0 ? (
                <EmptyState
                  icon={Zap}
                  title="No macros yet"
                  description="Create your first macro to automate repetitive support actions."
                  action={
                    <Button variant="primary" iconLeft={Plus} onClick={() => setIsCreating(true)}>
                      Create Macro
                    </Button>
                  }
                />
              ) : (
                <Table stickyHeader hover>
                  <THead>
                    <Tr>
                      <Th>Macro Name</Th>
                      <Th>Category</Th>
                      <Th>Actions</Th>
                      <Th align="right">Usage</Th>
                      <Th>Last Updated</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {mockMacros.map((macro, idx) => (
                      <Tr
                        key={macro.id}
                        selected={selectedMacro === macro.id}
                        onClick={() => { setSelectedMacro(macro.id); setIsCreating(false); }}
                        className="u-tr--clickable"
                      >
                        <Td>
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${macro.active ? 'bg-[var(--st-status-ok)]' : 'bg-[var(--st-text-tertiary)]'}`}
                              aria-hidden="true"
                            />
                            <div>
                              <p className="font-medium text-[var(--st-text)]">{macro.name} {idx}</p>
                              <p className="text-xs text-[var(--st-text-tertiary)] mt-0.5 truncate max-w-[200px]">{macro.description}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone="neutral" kind="outline">{macro.category}</Badge>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5 text-[var(--st-text-secondary)]">
                            <Zap className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />
                            <span className="text-sm">{macro.actions} steps</span>
                          </div>
                        </Td>
                        <Td align="right">
                          <span className="text-sm text-[var(--st-text-secondary)]">{macro.usageCount.toLocaleString()}</span>
                        </Td>
                        <Td>
                          <span className="text-sm text-[var(--st-text-tertiary)]">{macro.lastUpdated}</span>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Detail / Editor Panel */}
      {panelOpen && (
        <Card
          variant="elevated"
          padding="none"
          className="flex-1 overflow-hidden flex flex-col h-[calc(100vh-48px)] sticky top-6"
        >
          <CardHeader className="p-6 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex justify-between items-center">
            <div>
              <CardTitle>
                {isCreating ? 'Create New Macro' : 'Edit Macro: Reset Password Flow'}
              </CardTitle>
              <CardDescription>Configure actions to run simultaneously.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setSelectedMacro(null); setIsCreating(false); }}>
                Cancel
              </Button>
              <Button variant="primary" iconLeft={CheckCircle2}>
                Save Macro
              </Button>
            </div>
          </CardHeader>

          <CardBody className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4" aria-hidden="true" /> Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Macro Name">
                  <Input type="text" defaultValue={isCreating ? '' : 'Reset Password Flow'} />
                </Field>
                <Field label="Category">
                  <Select defaultValue="technical">
                    <SelectTrigger aria-label="Category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Description">
                    <Textarea
                      rows={2}
                      defaultValue={isCreating ? '' : 'Standard procedure for handling incoming requests of this type.'}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions Builder */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4" aria-hidden="true" /> Actions to Perform
                </h3>
                <Button variant="ghost" size="sm" iconLeft={Play}>
                  Test Run
                </Button>
              </div>

              <div className="space-y-3">
                {/* Action 1 */}
                <Card variant="outlined" padding="md" className="flex gap-4">
                  <div className="mt-1 text-[var(--st-text-tertiary)]">
                    <GripVertical className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <Select defaultValue="status">
                        <SelectTrigger aria-label="Action type" className="w-48">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="priority">Priority</SelectItem>
                          <SelectItem value="assign">Assign to Agent</SelectItem>
                          <SelectItem value="tags">Add Tags</SelectItem>
                          <SelectItem value="reply">Add Public Reply</SelectItem>
                        </SelectContent>
                      </Select>
                      <IconButton label="Remove action" icon={XCircle} variant="ghost" />
                    </div>
                    <div className="flex items-center gap-3">
                      <CornerDownRight className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      <span className="text-sm text-[var(--st-text-secondary)]">Set to</span>
                      <Select defaultValue="resolved">
                        <SelectTrigger aria-label="Status value" className="flex-1">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>

                {/* Action 2 */}
                <Card variant="outlined" padding="md" className="flex gap-4">
                  <div className="mt-1 text-[var(--st-text-tertiary)]">
                    <GripVertical className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <Select defaultValue="tags">
                        <SelectTrigger aria-label="Action type" className="w-48">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="priority">Priority</SelectItem>
                          <SelectItem value="assign">Assign to Agent</SelectItem>
                          <SelectItem value="tags">Add Tags</SelectItem>
                          <SelectItem value="reply">Add Public Reply</SelectItem>
                        </SelectContent>
                      </Select>
                      <IconButton label="Remove action" icon={XCircle} variant="ghost" />
                    </div>
                    <div className="flex items-center gap-3">
                      <CornerDownRight className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      <div className="flex flex-wrap gap-2 flex-1">
                        <Tag color="var(--st-accent)" onRemove={() => {}}>password-reset</Tag>
                        <Tag color="var(--st-status-ok)" onRemove={() => {}}>auto-handled</Tag>
                        <Button variant="outline" size="sm" iconLeft={Plus}>
                          Add Tag
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Action 3 - Rich Text Editor Mock */}
                <Card variant="outlined" padding="md" className="flex gap-4">
                  <div className="mt-1 text-[var(--st-text-tertiary)]">
                    <GripVertical className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <Select defaultValue="reply">
                        <SelectTrigger aria-label="Action type" className="w-48">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="priority">Priority</SelectItem>
                          <SelectItem value="assign">Assign to Agent</SelectItem>
                          <SelectItem value="tags">Add Tags</SelectItem>
                          <SelectItem value="reply">Add Public Reply</SelectItem>
                        </SelectContent>
                      </Select>
                      <IconButton label="Remove action" icon={XCircle} variant="ghost" />
                    </div>
                    <div className="flex items-start gap-3">
                      <CornerDownRight className="w-4 h-4 text-[var(--st-text-tertiary)] mt-2" aria-hidden="true" />
                      <div className="flex-1 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] overflow-hidden">
                        {/* Editor Toolbar */}
                        <div className="border-b border-[var(--st-border)] p-2 flex gap-2 items-center">
                          <IconButton label="Insert variable" icon={Hash} variant="ghost" size="sm" />
                          <Separator orientation="vertical" className="h-6" />
                          <span className="text-[var(--st-text-secondary)] font-bold px-2 py-1" aria-hidden="true">B</span>
                          <span className="text-[var(--st-text-secondary)] italic px-2 py-1" aria-hidden="true">I</span>
                          <span className="text-[var(--st-text-secondary)] underline px-2 py-1" aria-hidden="true">U</span>
                        </div>
                        <Textarea
                          rows={4}
                          aria-label="Public reply body"
                          className="border-0 rounded-none bg-transparent resize-y"
                          defaultValue={"Hi {requester.first_name},\n\nI have gone ahead and triggered a password reset for your account. You should receive an email shortly with instructions on how to set a new password.\n\nLet me know if you need anything else."}
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                <Button variant="outline" block iconLeft={Plus}>
                  Add Action
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

    </div>
  );
}
