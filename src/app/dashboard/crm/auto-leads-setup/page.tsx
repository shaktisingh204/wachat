

export const dynamic = 'force-dynamic';

import { getAutoLeadRules, saveAutoLeadRule, deleteAutoLeadRule } from '@/app/actions/crm-auto-leads.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles, Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default async function AutoLeadsSetupPage() {
    const rules = await getAutoLeadRules();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <Sparkles className="h-8 w-8 text-primary" />
                        Auto-Leads Setup
                    </h1>
                    <p className="text-muted-foreground">Automatically create leads from incoming messages based on keywords.</p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add New Rule</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form action={saveAutoLeadRule as any}>
                            <DialogHeader>
                                <DialogTitle>Create Auto-Lead Rule</DialogTitle>
                                <DialogDescription>Define when to automatically create a lead.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Rule Name</Label>
                                    <Input name="name" placeholder="e.g. Pricing Enquiry" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Source Channel</Label>
                                    <Select name="source" defaultValue="Email">
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Email">Email</SelectItem>
                                            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                            <SelectItem value="SMS">SMS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Contains Keyword</Label>
                                    <Input name="keyword" placeholder="e.g. price, quote, cost" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Assign Lead Source</Label>
                                    <Input name="leadSource" placeholder="e.g. Auto-Email" defaultValue="Auto-Generated" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">Save Rule</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Rules</CardTitle>
                    <CardDescription>Incoming messages matching these rules will trigger lead creation.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Rule Name</TableHead>
                                    <TableHead>Channel</TableHead>
                                    <TableHead>Keyword</TableHead>
                                    <TableHead>Target Source</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No rules configured. Add a rule to start automating lead generation.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rules.map((rule) => (
                                        <TableRow key={rule._id.toString()}>
                                            <TableCell className="font-medium">{rule.name}</TableCell>
                                            <TableCell>{rule.source}</TableCell>
                                            <TableCell>
                                                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                                                    {rule.keyword}
                                                </code>
                                            </TableCell>
                                            <TableCell>{rule.leadSource}</TableCell>
                                            <TableCell>
                                                <form action={async () => {
                                                    'use server';
                                                    await deleteAutoLeadRule(rule._id.toString());
                                                }}>
                                                    <Button variant="ghost" size="icon" className="hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </form>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
