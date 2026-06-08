"use client";

import React from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Button,
    IconButton,
    Badge,
    StatCard,
    EmptyState,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
    type BadgeTone,
} from "@/components/sabcrm/20ui";
import { Bolt, Plus, Settings, PlayCircle, Clock, Zap, CheckCircle2, PauseCircle } from "lucide-react";

type AutomationStatus = "Active" | "Paused" | "Draft";

interface Automation {
    id: string;
    name: string;
    trigger: string;
    base: string;
    status: AutomationStatus;
}

const STATUS_TONE: Record<AutomationStatus, BadgeTone> = {
    Active: "success",
    Paused: "warning",
    Draft: "neutral",
};

export default function SabTablesAutomationsPage() {
    const automations: Automation[] = [
        { id: "1", name: "Send Welcome Email", trigger: "On Record Creation", base: "Customer CRM", status: "Active" },
        { id: "2", name: "Notify on Low Stock", trigger: "When Record Matches Condition", base: "Inventory Tracker", status: "Active" },
        { id: "3", name: "Weekly Report Generation", trigger: "Scheduled", base: "Operations", status: "Paused" },
        { id: "4", name: "Sync to external API", trigger: "On Record Update", base: "Event Planning", status: "Draft" },
    ];

    const total = automations.length;
    const activeCount = automations.filter((a) => a.status === "Active").length;
    const pausedCount = automations.filter((a) => a.status === "Paused").length;
    const draftCount = automations.filter((a) => a.status === "Draft").length;

    return (
        <TooltipProvider>
            <div className="20ui p-6 space-y-6">
                <PageHeader>
                    <PageHeaderHeading>
                        <PageTitle>Automations</PageTitle>
                        <PageDescription>Manage automated workflows that run against your tables.</PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <Button variant="primary" iconLeft={Plus}>
                            Create Automation
                        </Button>
                    </PageActions>
                </PageHeader>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total automations" value={total} icon={Zap} />
                    <StatCard label="Active" value={activeCount} icon={CheckCircle2} />
                    <StatCard label="Paused" value={pausedCount} icon={PauseCircle} />
                    <StatCard label="Drafts" value={draftCount} icon={Bolt} />
                </div>

                <Card padding="none">
                    <CardHeader>
                        <CardTitle>All Automations</CardTitle>
                        <CardDescription>Every workflow across your bases and the triggers that run them.</CardDescription>
                    </CardHeader>
                    <CardBody>
                        {automations.length === 0 ? (
                            <EmptyState
                                icon={Zap}
                                title="No automations yet"
                                description="Create your first automation to run actions automatically when records change."
                                action={
                                    <Button variant="primary" iconLeft={Plus}>
                                        Create Automation
                                    </Button>
                                }
                            />
                        ) : (
                            <Table hover>
                                <THead>
                                    <Tr>
                                        <Th>Automation Name</Th>
                                        <Th>Trigger</Th>
                                        <Th>Base</Th>
                                        <Th>Status</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {automations.map((automation) => {
                                        const TriggerIcon = automation.trigger === "Scheduled" ? Clock : PlayCircle;
                                        return (
                                            <Tr key={automation.id}>
                                                <Td>
                                                    <div className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                                                        <Bolt className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                                                        <span>{automation.name}</span>
                                                    </div>
                                                </Td>
                                                <Td>
                                                    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)]">
                                                        <TriggerIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                                        {automation.trigger}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    <span className="text-[var(--st-text-secondary)]">{automation.base}</span>
                                                </Td>
                                                <Td>
                                                    <Badge tone={STATUS_TONE[automation.status]} dot>
                                                        {automation.status}
                                                    </Badge>
                                                </Td>
                                                <Td align="right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <IconButton
                                                                label={`Configure ${automation.name}`}
                                                                icon={Settings}
                                                                variant="ghost"
                                                                size="sm"
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Configure</TooltipContent>
                                                    </Tooltip>
                                                </Td>
                                            </Tr>
                                        );
                                    })}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>
            </div>
        </TooltipProvider>
    );
}
