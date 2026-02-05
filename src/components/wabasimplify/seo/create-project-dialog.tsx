'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { createSeoProject } from '@/app/actions/seo.actions';
import { toast } from '@/hooks/use-toast';

const formSchema = z.object({
    domain: z.string().min(1, 'Domain is required').regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/, "Invalid domain format (e.g., example.com)"),
    competitors: z.string().optional(), // Comma separated
});

export function CreateSeoProjectDialog() {
    const [open, setOpen] = useState(false);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            domain: '',
            competitors: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        const competitors = values.competitors
            ? values.competitors.split(',').map(c => c.trim()).filter(c => c.length > 0)
            : [];

        const result = await createSeoProject(values.domain, competitors);

        if (result.success) {
            toast({ title: 'Success', description: 'Project created successfully' });
            setOpen(false);
            form.reset();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add Project
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add SEO Project</DialogTitle>
                    <DialogDescription>
                        Start tracking a website's SEO performance.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="domain"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Domain</FormLabel>
                                    <FormControl>
                                        <Input placeholder="example.com" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Enter the root domain (without https://)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="competitors"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Competitors (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="comp1.com, comp2.com" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Comma-separated list of competitor domains.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit">Create Project</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
