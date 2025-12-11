'use client';

import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { LoginForm } from '@/components/wabasimplify/login-form';
import { Skeleton } from '@/components/ui/skeleton';

function LoginFormSkeleton() {
    return (
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
                <Skeleton className="h-8 w-2/3 mx-auto" />
                <Skeleton className="h-4 w-full mt-2 mx-auto" />
            </CardHeader>
            <CardContent className="space-y-6 p-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full mt-6" />
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
            <CardFooter className="justify-center">
                <Skeleton className="h-4 w-1/2" />
            </CardFooter>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-auth-texture p-4 sm:p-6 lg:p-8">
            <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
                <Link href="/">
                    <SabNodeLogo className="w-24 h-auto" />
                </Link>
            </div>

            <Suspense fallback={<LoginFormSkeleton />}>
                <LoginForm />
            </Suspense>

            <div className="absolute bottom-6 text-center w-full">
                <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SabNode. All Rights Reserved. | <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></p>
            </div>
        </div>
    );
}
