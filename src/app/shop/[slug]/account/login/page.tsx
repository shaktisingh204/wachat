
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ShopLoginPage() {
    const params = useParams();

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Login or Create Account</h1>
            <Card>
                <div className="grid md:grid-cols-2 gap-8 p-6">
                    {/* Login Form */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Registered Customers</h3>
                        <p className="text-sm text-muted-foreground">If you have an account, sign in with your email address.</p>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="you@example.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" />
                        </div>
                        <div className="flex items-center justify-between">
                            <Button>Sign In</Button>
                            <Button variant="link" asChild><Link href="#">Forgot Your Password?</Link></Button>
                        </div>
                    </div>

                    {/* New Customer */}
                     <div className="space-y-4 border-t md:border-t-0 md:border-l md:pl-8 pt-8 md:pt-0">
                        <h3 className="text-lg font-semibold">New Customers</h3>
                        <p className="text-sm text-muted-foreground">Creating an account has many benefits: check out faster, keep more than one address, track orders and more.</p>
                        <Button variant="outline" asChild>
                            <Link href={`/shop/${params.slug}/account/register`}>Create an Account</Link>
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
