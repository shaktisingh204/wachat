'use client';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardFooter,
  Badge,
  EmptyState,
  Spinner,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { getWhatsAppProjectsForAdmin } from '@/app/actions/user.actions';
import { AdminUserSearch } from '@/components/20ui-domain/admin-user-search';
import { AdminUserFilter } from '@/components/20ui-domain/admin-user-filter';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  Suspense,
} from 'react';
import type { WithId } from 'mongodb';
import type { Project, User } from '@/lib/definitions';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { MessageSquare, Archive } from 'lucide-react';
import { AdminArchiveProjectButton } from '@/components/20ui-domain/admin-archive-project-button';

const PROJECTS_PER_PAGE = 20;

/** Map a review status to a Badge tone so colour carries meaning. */
function statusTone(status?: string): BadgeTone {
  if (!status) return 'neutral';
  const key = status.toLowerCase();
  if (key.includes('partial')) return 'warning';
  if (key.includes('fail') || key.includes('reject')) return 'danger';
  if (key.includes('pend') || key.includes('review')) return 'warning';
  if (key.includes('approv') || key.includes('verif')) return 'success';
  return 'neutral';
}

function WhatsAppProjectsContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [projects, setProjects] = useState<
    WithId<Project & { owner: { name: string; email: string }; isArchived?: boolean }>[]
  >([]);
  const [users, setUsers] = useState<WithId<User>[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [isLoading, startTransition] = useTransition();

  const query = searchParams.get('query') || '';
  const userId = searchParams.get('userId');
  const statusParam = searchParams.get('status') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;
  const totalPages = Math.ceil(totalProjects / PROJECTS_PER_PAGE);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const data = await getWhatsAppProjectsForAdmin(
        currentPage,
        PROJECTS_PER_PAGE,
        query,
        userId || undefined,
        statusParam === 'all' ? undefined : statusParam,
      );
      setProjects(data.projects);
      setTotalProjects(data.total);
      setUsers(data.users);
    });
  }, [currentPage, query, userId, statusParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createPageURL = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    return `${pathname}?${params}`;
  };

  const goToPage = (page: number) => {
    router.push(createPageURL(page));
  };

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>WhatsApp Projects</PageTitle>
          <PageDescription>
            All connected WhatsApp Business Accounts across the platform.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card padding="none">
        <CardHeader className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)]">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <span className="font-medium text-[var(--st-text)]">
              Connected Accounts
              <span className="ml-2 font-normal text-[var(--st-text-secondary)]">
                ({totalProjects})
              </span>
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={statusParam}
              onValueChange={(val) => {
                const params = new URLSearchParams(searchParams);
                if (val && val !== 'all') {
                  params.set('status', val);
                } else {
                  params.delete('status');
                }
                params.set('page', '1');
                router.push(`${pathname}?${params.toString()}`);
              }}
            >
              <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="partial_failure">Partial Failure</SelectItem>
              </SelectContent>
            </Select>
            <AdminUserSearch placeholder="Search by project name..." />
            <AdminUserFilter users={users} />
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Project</Th>
                <Th>Owner</Th>
                <Th>WABA ID</Th>
                <Th>Status</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {isLoading ? (
                <Tr>
                  <Td colSpan={5} align="center" className="py-12">
                    <Spinner size="md" label="Loading projects" className="mx-auto" />
                  </Td>
                </Tr>
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <Tr
                    key={project._id.toString()}
                    className={project.isArchived ? 'opacity-60' : undefined}
                  >
                    <Td className="font-medium text-[var(--st-text)]">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/wachat?projectId=${project._id}`}
                          className="font-medium text-[var(--st-text)] hover:underline"
                        >
                          {project.name}
                        </Link>
                        {project.isArchived && (
                          <Badge tone="neutral">
                            <Archive className="h-3 w-3" aria-hidden="true" />
                            Archived
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <p className="font-medium text-[var(--st-text)]">
                        {project.owner?.name || '-'}
                      </p>
                      <p className="text-xs text-[var(--st-text-secondary)]">
                        {project.owner?.email || '-'}
                      </p>
                    </Td>
                    <Td className="font-mono text-xs text-[var(--st-text-secondary)]">
                      {project.wabaId || '-'}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(project.reviewStatus)} className="capitalize">
                        {project.reviewStatus?.replace(/_/g, ' ') || 'Unknown'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <AdminArchiveProjectButton
                        projectId={project._id.toString()}
                        projectName={project.name}
                        isArchived={project.isArchived}
                      />
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={5} className="py-16">
                    <EmptyState
                      icon={MessageSquare}
                      title="No WhatsApp projects found"
                      description="Connected WhatsApp Business Accounts will appear here once users onboard."
                    />
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </div>

        <CardFooter className="px-6 py-3 flex items-center justify-between border-t border-[var(--st-border)]">
          <span className="text-xs text-[var(--st-text-secondary)]">
            Page {currentPage} of {totalPages > 0 ? totalPages : 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function WhatsAppProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center">
          <Spinner size="lg" label="Loading WhatsApp projects" className="mx-auto" />
        </div>
      }
    >
      <WhatsAppProjectsContent />
    </Suspense>
  );
}
