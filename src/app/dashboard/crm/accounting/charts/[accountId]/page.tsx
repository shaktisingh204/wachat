import { notFound } from 'next/navigation';
import { getCrmChartOfAccountById } from '@/app/actions/crm-accounting.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, SlidersHorizontal, Trash2, Edit, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


export default async function AccountDetailPage({ params }: { params: { accountId: string } }) {
    const account = await getCrmChartOfAccountById(params.accountId);

    if (!account) {
        notFound();
    }
    
    const balanceDetails = [
        { label: 'Opening Balance', value: account.openingBalance, type: account.balanceType },
        { label: 'Current Balance', value: account.openingBalance, type: account.balanceType }, // Placeholder for current balance
    ];

    return (
        <div className="space-y-6">
            <div>
                 <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/accounting/charts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Chart of Accounts</Link>
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-headline">{account.name}</h1>
                        <p className="text-muted-foreground">{account.accountGroupName} [{account.accountGroupCategory?.replace(/_/g, ' ')}]</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select defaultValue="fy2526">
                            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                                <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                            </SelectContent>
                        </Select>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    Actions
                                    <ChevronDown className="ml-2 h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>View Statement</DropdownMenuItem>
                                <DropdownMenuItem>Edit Account</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline"><Download className="mr-2 h-4 w-4" />Download CSV</Button>
                    </div>
                </div>
            </div>

            <Card>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                    {balanceDetails.map(item => (
                        <div key={item.label} className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">{item.label}</p>
                            <p className="text-2xl font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(item.value)}</p>
                            <p className="text-xs font-mono text-muted-foreground">{item.type}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold">Transactions</h3>
                        <p className="text-sm text-muted-foreground">No reversal entry has been made against this account.</p>
                    </div>
                     <div className="flex items-center gap-2">
                         <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" />Filters</Button>
                        <Button variant="outline"><Trash2 className="mr-2 h-4 w-4" />Clear All Filters</Button>
                     </div>
                </div>
                 <div className="flex items-center gap-2 text-sm">
                    <span>Applied Filters:</span>
                     <span className="text-muted-foreground">None</span>
                </div>
            </div>

             <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Voucher Book</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Voucher #</TableHead>
                            <TableHead>Cr/Dr</TableHead>
                            <TableHead>Currency</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Remark</TableHead>
                            <TableHead>Book Amount</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Reversed</TableHead>
                            <TableHead>Reversal Entry</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={11} className="h-24 text-center">
                                No Data
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}