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
    Link as LinkIcon,
    LoaderCircle
} from "lucide-react";
import { useState, useEffect, useCallback, useTransition } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { getSession, getCrmDeals, getCrmContacts } from "@/app/actions";
import type { User, WithId, CrmDeal, CrmContact } from "@/lib/definitions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useDebouncedCallback } from "use-debounce";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";

const leadsPerPage = 20;

const leads = [
    { id: 1, pipeline: 'Sales Pipeline', contactName: "Aisha Ahmed", organisation: 'Acme Inc.', designation: 'Marketing Head', email: "prospect.a@example.com", phone: '+919876543210', contactCountry: 'India', customerCountry: 'India', city: 'Mumbai', state: 'Maharashtra', createdAt: '2024-10-22', status: "New", leadSource: "Website", lastUpdate: '2024-10-23', budget: '$5,000', subject: 'New Website Project', creator: 'You', assignee: 'You', followUp: '2024-10-28', lastCommentBy: 'You', nextActivity: "2024-10-25", score: 85, dateClosed: '-', description: 'Interested in a full redesign.', labels: ['Hot Lead'], duplicate: 'No', firstResponse: '2 hours', lastInternalNote: 'Sent proposal' },
    { id: 2, pipeline: 'Sales Pipeline', contactName: "David Chen", organisation: 'Innovate LLC', designation: 'CTO', email: "prospect.b@example.com", phone: '+14155552671', contactCountry: 'USA', customerCountry: 'USA', city: 'San Francisco', state: 'CA', createdAt: '2024-10-21', status: "Open", leadSource: "Referral", lastUpdate: '2024-10-24', budget: '$12,000', subject: 'API Integration', creator: 'Jane', assignee: 'You', followUp: '2024-10-27', lastCommentBy: 'Jane', nextActivity: "2024-10-26", score: 65, dateClosed: '-', description: 'Needs to connect their system.', labels: [], duplicate: 'No', firstResponse: '30 mins', lastInternalNote: 'Scheduled a demo call' },
];

const FilterBadge = ({ children, onRemove }: { children: React.ReactNode, onRemove: () => void }) => (
    <Badge variant="secondary" className="flex items-center gap-1">
        {children}
        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={onRemove}><Trash2 className="h-3 w-3"/></Button>
    </Badge>
);

export default function AllLeadsPage() {
    const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [deals, setDeals] = useState<WithId<CrmDeal>[]>([]);
    const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    // Filters state
    const [statusFilter, setStatusFilter] = useState<string[]>(['New', 'Open']);
    const [dateRange, setDateRange] = useState<{from?: Date, to?: Date}>({});

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [sessionData, dealsData, contactsData] = await Promise.all([
                getSession(),
                getCrmDeals(),
                getCrmContacts()
            ]);
            setUser(sessionData?.user || null);
            setDeals(dealsData);
            setContacts(contactsData.contacts);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const contactsMap = new Map(contacts.map(c => [c._id.toString(), c]));
    
    const filteredDeals = deals.filter(deal => {
        let passes = true;
        if(statusFilter.length > 0 && !statusFilter.includes('All')) {
            passes = passes && statusFilter.includes(deal.stage);
        }
        if(dateRange.from && new Date(deal.createdAt) < dateRange.from) {
            passes = false;
        }
        if(dateRange.to && new Date(deal.createdAt) > dateRange.to) {
            passes = false;
        }
        return passes;
    });

    const handleDownload = () => {
        if(filteredDeals.length === 0) {
            toast({ title: "No data to export", variant: 'destructive'});
            return;
        }
        const dataToExport = filteredDeals.map(deal => {
            const contact = contactsMap.get(deal.contactIds?.[0]?.toString() || '');
            return {
                "Pipeline": 'Sales Pipeline',
                "Contact Name": contact?.name,
                "Organisation Name": contact?.company,
                "Designation": contact?.jobTitle,
                "Email": contact?.email,
                "Phone": contact?.phone,
                "Created At": new Date(deal.createdAt).toISOString(),
                "Status": deal.stage,
                "Lead Source": deal.leadSource,
                "Subject": deal.name,
                "Assignee": 'You', // Placeholder
            }
        });
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'leads_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const clearFilters = () => {
        setStatusFilter([]);
        setDateRange({});
    }

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
                        {['All', 'New', 'Open', 'Deal Done', 'Lost', 'Not Serviceable'].map(status => (
                            <Button key={status} variant={statusFilter.includes(status) ? 'secondary' : 'ghost'} size="sm" onClick={() => setStatusFilter([status])}>
                                {status}
                            </Button>
                        ))}
                    </div>
                </div>
                <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4"/>Download CSV</Button>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="relative flex-grow max-w-sm">
                            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search Leads..." className="pl-8" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4"/> Filters</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 space-y-4">
                                     <div className="space-y-2">
                                        <Label>Created Between</Label>
                                        <DatePicker date={dateRange.from} setDate={d => setDateRange(prev => ({...prev, from: d}))} />
                                        <DatePicker date={dateRange.to} setDate={d => setDateRange(prev => ({...prev, to: d}))} />
                                     </div>
                                </PopoverContent>
                            </Popover>
                            <Button variant="ghost" onClick={clearFilters}>Clear All Filters</Button>
                        </div>
                    </div>
                     <div className="flex flex-wrap items-center gap-2 pt-4">
                        <span className="text-sm font-medium">Applied Filters:</span>
                        {statusFilter.length > 0 && <FilterBadge onRemove={() => setStatusFilter([])}>Status: {statusFilter.join(', ')}</FilterBadge>}
                        {(dateRange.from || dateRange.to) && <FilterBadge onRemove={() => setDateRange({})}>Created Date</FilterBadge>}
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox onCheckedChange={(checked) => setSelectedLeads(checked ? leads.map(l => l.id) : [])}/></TableHead>
                                    <TableHead>Contact Name</TableHead>
                                    <TableHead>Organisation Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Lead Source</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={9} className="h-24 text-center"><LoaderCircle className="mx-auto animate-spin"/></TableCell></TableRow>
                                ) : filteredDeals.map(deal => {
                                    const contact = contactsMap.get(deal.contactIds?.[0]?.toString() || '');
                                    return (
                                        <TableRow key={deal._id.toString()}>
                                            <TableCell><Checkbox /></TableCell>
                                            <TableCell><div className="font-medium">{contact?.name || 'N/A'}</div></TableCell>
                                            <TableCell>{contact?.company}</TableCell>
                                            <TableCell><Badge variant="secondary">{deal.stage}</Badge></TableCell>
                                            <TableCell>{deal.leadSource}</TableCell>
                                            <TableCell>{deal.name}</TableCell>
                                            <TableCell>{contact?.email}</TableCell>
                                            <TableCell>{contact?.phone}</TableCell>
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
                                                        <DropdownMenuItem asChild><Link href={`/dashboard/crm/deals/${deal._id}`}><Eye className="mr-2 h-4 w-4"/>View Details</Link></DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                         <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
