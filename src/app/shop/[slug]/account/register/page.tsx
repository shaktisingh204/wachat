
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ShopRegisterPage() {
    const params = useParams();

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Create New Customer Account</h1>
            <Card>
                <form>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstname">First Name</Label>
                                <Input id="firstname" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastname">Last Name</Label>
                                <Input id="lastname" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                <Input id="confirm-password" type="password" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button type="submit">Create Account</Button>
                        <Button variant="link" asChild>
                            <Link href={`/shop/${params.slug}/account/login`}>&larr; Back to Login</Link>
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
