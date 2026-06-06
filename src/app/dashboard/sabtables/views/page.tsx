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
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Badge,
    StatCard,
    EmptyState,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    type BadgeTone,
} from "@/components/sabcrm/20ui";
import {
    Layers,
    Plus,
    Settings,
    Pencil,
    LayoutGrid,
    Columns3,
    Calendar,
    Table2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ViewType = "Grid" | "Kanban" | "Calendar";

interface SavedView {
    id: string;
    name: string;
    table: string;
    type: ViewType;
    base: string;
}

const VIEW_META: Record<ViewType, { icon: LucideIcon; tone: BadgeTone }> = {
    Grid: { icon: LayoutGrid, tone: "info" },
    Kanban: { icon: Columns3, tone: "accent" },
    Calendar: { icon: Calendar, tone: "success" },
};

export default function SabTablesViewsPage() {
    const views: SavedView[] = [
        { id: "1", name: "All Customers", table: "Contacts", type: "Grid", base: "Customer CRM" },
        { id: "2", name: "Q3 Sales Pipeline", table: "Deals", type: "Kanban", base: "Customer CRM" },
        { id: "3", name: "Low Stock Alerts", table: "Products", type: "Grid", base: "Inventory Tracker" },
        { id: "4", name: "Event Calendar", table: "Schedule", type: "Calendar", base: "Event Planning" },
    ];

    const baseCount = new Set(views.map((v) => v.base)).size;
    const gridCount = views.filter((v) => v.type === "Grid").length;

    return (
        <TooltipProvider>
            <div className="ui20 p-6 space-y-6">
                <PageHeader>
                    <PageHeaderHeading>
                        <PageTitle>Views</PageTitle>
                        <PageDescription>
                            Manage saved views for your database tables.
                        </PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <Button variant="primary" iconLeft={Plus}>
                            Create View
                        </Button>
                    </PageActions>
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard label="Saved views" value={views.length} icon={Layers} />
                    <StatCard label="Bases" value={baseCount} icon={Table2} />
                    <StatCard label="Grid views" value={gridCount} icon={LayoutGrid} />
                </div>

                <Card padding="none">
                    <CardHeader className="px-5 pt-5">
                        <CardTitle>Saved Views</CardTitle>
                        <CardDescription>
                            Every view configured across your bases and tables.
                        </CardDescription>
                    </CardHeader>
                    <CardBody className="px-0 pb-0">
                        {views.length === 0 ? (
                            <div className="px-5 py-6">
                                <EmptyState
                                    icon={Layers}
                                    title="No views yet"
                                    description="Create a Grid, Kanban, or Calendar view to start organizing your table records."
                                    action={
                                        <Button variant="primary" iconLeft={Plus}>
                                            Create View
                                        </Button>
                                    }
                                />
                            </div>
                        ) : (
                            <Table hover>
                                <THead>
                                    <Tr>
                                        <Th>View Name</Th>
                                        <Th>Table</Th>
                                        <Th>Type</Th>
                                        <Th>Base</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {views.map((view) => {
                                        const meta = VIEW_META[view.type];
                                        const TypeIcon = meta.icon;
                                        return (
                                            <Tr key={view.id}>
                                                <Td>
                                                    <span className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                                                        <Layers
                                                            className="h-4 w-4 text-[var(--st-text-tertiary)]"
                                                            aria-hidden="true"
                                                        />
                                                        {view.name}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        {view.table}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    <Badge tone={meta.tone} kind="soft">
                                                        <TypeIcon
                                                            className="h-3 w-3"
                                                            aria-hidden="true"
                                                        />
                                                        {view.type}
                                                    </Badge>
                                                </Td>
                                                <Td>
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        {view.base}
                                                    </span>
                                                </Td>
                                                <Td align="right">
                                                    <span className="inline-flex items-center justify-end gap-1">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <IconButton
                                                                    label={`Edit ${view.name}`}
                                                                    icon={Pencil}
                                                                    size="sm"
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>Edit view</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <IconButton
                                                                    label={`Settings for ${view.name}`}
                                                                    icon={Settings}
                                                                    size="sm"
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>View settings</TooltipContent>
                                                        </Tooltip>
                                                    </span>
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
