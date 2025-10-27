
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
    Eye
} from "lucide-react";
import { useState, useEffect } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { getSession } from "@/app/actions";
import type { User } from "@/lib/definitions";

const leads = [
    { id: 1, name: "Prospect A", email: "prospect.a@example.com", owner: "You", status: "New", nextActivity: "2024-10-25", score: 85, source: "Website" },
    { id: 2, name: "Prospect B", email: "prospect.b@example.com", owner: "You", status: "Open", nextActivity: "2024-10-26", score: 65, source: "Referral" },
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
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lead
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
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox onCheckedChange={(checked) => setSelectedLeads(checked ? leads.map(l => l.id) : [])}/></TableHead>
                                    <TableHead>Lead</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Next Activity</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Lead Source</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {leads.map(lead => (
                                    <TableRow key={lead.id}>
                                        <TableCell><Checkbox checked={selectedLeads.includes(lead.id)} onCheckedChange={(checked) => setSelectedLeads(prev => checked ? [...prev, lead.id] : prev.filter(id => id !== lead.id))} /></TableCell>
                                        <TableCell>
                                            <div className="font-medium">{lead.name}</div>
                                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                                        </TableCell>
                                        <TableCell>{lead.owner}</TableCell>
                                        <TableCell><Badge variant="secondary">{lead.status}</Badge></TableCell>
                                        <TableCell>{new Date(lead.nextActivity).toLocaleDateString()}</TableCell>
                                        <TableCell><span className="font-bold text-primary">{lead.score}</span></TableCell>
                                        <TableCell>{lead.source}</TableCell>
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
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
