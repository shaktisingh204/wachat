"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function SabSprintsVelocityPage() {
    const stats = [
        { label: "Average Velocity", value: "48", trend: "up", change: "+12%" },
        { label: "Completed Points (Last Sprint)", value: "52", trend: "up", change: "+4" },
        { label: "Spillover Rate", value: "15%", trend: "down", change: "-3%" },
        { label: "Predictability", value: "92%", trend: "neutral", change: "0%" },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Velocity Insights</h1>
                    <p className="text-muted-foreground">Track team performance and predictability over time.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.label}
                            </CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center">
                                {stat.trend === "up" && <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" />}
                                {stat.trend === "down" && <TrendingDown className="h-3 w-3 mr-1 text-rose-500" />}
                                {stat.trend === "neutral" && <Minus className="h-3 w-3 mr-1 text-zinc-500" />}
                                <span className={
                                    stat.trend === "up" ? "text-emerald-500" : 
                                    stat.trend === "down" ? "text-rose-500" : "text-zinc-500"
                                }>{stat.change}</span>
                                <span className="ml-1">from last month</span>
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Velocity Chart Placeholder</CardTitle>
                    <CardDescription>Visual representation of completed vs committed points.</CardDescription>
                </CardHeader>
                <CardContent className="h-80 flex items-center justify-center bg-muted/20 border border-dashed rounded-md mx-6 mb-6">
                    <p className="text-muted-foreground">Chart Component Will Render Here</p>
                </CardContent>
            </Card>
        </div>
    );
}
