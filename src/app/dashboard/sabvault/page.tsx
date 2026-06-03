"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Key, Lock, Settings, Copy } from "lucide-react";

export default function SabVaultSecretsPage() {
    const secrets = [
        { id: "1", name: "Production Database URL", environment: "Production", lastModified: "2026-06-01", status: "Active", type: "Database" },
        { id: "2", name: "Staging API Key", environment: "Staging", lastModified: "2026-05-28", status: "Active", type: "API Key" },
        { id: "3", name: "Legacy System Password", environment: "Legacy", lastModified: "2025-12-15", status: "Rotated", type: "Password" },
        { id: "4", name: "AWS Root Credentials", environment: "Production", lastModified: "2026-06-03", status: "Active", type: "Cloud" },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Secrets</h1>
                    <p className="text-muted-foreground">Manage your enterprise secrets, passwords, and API keys securely.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Secret
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Vault Secrets</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Environment</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Last Modified</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {secrets.map((secret) => (
                                <TableRow key={secret.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <Key className="h-4 w-4 text-muted-foreground" />
                                            <span>{secret.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{secret.environment}</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{secret.type}</TableCell>
                                    <TableCell className="text-muted-foreground">{secret.lastModified}</TableCell>
                                    <TableCell>
                                        <Badge variant={secret.status === "Active" ? "default" : "secondary"}>
                                            {secret.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" title="Copy Secret">
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon">
                                            <Settings className="h-4 w-4" />
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
