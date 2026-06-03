"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, CheckCircle } from "lucide-react";

export default function SabVaultBreachAlertsPage() {
    const alerts = [
        { id: "1", secretName: "Legacy System Password", source: "HaveIBeenPwned", detectedAt: "2026-06-03 10:15:00", severity: "High", status: "Open" },
        { id: "2", secretName: "Employee Portal User", source: "Dark Web Scan", detectedAt: "2026-06-02 08:30:00", severity: "Critical", status: "Investigating" },
        { id: "3", secretName: "Dev Database URL", source: "GitHub Leaks", detectedAt: "2026-05-20 14:00:00", severity: "Medium", status: "Resolved" },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-destructive flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6" /> Breach Alerts
                    </h1>
                    <p className="text-muted-foreground">Monitor leaked secrets and exposed credentials across public sources.</p>
                </div>
                <Button variant="destructive">
                    Scan Now
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Compromised Secret</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Detected At</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {alerts.map((alert) => (
                                <TableRow key={alert.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <AlertTriangle className={`h-4 w-4 ${alert.severity === "Critical" ? "text-destructive" : "text-amber-500"}`} />
                                            <span>{alert.secretName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{alert.source}</TableCell>
                                    <TableCell className="text-muted-foreground">{alert.detectedAt}</TableCell>
                                    <TableCell>
                                        <Badge variant={alert.severity === "Critical" ? "destructive" : alert.severity === "High" ? "destructive" : "secondary"}>
                                            {alert.severity}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={alert.status === "Resolved" ? "default" : "outline"}>
                                            {alert.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {alert.status !== "Resolved" && (
                                            <Button variant="outline" size="sm" className="mr-2">
                                                <CheckCircle className="mr-2 h-4 w-4" /> Mark Resolved
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm">
                                            Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
