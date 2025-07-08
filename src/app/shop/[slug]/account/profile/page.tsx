
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Edit Account Information</h1>
            <Card>
                 <form>
                    <CardHeader>
                        <CardTitle>Account Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstname">First Name</Label>
                                <Input id="firstname" defaultValue="John" />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="lastname">Last Name</Label>
                                <Input id="lastname" defaultValue="Doe" />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" defaultValue="john.doe@example.com" disabled />
                        </div>
                    </CardContent>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-4">
                         <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="current-password">Current Password</Label>
                                <Input id="current-password" type="password" />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <Input id="new-password" type="password" />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <Input id="confirm-password" type="password" />
                            </div>
                        </div>
                     </CardContent>
                     <CardContent>
                        <Button>Save Account</Button>
                     </CardContent>
                 </form>
            </Card>
        </div>
    );
}
