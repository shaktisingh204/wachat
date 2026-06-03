"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Layers } from "lucide-react";

export default function SabSprintsEpicsPage() {
    const epics = [
        { id: "1", name: "Authentication Overhaul", status: "In Progress", progress: 65, tasks: 24 },
        { id: "2", name: "Billing V2 Integration", status: "Planned", progress: 0, tasks: 12 },
        { id: "3", name: "Performance Optimization", status: "In Progress", progress: 30, tasks: 18 },
        { id: "4", name: "Mobile App MVP", status: "Completed", progress: 100, tasks: 45 },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Epics</h1>
                    <p className="text-muted-foreground">High-level initiatives and major feature sets.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Epic
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {epics.map((epic) => (
                    <Card key={epic.id}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-2">
                                    <Layers className="h-5 w-5 text-primary" />
                                    <CardTitle>{epic.name}</CardTitle>
                                </div>
                            </div>
                            <CardDescription className="mt-2 flex justify-between">
                                <span>{epic.status}</span>
                                <span>{epic.tasks} Tasks</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Progress</span>
                                    <span className="font-medium">{epic.progress}%</span>
                                </div>
                                <Progress value={epic.progress} className="h-2" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
