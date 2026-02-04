
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createDltTemplate, getDltTemplates, deleteDltTemplate } from "@/app/actions/sms-template.actions";
import { PlusCircle, Trash2 } from "lucide-react";

export default async function DltTemplatesPage() {
    const templates = await getDltTemplates();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">DLT Templates</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage your TRAI-approved DLT templates. These are required to send SMS in India.
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <form action={createDltTemplate}>
                            <DialogHeader>
                                <DialogTitle>Add DLT Template</DialogTitle>
                                <DialogDescription>
                                    Enter the details exactly as approved in your DLT portal.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">Name</Label>
                                    <Input id="name" name="name" placeholder="OTP Template" className="col-span-3" required />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="dltTemplateId" className="text-right">DLT ID</Label>
                                    <Input id="dltTemplateId" name="dltTemplateId" placeholder="1007..." className="col-span-3" required />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="headerId" className="text-right">Header</Label>
                                    <Input id="headerId" name="headerId" placeholder="WACHAT" maxLength={6} className="col-span-3" required />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="type" className="text-right">Type</Label>
                                    <select id="type" name="type" className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                                        <option value="Transactional">Transactional</option>
                                        <option value="Service">Service</option>
                                        <option value="Promotional">Promotional</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="content" className="text-right">Content</Label>
                                    <Textarea id="content" name="content" placeholder="Your OTP is {#var#}. Valid for 10 mins." className="col-span-3" required />
                                </div>
                                <p className="text-xs text-muted-foreground col-span-4 text-center">
                                    Use <code>{'{#var#}'}</code> for variables.
                                </p>
                            </div>
                            <DialogFooter>
                                <Button type="submit">Save Template</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>DLT ID</TableHead>
                                <TableHead>Header</TableHead>
                                <TableHead>Content</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No templates found. Add one to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                            {templates.map((template: any) => (
                                <TableRow key={template._id}>
                                    <TableCell className="font-medium">{template.name}</TableCell>
                                    <TableCell>{template.dltTemplateId}</TableCell>
                                    <TableCell>{template.headerId}</TableCell>
                                    <TableCell className="max-w-[300px] truncate" title={template.content}>{template.content}</TableCell>
                                    <TableCell>
                                        <form action={async () => {
                                            'use server';
                                            await deleteDltTemplate(template._id);
                                        }}>
                                            <Button variant="ghost" size="icon" type="submit">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </form>
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
