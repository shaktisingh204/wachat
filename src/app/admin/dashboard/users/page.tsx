

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Metadata } from 'next';
import { getUsersForAdmin } from '@/app/actions/index.ts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AdminUserSearch } from '@/components/wabasimplify/admin-user-search';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WithId, User } from '@/lib/definitions';
import { ApproveUserButton } from '@/components/wabasimplify/approve-user-button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'User Management | SabNode',
};

const USERS_PER_PAGE = 10;

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: {
        query?: string;
        page?: string;
    };
}) {
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;
  
  let users: (Omit<WithId<User>, "password"> & { isApproved?: boolean })[] = [];
  let total = 0;

  try {
      const data = await getUsersForAdmin(currentPage, USERS_PER_PAGE, query);
      users = data.users;
      total = data.total;
  } catch (error) {
      console.error("Failed to fetch admin users:", error);
  }

  const totalPages = Math.ceil(total / USERS_PER_PAGE);

  const plainUsers = JSON.parse(JSON.stringify(users)) as (WithId<User> & { isApproved?: boolean })[];


  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold font-headline">User Management</h1>
        <p className="text-muted-foreground">View and approve all users on the platform.</p>
      </div>

      <Card>
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
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {plainUsers.length > 0 ? (
                    plainUsers.map((user) => (
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
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                            {user.isApproved ? (
                                <Badge>Approved</Badge>
                            ) : (
                                <Badge variant="secondary">Pending</Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                            {!user.isApproved && (
                                <ApproveUserButton userId={user._id.toString()} />
                            )}
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
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
