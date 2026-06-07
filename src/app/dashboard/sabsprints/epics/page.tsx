"use client";

import React from "react";
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    CardFooter,
    StatCard,
    Badge,
    Progress,
    EmptyState,
    type BadgeTone,
    type Ui20ProgressTone,
} from "@/components/sabcrm/20ui";
import { Plus, Layers, CheckCircle2, Loader2, ListTodo } from "lucide-react";

type EpicStatus = "In Progress" | "Planned" | "Completed";

interface Epic {
    id: string;
    name: string;
    status: EpicStatus;
    progress: number;
    tasks: number;
}

const STATUS_BADGE: Record<EpicStatus, BadgeTone> = {
    "In Progress": "accent",
    Planned: "neutral",
    Completed: "success",
};

const PROGRESS_TONE: Record<EpicStatus, Ui20ProgressTone> = {
    "In Progress": "accent",
    Planned: "accent",
    Completed: "success",
};

export default function SabSprintsEpicsPage() {
    const epics: Epic[] = [
        { id: "1", name: "Authentication Overhaul", status: "In Progress", progress: 65, tasks: 24 },
        { id: "2", name: "Billing V2 Integration", status: "Planned", progress: 0, tasks: 12 },
        { id: "3", name: "Performance Optimization", status: "In Progress", progress: 30, tasks: 18 },
        { id: "4", name: "Mobile App MVP", status: "Completed", progress: 100, tasks: 45 },
    ];

    const totalTasks = epics.reduce((sum, e) => sum + e.tasks, 0);
    const inProgressCount = epics.filter((e) => e.status === "In Progress").length;
    const completedCount = epics.filter((e) => e.status === "Completed").length;

    return (
        <div className="ui20 p-6 space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabSprints</PageEyebrow>
                    <PageTitle>Epics</PageTitle>
                    <PageDescription>
                        High-level initiatives and major feature sets that group related sprint work.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" iconLeft={Plus}>
                        New Epic
                    </Button>
                </PageActions>
            </PageHeader>

            {epics.length > 0 ? (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Total epics" value={epics.length} icon={Layers} />
                        <StatCard label="In progress" value={inProgressCount} icon={Loader2} />
                        <StatCard label="Completed" value={completedCount} icon={CheckCircle2} />
                        <StatCard label="Tasks tracked" value={totalTasks} icon={ListTodo} />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {epics.map((epic) => (
                            <Card key={epic.id} variant="interactive">
                                <CardHeader>
                                    <div className="flex items-start gap-2">
                                        <Layers
                                            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--st-accent)]"
                                            aria-hidden="true"
                                        />
                                        <CardTitle>{epic.name}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardBody>
                                    <div className="flex items-center justify-between">
                                        <Badge tone={STATUS_BADGE[epic.status]} dot>
                                            {epic.status}
                                        </Badge>
                                        <span className="text-sm text-[var(--st-text-secondary)]">
                                            {epic.tasks} tasks
                                        </span>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-[var(--st-text-secondary)]">Progress</span>
                                            <span className="font-medium text-[var(--st-text)]">
                                                {epic.progress}%
                                            </span>
                                        </div>
                                        <Progress
                                            value={epic.progress}
                                            tone={PROGRESS_TONE[epic.status]}
                                            size="sm"
                                            aria-label={`${epic.name} progress`}
                                        />
                                    </div>
                                </CardBody>
                                <CardFooter>
                                    <span className="text-xs text-[var(--st-text-tertiary)]">
                                        {epic.progress === 100
                                            ? "All tasks complete"
                                            : `${epic.tasks - Math.round((epic.progress / 100) * epic.tasks)} tasks remaining`}
                                    </span>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </>
            ) : (
                <Card variant="outlined" padding="lg">
                    <EmptyState
                        icon={Layers}
                        title="No epics yet"
                        description="Create your first epic to group related sprint work into a larger initiative."
                        action={
                            <Button variant="primary" iconLeft={Plus}>
                                New Epic
                            </Button>
                        }
                    />
                </Card>
            )}
        </div>
    );
}
