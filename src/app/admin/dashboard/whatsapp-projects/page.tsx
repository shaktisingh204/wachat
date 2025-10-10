
import { getWhatsAppProjectsForAdmin } from '@/app/actions/project.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AdminUserSearch } from '@/components/wabasimplify/admin-user-search';
import { WhatsAppIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { AdminUserFilter } from '@/components/wabasimplify/admin-user-filter';

export const dynamic = 'force-dynamic';

const PROJECTS_PER_PAGE = 20;

export default async function WhatsAppProjectsPage({
    searchParams,
}: {
    searchParams?: {
        query?: string;
        page?: string;
        userId?: string;
    };
}) {
    const query = searchParams?.query || '';
    const userId = searchParams?.userId;
    const currentPage = Number(searchParams?.page) || 1;
    
    const { projects, total: totalProjects, users } = await getWhatsAppProjectsForAdmin(currentPage, PROJECTS_PER_PAGE, query, userId);
    
    const totalPages = Math.ceil(totalProjects / PROJECTS_PER_PAGE);

    const getStatusVariant = (status?: string) => {
        if (!status) return 'outline';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'approved' || lowerStatus === 'verified') return 'default';
        if (lowerStatus.includes('pending') || lowerStatus.includes('unknown')) return 'secondary';
        return 'destructive';
    };

    const createPageURL = (pageNumber: number) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', pageNumber.toString());
        return `/admin/dashboard/whatsapp-projects?${params.toString()}`;
      };

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                    <WhatsAppIcon className="h-7 w-7"/>
                    WhatsApp Projects
                </h1>
                <p className="text-muted-foreground">A list of all connected WhatsApp Business Accounts.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Connected Accounts ({totalProjects})</CardTitle>
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                         <CardDescription>View all WABAs and filter by owner.</CardDescription>
                         <div className="flex items-center gap-2">
                             <AdminUserSearch placeholder="Search by project name..." />
                             <AdminUserFilter users={users} />
                         </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project Name</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>WABA ID</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.length > 0 ? (
                                    projects.map(project => (
                                        <TableRow key={project._id.toString()}>
                                            <TableCell className="font-medium">{project.name}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{project.owner.name}</div>
                                                <div className="text-sm text-muted-foreground">{project.owner.email}</div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{project.wabaId}</TableCell>
                                            <TableCell>
                                                 <Badge variant={getStatusVariant(project.reviewStatus)} className="capitalize">
                                                    {project.reviewStatus?.replace(/_/g, ' ') || 'Unknown'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No WhatsApp projects found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="flex items-center justify-end space-x-2 py-4">
                        <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={currentPage <= 1}
                        >
                            <Link href={createPageURL(currentPage - 1)}>Previous</Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={currentPage >= totalPages}
                        >
                             <Link href={createPageURL(currentPage + 1)}>Next</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
