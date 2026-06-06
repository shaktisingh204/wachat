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
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Tooltip,
    TooltipProvider,
    TooltipTrigger,
    TooltipContent,
} from "@/components/sabcrm/20ui";
import { Download, PlayCircle, Trash2, Video, HardDrive, Clock, RefreshCw } from "lucide-react";

interface Recording {
    id: string;
    name: string;
    date: string;
    duration: string;
    size: string;
    room: string;
}

export default function SabMeetRecordingsPage() {
    const recordings: Recording[] = [
        { id: "1", name: "Daily Standup - Oct 12", date: "2023-10-12", duration: "45m", size: "320 MB", room: "Daily Standup" },
        { id: "2", name: "Client Sync - Northwind Logistics", date: "2023-10-11", duration: "1h 15m", size: "850 MB", room: "Client Sync" },
        { id: "3", name: "Design Review - Q4", date: "2023-10-10", duration: "30m", size: "210 MB", room: "Design Review" },
    ];

    const totalCount = recordings.length;
    const totalStorage = "1.4 GB";
    const totalDuration = "2h 30m";

    return (
        <div className="ui20 p-6 space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Recordings</PageTitle>
                    <PageDescription>View, play, and download your saved meeting recordings.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="secondary" iconLeft={RefreshCw}>
                        Refresh
                    </Button>
                </PageActions>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Total recordings" value={totalCount} icon={Video} accent="#6366f1" />
                <StatCard label="Storage used" value={totalStorage} icon={HardDrive} accent="#0ea5e9" />
                <StatCard label="Total runtime" value={totalDuration} icon={Clock} accent="#f59e0b" />
            </div>

            <Card padding="none">
                <CardHeader>
                    <CardTitle>Recent recordings</CardTitle>
                    <CardDescription>Recordings are kept for 90 days, then archived automatically.</CardDescription>
                </CardHeader>
                <CardBody>
                    {recordings.length === 0 ? (
                        <EmptyState
                            icon={Video}
                            title="No recordings yet"
                            description="When you record a meeting it will appear here, ready to play or download."
                            action={
                                <Button variant="primary" iconLeft={Video}>
                                    Start a meeting
                                </Button>
                            }
                        />
                    ) : (
                        <TooltipProvider>
                            <Table hover>
                                <THead>
                                    <Tr>
                                        <Th>Recording name</Th>
                                        <Th>Room</Th>
                                        <Th>Date</Th>
                                        <Th>Duration</Th>
                                        <Th>Size</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {recordings.map((rec) => (
                                        <Tr key={rec.id}>
                                            <Td>
                                                <div className="flex items-center gap-2">
                                                    <PlayCircle
                                                        className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)]"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="font-medium text-[var(--st-text)]">{rec.name}</span>
                                                </div>
                                            </Td>
                                            <Td>
                                                <Badge tone="neutral" kind="soft">
                                                    {rec.room}
                                                </Badge>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">{rec.date}</span>
                                            </Td>
                                            <Td>{rec.duration}</Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">{rec.size}</span>
                                            </Td>
                                            <Td align="right">
                                                <div className="inline-flex items-center justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <IconButton
                                                                label={`Download ${rec.name}`}
                                                                icon={Download}
                                                                variant="ghost"
                                                                size="sm"
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Download</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <IconButton
                                                                label={`Delete ${rec.name}`}
                                                                icon={Trash2}
                                                                variant="danger"
                                                                size="sm"
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Delete</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        </TooltipProvider>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
