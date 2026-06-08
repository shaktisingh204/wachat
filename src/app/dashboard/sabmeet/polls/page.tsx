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
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Separator,
    TooltipProvider,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    type BadgeTone,
} from "@/components/sabcrm/20ui";
import { BarChart3, Plus, Eye, Vote, Radio, ListChecks } from "lucide-react";

interface Poll {
    id: string;
    question: string;
    room: string;
    status: "Active" | "Closed";
    votes: number;
}

const STATUS_TONE: Record<Poll["status"], BadgeTone> = {
    Active: "success",
    Closed: "neutral",
};

export default function SabMeetPollsPage() {
    const polls: Poll[] = [
        { id: "1", question: "What should we order for the team lunch sync?", room: "Team Lunch Sync", status: "Closed", votes: 12 },
        { id: "2", question: "Which features should we prioritize for Q4?", room: "Product Planning", status: "Active", votes: 8 },
        { id: "3", question: "Preferred sync time for next week?", room: "Design Review", status: "Closed", votes: 5 },
    ];

    const totalPolls = polls.length;
    const activePolls = polls.filter((p) => p.status === "Active").length;
    const totalVotes = polls.reduce((sum, p) => sum + p.votes, 0);

    return (
        <main className="space-y-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabMeet</PageEyebrow>
                    <PageTitle>Meeting polls</PageTitle>
                    <PageDescription>Manage interactive polls across your meeting rooms.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" iconLeft={Plus}>
                        Create poll
                    </Button>
                </PageActions>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Total polls" value={totalPolls} icon={ListChecks} accent="#6366f1" />
                <StatCard label="Active polls" value={activePolls} icon={Radio} accent="#16a34a" />
                <StatCard label="Total votes" value={totalVotes} icon={Vote} accent="#0ea5e9" />
            </div>

            <Card padding="none">
                <CardHeader className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                    <div>
                        <CardTitle>All polls</CardTitle>
                        <CardDescription>Every poll created across your rooms, with live vote counts.</CardDescription>
                    </div>
                </CardHeader>
                <Separator />
                <CardBody>
                    {polls.length === 0 ? (
                        <EmptyState
                            icon={BarChart3}
                            title="No polls yet"
                            description="Create your first poll to gather votes from participants during a meeting."
                            action={
                                <Button variant="primary" iconLeft={Plus}>
                                    Create poll
                                </Button>
                            }
                        />
                    ) : (
                        <TooltipProvider>
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Question</Th>
                                        <Th>Room</Th>
                                        <Th>Status</Th>
                                        <Th align="right">Votes</Th>
                                        <Th align="right">Actions</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {polls.map((poll) => (
                                        <Tr key={poll.id}>
                                            <Td>
                                                <div className="flex items-center gap-2">
                                                    <BarChart3
                                                        className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)]"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="font-medium text-[var(--st-text)]">{poll.question}</span>
                                                </div>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">{poll.room}</span>
                                            </Td>
                                            <Td>
                                                <Badge tone={STATUS_TONE[poll.status]} dot={poll.status === "Active"}>
                                                    {poll.status}
                                                </Badge>
                                            </Td>
                                            <Td align="right">
                                                <span className="tabular-nums text-[var(--st-text)]">{poll.votes}</span>
                                            </Td>
                                            <Td align="right">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <IconButton
                                                            label={`View results for "${poll.question}"`}
                                                            icon={Eye}
                                                            size="sm"
                                                        />
                                                    </TooltipTrigger>
                                                    <TooltipContent>View results</TooltipContent>
                                                </Tooltip>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        </TooltipProvider>
                    )}
                </CardBody>
            </Card>
        </main>
    );
}
