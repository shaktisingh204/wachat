

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Metadata } from 'next';
import { getUsersForAdmin, getPlans } from '@/app/actions';
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
import { AdminUserSearch } from '@/components/wabasimplify/admin-user-search';
import { AdminUpdateCreditsButton } from '@/components/wabasimplify/admin-update-credits-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminAssignPlanDialog } from '@/components/wabasimplify/admin-assign-plan-dialog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'User Management | Wachat',
};

const USERS_PER_PAGE = 10;

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams?: {
        query?: string;
        page?: string;
    };
}) {
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;
  
  const [{ users, total }, allPlans] = await Promise.all([
    getUsersForAdmin(currentPage, USERS_PER_PAGE, query),
    getPlans()
  ]);

  const totalPages = Math.ceil(total / USERS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold font-headline">User Management</h1>
        <p className="text-muted-foreground">View and manage all users on the platform.</p>
      </div>

      <Card className="card-gradient card-gradient-purple">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Total users found: {total.toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <AdminUserSearch placeholder="Search users by name or email..." />
          </div>
          <div className="border rounded-md">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {users.length > 0 ? (
                    users.map((user) => (
                    <TableRow key={user._id.toString()}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Avatar><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                            </div>
                        </TableCell>
                         <TableCell>
                            <Badge variant={user.plan?.name ? 'default' : 'secondary'}>{user.plan?.name || 'No Plan'}</Badge>
                        </TableCell>
                        <TableCell>
                            {user.credits?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                           <div className="flex items-center justify-end gap-2">
                               <AdminUpdateCreditsButton userId={user._id.toString()} currentCredits={user.credits || 0}/>
                               <AdminAssignPlanDialog user={user} allPlans={allPlans} />
                           </div>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No users found.
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
                  <Link href={`/admin/dashboard/users?page=${currentPage - 1}${query ? `&query=${query}` : ''}`}>Previous</Link>
              </Button>
              <Button
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={currentPage >= totalPages}
              >
                  <Link href={`/admin/dashboard/users?page=${currentPage + 1}${query ? `&query=${query}` : ''}`}>Next</Link>
              </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
