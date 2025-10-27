

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
    Plus,
    Download,
    Search as SearchIcon,
    SlidersHorizontal,
    Trash2,
    CheckSquare,
    MoreVertical,
    Star,
    Mail,
    Phone,
    MessageSquare,
    Eye,
    Link as LinkIcon
} from "lucide-react";
import { useState, useEffect } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { getSession } from "@/app/actions";
import type { User } from "@/lib/definitions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import Link from 'next/link';

const leads = [
    { id: 1, pipeline: 'Sales Pipeline', contactName: "Aisha Ahmed", organisation: 'Acme Inc.', designation: 'Marketing Head', email: "prospect.a@example.com", phone: '+919876543210', contactCountry: 'India', customerCountry: 'India', city: 'Mumbai', state: 'Maharashtra', createdAt: '2024-10-22', status: "New", leadSource: "Website", lastUpdate: '2024-10-23', budget: '$5,000', subject: 'New Website Project', creator: 'You', assignee: 'You', followUp: '2024-10-28', lastCommentBy: 'You', nextActivity: "2024-10-25", score: 85, dateClosed: '-', description: 'Interested in a full redesign.', labels: ['Hot Lead'], duplicate: 'No', firstResponse: '2 hours', lastInternalNote: 'Sent proposal' },
    { id: 2, pipeline: 'Sales Pipeline', contactName: "David Chen", organisation: 'Innovate LLC', designation: 'CTO', email: "prospect.b@example.com", phone: '+14155552671', contactCountry: 'USA', customerCountry: 'USA', city: 'San Francisco', state: 'CA', createdAt: '2024-10-21', status: "Open", leadSource: "Referral", lastUpdate: '2024-10-24', budget: '$12,000', subject: 'API Integration', creator: 'Jane', assignee: 'You', followUp: '2024-10-27', lastCommentBy: 'Jane', nextActivity: "2024-10-26", score: 65, dateClosed: '-', description: 'Needs to connect their system.', labels: [], duplicate: 'No', firstResponse: '30 mins', lastInternalNote: 'Scheduled a demo call' },
];

const FilterBadge = ({ children }: { children: React.ReactNode }) => (
    <Badge variant="secondary" className="flex items-center gap-1">
        {children}
        <Button variant="ghost" size="icon" className="h-4 w-4"><Trash2 className="h-3 w-3"/></Button>
    </Badge>
);

export default function AllLeadsPage() {
    const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
    const [user, setUser] = useState<User | null>(null);
    
    useEffect(() => {
        getSession().then(session => {
            if (session?.user) {
                setUser(session.user as User);
            }
        });
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">
                         {user?.businessProfile?.name ? `${user.businessProfile.name} Leads` : 'All Leads'}
                    </h1>
                </div>
                 <Button asChild>
                    <Link href="/dashboard/crm/sales-crm/all-leads/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Lead
                    </Link>
                </Button>
            </div>
            
            <Separator />
            
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Today's Activity</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm">All</Button>
                        <Button variant="ghost" size="sm">New</Button>
                        <Button variant="ghost" size="sm">Open</Button>
                        <Button variant="ghost" size="sm">Deal Done</Button>
                        <Button variant="ghost" size="sm">Lost</Button>
                        <Button variant="ghost" size="sm">Not Serviceable</Button>
                        <Button variant="ghost" size="sm">Deleted Leads</Button>
                    </div>
                </div>
                <Button variant="outline"><Download className="mr-2 h-4 w-4"/>Download CSV</Button>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="relative flex-grow max-w-sm">
                            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search Leads..." className="pl-8" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4"/> Filters</Button>
                            <Button variant="ghost">Clear All Filters</Button>
                        </div>
                    </div>
                     <div className="flex flex-wrap items-center gap-2 pt-4">
                        <span className="text-sm font-medium">Applied Filters:</span>
                        <FilterBadge>Status: Open, New</FilterBadge>
                        <FilterBadge>Next Activity: &lt; Oct 27, 25</FilterBadge>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox onCheckedChange={(checked) => setSelectedLeads(checked ? leads.map(l => l.id) : [])}/></TableHead>
                                    <TableHead>Pipeline</TableHead>
                                    <TableHead>Contact Name</TableHead>
                                    <TableHead>Organisation Name</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Contact Country</TableHead>
                                    <TableHead>Customer Country</TableHead>
                                    <TableHead>Customer City</TableHead>
                                    <TableHead>State</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Lead Source</TableHead>
                                    <TableHead>Last Update</TableHead>
                                    <TableHead>Budget</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Creator</TableHead>
                                    <TableHead>Assignee</TableHead>
                                    <TableHead>Follow Up Date</TableHead>
                                    <TableHead>Last Comment By</TableHead>
                                    <TableHead>WhatsApp Link</TableHead>
                                    <TableHead>First Response Time</TableHead>
                                    <TableHead>Last Internal Note</TableHead>
                                    <TableHead>Next Activity</TableHead>
                                    <TableHead>Date Closed</TableHead>
                                    <TableHead>Lead Description</TableHead>
                                    <TableHead>Labels</TableHead>
                                    <TableHead>Duplicate</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {leads.map(lead => (
                                    <TableRow key={lead.id}>
                                        <TableCell><Checkbox checked={selectedLeads.includes(lead.id)} onCheckedChange={(checked) => setSelectedLeads(prev => checked ? [...prev, lead.id] : prev.filter(id => id !== lead.id))} /></TableCell>
                                        <TableCell>{lead.pipeline}</TableCell>
                                        <TableCell><div className="font-medium">{lead.contactName}</div></TableCell>
                                        <TableCell>{lead.organisation}</TableCell>
                                        <TableCell>{lead.designation}</TableCell>
                                        <TableCell>{lead.email}</TableCell>
                                        <TableCell>{lead.phone}</TableCell>
                                        <TableCell>{lead.contactCountry}</TableCell>
                                        <TableCell>{lead.customerCountry}</TableCell>
                                        <TableCell>{lead.city}</TableCell>
                                        <TableCell>{lead.state}</TableCell>
                                        <TableCell>{lead.createdAt}</TableCell>
                                        <TableCell><Badge variant="secondary">{lead.status}</Badge></TableCell>
                                        <TableCell>{lead.leadSource}</TableCell>
                                        <TableCell>{lead.lastUpdate}</TableCell>
                                        <TableCell>{lead.budget}</TableCell>
                                        <TableCell>{lead.subject}</TableCell>
                                        <TableCell>{lead.creator}</TableCell>
                                        <TableCell>{lead.assignee}</TableCell>
                                        <TableCell>{lead.followUp}</TableCell>
                                        <TableCell>{lead.lastCommentBy}</TableCell>
                                        <TableCell><Button variant="link" asChild className="p-0 h-auto"><a href={`https://wa.me/${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"><LinkIcon className="h-4 w-4"/></a></Button></TableCell>
                                        <TableCell>{lead.firstResponse}</TableCell>
                                        <TableCell>{lead.lastInternalNote}</TableCell>
                                        <TableCell>{lead.nextActivity}</TableCell>
                                        <TableCell>{lead.dateClosed}</TableCell>
                                        <TableCell className="max-w-xs truncate">{lead.description}</TableCell>
                                        <TableCell>{lead.labels.map(l => <Badge key={l}>{l}</Badge>)}</TableCell>
                                        <TableCell>{lead.duplicate}</TableCell>
                                        <TableCell className="text-right">
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem><Mail className="mr-2 h-4 w-4"/>Send Email</DropdownMenuItem>
                                                    <DropdownMenuItem><MessageSquare className="mr-2 h-4 w-4"/>Send WhatsApp</DropdownMenuItem>
                                                    <DropdownMenuItem><Phone className="mr-2 h-4 w-4"/>Log a Call</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem><Star className="mr-2 h-4 w-4"/>Add to Favorites</DropdownMenuItem>
                                                    <DropdownMenuItem><Eye className="mr-2 h-4 w-4"/>View Details</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
