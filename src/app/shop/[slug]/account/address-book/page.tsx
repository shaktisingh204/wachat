
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";

const mockAddresses = [
    { id: 1, name: 'John Doe', street: '123 Main St', city: 'Anytown', state: 'CA', zip: '12345', country: 'USA', isDefaultShipping: true, isDefaultBilling: true },
    { id: 2, name: 'John Doe', street: '456 Work Ave', city: 'Businessville', state: 'NY', zip: '54321', country: 'USA', isDefaultShipping: false, isDefaultBilling: false },
]

export default function AddressBookPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h1 className="text-2xl font-bold">Address Book</h1>
                 <Button><Plus className="mr-2 h-4 w-4"/>Add New Address</Button>
            </div>
           
            <Card>
                <CardHeader>
                    <CardTitle>Default Addresses</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold mb-2">Default Billing Address</h3>
                        <address className="not-italic text-sm text-muted-foreground">
                            {mockAddresses[0].name}<br/>
                            {mockAddresses[0].street}<br/>
                            {mockAddresses[0].city}, {mockAddresses[0].state} {mockAddresses[0].zip}<br/>
                            {mockAddresses[0].country}
                        </address>
                        <Button variant="link" className="p-0 h-auto mt-2">Change Billing Address</Button>
                    </div>
                     <div>
                        <h3 className="font-semibold mb-2">Default Shipping Address</h3>
                        <address className="not-italic text-sm text-muted-foreground">
                            {mockAddresses[0].name}<br/>
                            {mockAddresses[0].street}<br/>
                            {mockAddresses[0].city}, {mockAddresses[0].state} {mockAddresses[0].zip}<br/>
                            {mockAddresses[0].country}
                        </address>
                        <Button variant="link" className="p-0 h-auto mt-2">Change Shipping Address</Button>
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Additional Address Entries</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    {mockAddresses.map(address => (
                        <div key={address.id} className="border p-4 rounded-lg">
                             <address className="not-italic text-sm text-muted-foreground">
                                {address.name}<br/>
                                {address.street}<br/>
                                {address.city}, {address.state} {address.zip}<br/>
                                {address.country}
                            </address>
                            <div className="mt-4">
                                <Button variant="link" className="p-0 h-auto">Edit Address</Button>
                                 <span className="mx-2">|</span>
                                <Button variant="link" className="p-0 h-auto text-destructive">Delete Address</Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
