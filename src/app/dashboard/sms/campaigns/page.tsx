
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Send } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SmsCampaignsPage() {
    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>New SMS Campaign</CardTitle>
                    <CardDescription>Send a message to a list of contacts from a CSV/XLSX file.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea id="message" placeholder="Your SMS content..." className="min-h-32" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="contacts">Contact File</Label>
                        <Input id="contacts" type="file" accept=".csv,.xlsx" />
                        <p className="text-xs text-muted-foreground">The first column must be the phone number.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button><Send className="mr-2 h-4 w-4" />Send Campaign</Button>
                </CardFooter>
            </Card>
            <Card>
                 <CardHeader>
                    <CardTitle>Recent Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-sm text-muted-foreground py-8">No campaigns sent yet.</p>
                </CardContent>
            </Card>
        </div>
    );
}
