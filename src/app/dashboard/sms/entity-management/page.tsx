
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, Briefcase, ChevronRight, AlertCircle } from "lucide-react";
import { useProject } from "@/context/project-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function EntityManagementPage() {
    const { activeProject } = useProject();
    
    // For now, we'll just display the first connected DLT account.
    // A more advanced version might have a selector if multiple DLT accounts are connected.
    const dltAccount = activeProject?.smsProviderSettings?.dlt?.[0];

    if (!activeProject) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage DLT settings.</AlertDescription>
            </Alert>
        );
    }
    
    if (!dltAccount) {
         return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No DLT Account Connected</AlertTitle>
                <AlertDescription>Please connect a DLT account in the "Connect DLT" tab first.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Principal Entity (PE) Details</CardTitle>
                    <CardDescription>
                        This information is synced from the DLT portal.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Entity Name</Label>
                        <p className="font-semibold">{dltAccount.entityName || 'Not Synced'}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Principal Entity ID</Label>
                        <p className="font-mono">{dltAccount.principalEntityId}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Badge variant={dltAccount.status === 'Active' ? 'default' : 'secondary'}>{dltAccount.status || 'Unknown'}</Badge>
                    </div>
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Briefcase />PE-TM Binding</CardTitle>
                        <CardDescription>Manage your Telemarketer bindings. Your Telemarketer ID with us is: <span className="font-mono bg-muted p-1 rounded-md">1202159134586925838</span></CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Log in to your DLT portal and add our Telemarketer ID to authorize us to send SMS on your behalf.</p>
                    </CardContent>
                    <CardFooter>
                         <Button variant="outline" asChild>
                            <a href="https://www.airtel.in/business/commercial-communication" target="_blank" rel="noopener noreferrer">Go to DLT Portal <ChevronRight className="ml-2 h-4 w-4"/></a>
                         </Button>
                    </CardFooter>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText />KYC Documents</CardTitle>
                        <CardDescription>Upload and manage your KYC documents for DLT verification.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="pan-doc">PAN Card</Label>
                            <Input id="pan-doc" type="file" disabled/>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="gst-doc">GST Certificate</Label>
                            <Input id="gst-doc" type="file" disabled/>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button disabled>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Upload Documents (Coming Soon)
                         </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
