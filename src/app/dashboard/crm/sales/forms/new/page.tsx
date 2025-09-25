
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Code, CheckCircle, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

export default function NewCrmFormPage() {
    return (
        <div className="flex flex-col h-full">
            <header className="flex-shrink-0 flex items-center justify-between gap-4 p-4 border-b bg-background">
                <div>
                     <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link href="/dashboard/crm">Dashboard</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link href="/dashboard/crm/sales/forms">All Forms</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Create Form</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                     <h1 className="text-2xl font-bold font-headline mt-2 flex items-center gap-2">
                        <Link href="/dashboard/crm/sales/forms" className="p-1 rounded-md hover:bg-muted">
                           <ArrowLeft className="h-5 w-5" />
                        </Link>
                        Create Form
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                    </Button>
                    <Button>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Publish Form
                    </Button>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-y-auto">
                {/* Form Builder Canvas */}
                <div className="lg:col-span-2">
                    <Card className="h-full min-h-[500px]">
                        <CardHeader>
                            <CardTitle>Form Builder</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full h-96 bg-muted rounded-md border-2 border-dashed flex items-center justify-center">
                                <p className="text-muted-foreground">Form builder canvas will be here.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Get Shareable Code</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                To embed this form, copy and paste the code below into the HTML code on your website.
                            </p>
                             <Button variant="outline" className="w-full">
                                <Code className="mr-2 h-4 w-4" />
                                Get Code
                            </Button>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Form Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="w-full h-80 bg-muted rounded-md border flex items-center justify-center">
                                <p className="text-muted-foreground">Live form preview.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
