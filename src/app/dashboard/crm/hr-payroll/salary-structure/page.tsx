
'use client';

import { useState, useEffect, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoaderCircle, Plus, Trash2, Edit, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSalaryStructures, saveSalaryStructure, deleteSalaryStructure } from '@/app/actions/crm-payroll.actions';
import type { WithId, CrmSalaryStructure } from '@/lib/definitions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const saveInitialState = { success: false, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
            {isEditing ? 'Save Structure' : 'Create Structure'}
        </Button>
    )
}

function StructureFormDialog({ isOpen, onOpenChange, onSave, structure }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onSave: () => void, structure?: WithId<CrmSalaryStructure> | null }) {
    const [state, formAction] = useActionState(saveSalaryStructure, saveInitialState);
    const { toast } = useToast();
    const isEditing = !!structure;

    const [components, setComponents] = useState(structure?.components || []);

    useEffect(() => {
        if(isOpen) setComponents(structure?.components || []);
    }, [isOpen, structure]);

    useEffect(() => {
        if (state.success) {
            toast({ title: 'Success', description: 'Salary structure saved.' });
            onSave();
            onOpenChange(false);
        }
        if(state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSave, onOpenChange]);

    const handleComponentChange = (index: number, field: string, value: string | number) => {
        const newComponents = [...components];
        newComponents[index] = { ...newComponents[index], [field]: value };
        setComponents(newComponents);
    }
    const addComponent = (type: 'earning' | 'deduction') => setComponents([...components, { name: '', type, calculationType: 'fixed', value: 0 }]);
    const removeComponent = (index: number) => setComponents(components.filter((_, i) => i !== index));

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                 <form action={formAction}>
                    <input type="hidden" name="id" value={structure?._id.toString()} />
                    <input type="hidden" name="components" value={JSON.stringify(components)} />
                    <DialogHeader><DialogTitle>{isEditing ? 'Edit' : 'Create'} Salary Structure</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                        <div className="space-y-2"><Label>Structure Name</Label><Input name="name" defaultValue={structure?.name} required /></div>
                        <div className="space-y-2"><Label>Description</Label><Input name="description" defaultValue={structure?.description} /></div>
                        <div className="space-y-4">
                            <div><h4 className="font-semibold">Earnings</h4>
                            {components.filter(c => c.type === 'earning').map((comp, i) => (
                                <div key={i} className="flex gap-2 items-end p-2 border rounded-md">
                                    <Input placeholder="E.g., Basic Pay" value={comp.name} onChange={e => handleComponentChange(i, 'name', e.target.value)} />
                                    <RadioGroup defaultValue="fixed" className="flex gap-2"><RadioGroupItem value="fixed" /><Label className="text-xs">Fixed</Label><RadioGroupItem value="percentage" /><Label className="text-xs">%</Label></RadioGroup>
                                    <Input type="number" value={comp.value} onChange={e => handleComponentChange(i, 'value', Number(e.target.value))} />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeComponent(i)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                            <Button type="button" size="sm" variant="outline" onClick={() => addComponent('earning')}><Plus className="mr-2 h-4 w-4"/>Add Earning</Button>
                            </div>
                            <div><h4 className="font-semibold">Deductions</h4>
                            {components.filter(c => c.type === 'deduction').map((comp, i) => (
                                <div key={i} className="flex gap-2 items-end p-2 border rounded-md">
                                    <Input placeholder="E.g., Prof. Tax" value={comp.name} onChange={e => handleComponentChange(i, 'name', e.target.value)} />
                                    <RadioGroup defaultValue="fixed" className="flex gap-2"><RadioGroupItem value="fixed" /><Label className="text-xs">Fixed</Label><RadioGroupItem value="percentage" /><Label className="text-xs">%</Label></RadioGroup>
                                    <Input type="number" value={comp.value} onChange={e => handleComponentChange(i, 'value', Number(e.target.value))} />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeComponent(i)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                             <Button type="button" size="sm" variant="outline" onClick={() => addComponent('deduction')}><Plus className="mr-2 h-4 w-4"/>Add Deduction</Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><SubmitButton isEditing={isEditing} /></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function SalaryStructurePage() {
    const [structures, setStructures] = useState<WithId<CrmSalaryStructure>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<WithId<CrmSalaryStructure> | null>(null);
    const { toast } = useToast();

    const fetchData = () => {
        startLoading(async () => {
            const data = await getSalaryStructures();
            setStructures(data);
        });
    };

    useEffect(() => { fetchData(); }, []);

    const handleEdit = (structure: WithId<CrmSalaryStructure>) => {
        setEditingStructure(structure);
        setIsFormOpen(true);
    }
    
    const handleDelete = async (id: string) => {
        const result = await deleteSalaryStructure(id);
        if (result.success) {
            toast({ title: 'Success', description: 'Structure deleted.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };
    
    return (
        <>
            <StructureFormDialog isOpen={isFormOpen} onOpenChange={setIsFormOpen} onSave={fetchData} structure={editingStructure}/>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Salary Structures</h1>
                        <p className="text-muted-foreground">Define salary templates for different employee roles or grades.</p>
                    </div>
                    <Button onClick={() => handleEdit(null)}><Plus className="mr-2 h-4 w-4"/>Create New Structure</Button>
                </div>
                <Card>
                    <CardHeader><CardTitle>Your Structures</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={3} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                ) : structures.length > 0 ? (
                                    structures.map(s => (
                                        <TableRow key={s._id.toString()}>
                                            <TableCell className="font-medium">{s.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{s.description}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Edit className="h-4 w-4"/></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Delete Structure?</AlertDialogTitle><AlertDialogDescription>This will delete the "{s.name}" structure. It won't affect past payrolls.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(s._id.toString())}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={3} className="h-24 text-center">No salary structures created yet.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
