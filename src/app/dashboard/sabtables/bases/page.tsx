"use client";

import React from "react";
import {
    Button,
    IconButton,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Badge,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
} from "@/components/sabcrm/20ui";
import { Database, Plus, Settings, Archive, HardDrive } from "lucide-react";

type BaseStatus = "Active" | "Archived";

interface Base {
    id: string;
    name: string;
    workspace: string;
    status: BaseStatus;
    size: string;
    tables: number;
    updated: string;
}

export default function SabTablesBasesPage() {
    const bases: Base[] = [
        { id: "1", name: "Customer CRM", workspace: "Sales", status: "Active", size: "2.4 MB", tables: 8, updated: "2 hours ago" },
        { id: "2", name: "Inventory Tracker", workspace: "Operations", status: "Active", size: "8.1 MB", tables: 14, updated: "Yesterday" },
        { id: "3", name: "Event Planning", workspace: "Marketing", status: "Archived", size: "1.2 MB", tables: 5, updated: "3 weeks ago" },
        { id: "4", name: "Employee Directory", workspace: "HR", status: "Active", size: "3.5 MB", tables: 6, updated: "4 days ago" },
    ];

    const activeCount = bases.filter((b) => b.status === "Active").length;
    const archivedCount = bases.filter((b) => b.status === "Archived").length;
    const totalTables = bases.reduce((sum, b) => sum + b.tables, 0);

    return (
        <TooltipProvider>
            <div className="ui20 p-6 space-y-6">
                <PageHeader>
                    <PageHeaderHeading>
                        <PageTitle>Bases</PageTitle>
                        <PageDescription>
                            Manage your relational database bases across every workspace.
                        </PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <Button variant="primary" iconLeft={Plus}>
                            Create base
                        </Button>
                    </PageActions>
                </PageHeader>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total bases" value={bases.length} icon={Database} />
                    <StatCard label="Active" value={activeCount} icon={Database} />
                    <StatCard label="Archived" value={archivedCount} icon={Archive} />
                    <StatCard label="Tables" value={totalTables} icon={HardDrive} />
                </div>

                <Card padding="none">
                    <CardHeader>
                        <CardTitle>All bases</CardTitle>
                        <CardDescription>
                            Every base in your account, with its workspace and storage footprint.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        {bases.length === 0 ? (
                            <EmptyState
                                icon={Database}
                                title="No bases yet"
                                description="Create your first base to start organizing data into relational tables."
                                action={
                                    <Button variant="primary" iconLeft={Plus}>
                                        Create base
                                    </Button>
                                }
                            />
                        ) : (
                            <Table hover>
                                <THead>
                                    <Tr>
                                        <Th>Base name</Th>
                                        <Th>Workspace</Th>
                                        <Th>Status</Th>
                                        <Th align="right">Tables</Th>
                                        <Th align="right">Size</Th>
                                        <Th>Last updated</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {bases.map((base) => (
                                        <Tr key={base.id}>
                                            <Td>
                                                <div className="flex items-center gap-2">
                                                    <Database
                                                        className="h-4 w-4 text-[var(--st-text-tertiary)]"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="font-medium text-[var(--st-text)]">
                                                        {base.name}
                                                    </span>
                                                </div>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">
                                                    {base.workspace}
                                                </span>
                                            </Td>
                                            <Td>
                                                <Badge
                                                    tone={base.status === "Active" ? "success" : "neutral"}
                                                    dot
                                                >
                                                    {base.status}
                                                </Badge>
                                            </Td>
                                            <Td align="right">
                                                <span className="text-[var(--st-text-secondary)] tabular-nums">
                                                    {base.tables}
                                                </span>
                                            </Td>
                                            <Td align="right">
                                                <span className="text-[var(--st-text-secondary)] tabular-nums">
                                                    {base.size}
                                                </span>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-tertiary)]">
                                                    {base.updated}
                                                </span>
                                            </Td>
                                            <Td align="right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <IconButton
                                                                label={`Settings for ${base.name}`}
                                                                icon={Settings}
                                                                variant="ghost"
                                                                size="sm"
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Base settings</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <IconButton
                                                                label={`Archive ${base.name}`}
                                                                icon={Archive}
                                                                variant="ghost"
                                                                size="sm"
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Archive base</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>
            </div>
        </TooltipProvider>
    );
}
