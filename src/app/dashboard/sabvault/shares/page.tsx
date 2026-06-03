"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Share2, Eye, Clock } from "lucide-react";

export default function SabVaultSharesPage() {
    const shares = [
        { id: "1", secretName: "Staging API Key", sharedWith: "john@example.com", expiresAt: "2026-06-10", views: 2, maxViews: 5, status: "Active" },
        { id: "2", secretName: "Vendor Portal Login", sharedWith: "vendor-team@external.com", expiresAt: "2026-06-04", views: 1, maxViews: 1, status: "Expiring Soon" },
        { id: "3", secretName: "AWS Root Credentials", sharedWith: "devops-lead@company.com", expiresAt: "2026-06-01", views: 3, maxViews: 3, status: "Expired" },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Shared Secrets</h1>
                    <p className="text-muted-foreground">Monitor and manage secrets shared securely with team members and externals.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Share
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Shares</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Secret Name</TableHead>
                                <TableHead>Shared With</TableHead>
                                <TableHead>Expires</TableHead>
                                <TableHead>Views</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {shares.map((share) => (
                                <TableRow key={share.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <Share2 className="h-4 w-4 text-muted-foreground" />
                                            <span>{share.secretName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{share.sharedWith}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        <div className="flex items-center space-x-1">
                                            <Clock className="h-3 w-3" />
                                            <span>{share.expiresAt}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {share.views} / {share.maxViews}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={share.status === "Active" ? "default" : share.status === "Expiring Soon" ? "destructive" : "secondary"}>
                                            {share.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" title="Revoke Access">
                                            <Eye className="h-4 w-4" />
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
