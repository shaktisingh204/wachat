import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import {WithId} from 'mongodb';

export const metadata: Metadata = {
  title: 'Phone Numbers | WABASimplify',
};

type PhoneNumber = {
  number: string;
  status: 'active' | 'pending' | 'rejected';
  registeredOn: string;
};

async function getPhoneNumbers(): Promise<WithId<PhoneNumber>[]> {
    try {
        const { db } = await connectToDatabase();
        const phoneNumbers = await db.collection<PhoneNumber>('phone_numbers').find({}).toArray();
        return phoneNumbers;
    } catch (error) {
        console.error("Failed to fetch phone numbers:", error);
        // In case of an error, return an empty array to prevent the page from crashing.
        return [];
    }
}


export default async function NumbersPage() {
    const phoneNumbers = await getPhoneNumbers();
    
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Phone Number Management</h1>
          <p className="text-muted-foreground">Register and manage your WhatsApp phone numbers.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Register New Number
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Register a New Phone Number</DialogTitle>
              <DialogDescription>
                Enter the phone number you want to register for WhatsApp Business API.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone-number" className="text-right">
                  Phone Number
                </Label>
                <Input id="phone-number" placeholder="+1 555-000-0000" className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Start Verification</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Numbers</CardTitle>
          <CardDescription>A list of your phone numbers and their verification status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phoneNumbers.length > 0 ? (
                phoneNumbers.map((phone) => (
                  <TableRow key={phone._id.toString()}>
                    <TableCell className="font-medium">{phone.number}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          phone.status === 'active'
                            ? 'default'
                            : phone.status === 'pending'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {phone.status.charAt(0).toUpperCase() + phone.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(phone.registeredOn).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Number</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            Delete Number
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No registered phone numbers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
