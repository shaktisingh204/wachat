
'use client';

import { useState, useEffect, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoaderCircle, FileText, Plus, Save, Trash2, Edit } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { getDltTemplates, saveDltTemplate, deleteDltTemplate } from '@/app/actions/sms.actions';
import type { WithId, DltSmsTemplate } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const saveInitialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Template
    </Button>
  );
}

function DeleteTemplateButton({ template, onDeleted }: { template: WithId<DltSmsTemplate>, onDeleted: () => void }) {
    const { activeProjectId } = useProject();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        if (!activeProjectId) return;
        startTransition(async () => {
            const result = await deleteDltTemplate(activeProjectId, template._id.toString());
            if(result.success) {
                toast({ title: 'Success', description: 'Template deleted.' });
                onDeleted();
            } else {
                 toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                    <AlertDialogDescription>This will delete the template "{template.name}". This does not affect your DLT portal.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function DltTemplateManagementPage() {
  const { activeProjectId, activeProject } = useProject();
  const [templates, setTemplates] = useState<WithId<DltSmsTemplate>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [state, formAction] = useActionState(saveDltTemplate, saveInitialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const fetchData = () => {
    if (activeProjectId) {
      startLoadingTransition(async () => {
        const data = await getDltTemplates(activeProjectId);
        setTemplates(data);
      });
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      fetchData();
      formRef.current?.reset();
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, fetchData]);
  
  if (!activeProjectId) {
    return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Project Selected</AlertTitle>
            <AlertDescription>Please select a project to manage DLT settings.</AlertDescription>
        </Alert>
    );
  }

  const getStatusVariant = (status?: string) => {
    if (!status) return 'outline';
    const s = status.toLowerCase();
    if (s === 'approved') return 'default';
    if (s === 'pending') return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-8">
      <Tabs defaultValue="manage">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manage">Your Templates</TabsTrigger>
          <TabsTrigger value="create">Create New Template</TabsTrigger>
        </TabsList>
        <TabsContent value="manage" className="mt-6">
           <Card>
                <CardHeader>
                    <CardTitle>DLT Message Templates</CardTitle>
                    <CardDescription>A list of your registered SMS templates.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>DLT Template ID</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Content</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center"><LoaderCircle className="mx-auto animate-spin"/></TableCell></TableRow>
                            ) : templates.length > 0 ? (
                                templates.map(template => (
                                    <TableRow key={template._id.toString()}>
                                        <TableCell className="font-medium">{template.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{template.dltTemplateId}</TableCell>
                                        <TableCell>{template.type}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-sm truncate">{template.content}</TableCell>
                                        <TableCell><Badge variant={getStatusVariant(template.status)}>{template.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" disabled><Edit className="h-4 w-4"/></Button>
                                            <DeleteTemplateButton template={template} onDeleted={fetchData} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center">No DLT templates added yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="create" className="mt-6">
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="projectId" value={activeProjectId} />
                 <Card>
                    <CardHeader>
                        <CardTitle>Add New DLT Template</CardTitle>
                        <CardDescription>Add a template that has already been approved on your DLT portal.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="name">Template Name</Label><Input id="name" name="name" placeholder="e.g. OTP Message" required /></div>
                            <div className="space-y-2"><Label htmlFor="dltTemplateId">DLT Template ID</Label><Input id="dltTemplateId" name="dltTemplateId" placeholder="123..." required /></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="type">Template Type</Label><Select name="type" required><SelectTrigger id="type"><SelectValue placeholder="Select type..."/></SelectTrigger><SelectContent><SelectItem value="Promotional">Promotional</SelectItem><SelectItem value="Transactional">Transactional</SelectItem><SelectItem value="Service">Service</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label htmlFor="variables">Variables (comma-separated)</Label><Input id="variables" name="variables" placeholder="name, otp_code"/></div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="content">Template Content</Label>
                            <Textarea id="content" name="content" required className="min-h-32 font-mono" placeholder="Your OTP is {#var#}. Do not share this with anyone." />
                            <p className="text-xs text-muted-foreground">Use the exact format from your DLT portal, including variable placeholders like {'{#var#}'}.</p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

