
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Briefcase, CheckSquare, Server, AlertTriangle, MessageSquare, Send, GitFork, ServerCog, Edit, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { getProjectsForAdmin } from '@/app/actions/user.actions';
import { getAdminDashboardStats } from '@/app/actions/admin.actions';
import { getPlans } from '@/app/actions/plan.actions';
import type { Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProjectSearch } from '@/components/wabasimplify/project-search';
import { AdminDeleteProjectButton } from '@/components/wabasimplify/admin-delete-project-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AdminUpdateCreditsButton } from '@/components/wabasimplify/admin-update-credits-button';
import { AdminUpdateMpsButton } from '@/components/wabasimplify/admin-update-mps-button';
import { AdminAssignPlanDialog } from '@/components/wabasimplify/admin-assign-plan-dialog';
import { getAllBroadcasts } from '@/app/actions';

export const dynamic = 'force-dynamic';

const PROJECTS_PER_PAGE = 5;

const StatCard = ({ title, value, icon: Icon, gradientClass, description }: { title: string, value: string | number, icon: React.ElementType, gradientClass?: string, description?: string }) => (
    <Card className={cn(gradientClass)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export default async function AdminDashboardPage({
    searchParams,
}: {
    searchParams?: {
        query?: string;
        page?: string;
    };
}) {
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;
  
  const { projects, total: totalProjects } = await getProjectsForAdmin(currentPage, PROJECTS_PER_PAGE, query);
  const { broadcasts: recentBroadcasts } = await getAllBroadcasts(1, 5);
  const allPlans = await getPlans();
  const { totalUsers, totalWabas, totalMessages, totalCampaigns, totalFlows } = await getAdminDashboardStats();
  
  const totalPages = Math.ceil(totalProjects / PROJECTS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
        <p className="text-muted-foreground">High-level overview of the SabNode platform.</p>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All project types on the platform.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active WABAs</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWabas.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total connected WhatsApp accounts.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
             <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">99.98%</div>
             <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
             <p className="text-xs text-muted-foreground">Total registered users.</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Platform Insights</CardTitle>
          <CardDescription>Live metrics from across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Messages Sent" value={totalMessages.toLocaleString()} icon={MessageSquare} description="All-time outgoing messages." />
              <StatCard title="Total Campaigns Run" value={totalCampaigns.toLocaleString()} icon={Send} description="All-time broadcast jobs."/>
              <StatCard title="Total Flow Executions" value={totalFlows.toLocaleString()} icon={GitFork} description="Total times any flow has run."/>
              <StatCard title="Meta Flows Used" value="0" icon={ServerCog} description="Coming soon."/>
            </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>All Projects</CardTitle>
              <CardDescription>Total projects found: {totalProjects.toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <ProjectSearch placeholder="Search projects..." />
              </div>
              <div className="border rounded-md">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Concurrency</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {projects.length > 0 ? (
                        projects.map((project) => (
                        <TableRow key={project._id.toString()}>
                            <TableCell className="font-medium">{project.name}</TableCell>
                            <TableCell><Badge variant="outline">{project.plan?.name || 'N/A'}</Badge></TableCell>
                            <TableCell>{project.credits?.toLocaleString() || 0}</TableCell>
                            <TableCell>{project.messagesPerSecond || 'N/A'} msg/s</TableCell>
                            <TableCell className="text-right">
                               <AdminUpdateCreditsButton projectId={project._id.toString()} currentCredits={project.credits || 0} />
                               <AdminUpdateMpsButton projectId={project._id.toString()} currentMps={project.messagesPerSecond || 80} />
                               <AdminAssignPlanDialog
                                 projectId={project._id.toString()}
                                 projectName={project.name}
                                 currentPlanId={project.planId?.toString()}
                                 allPlans={allPlans}
                               />
                               <AdminDeleteProjectButton projectId={project._id.toString()} projectName={project.name} />
                            </TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            No projects found.
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
                      <Link href={`/admin/dashboard?page=${currentPage - 1}${query ? `&query=${query}` : ''}`}>Previous</Link>
                  </Button>
                  <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={currentPage >= totalPages}
                  >
                      <Link href={`/admin/dashboard?page=${currentPage + 1}${query ? `&query=${query}` : ''}`}>Next</Link>
                  </Button>
              </div>
            </CardContent>
          </Card>
           <Card>
                <CardHeader>
                    <CardTitle>Recent Broadcasts</CardTitle>
                    <CardDescription>A log of the most recent campaigns sent across the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Template</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {recentBroadcasts.length > 0 ? (
                                recentBroadcasts.map((b) => (
                                    <TableRow key={b._id.toString()}>
                                        <TableCell>{new Date(b.createdAt).toLocaleTimeString()}</TableCell>
                                        <TableCell>{b.templateName}</TableCell>
                                        <TableCell><Badge variant={b.status === 'Completed' ? 'default' : 'secondary'}>{b.status}</Badge></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="text-center h-24">No broadcasts sent yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
      </div>

    </div>
  );
}
