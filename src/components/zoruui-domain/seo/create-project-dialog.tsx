'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  zoruToast as toast,
} from '@/components/zoruui';
import {
  useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/zoruui';

import { Plus } from 'lucide-react';
import { createSeoProject } from '@/app/actions/seo.actions';

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
            <ZoruDialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add Project
                </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-[425px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Add SEO Project</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Start tracking a website's SEO performance.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
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
                        <ZoruDialogFooter>
                            <Button type="submit">Create Project</Button>
                        </ZoruDialogFooter>
                    </form>
                </Form>
            </ZoruDialogContent>
        </Dialog>
    );
}
