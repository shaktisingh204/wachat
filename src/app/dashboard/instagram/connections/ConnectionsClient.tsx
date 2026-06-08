'use client';

import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SearchInput,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { WithId, Project } from '@/lib/definitions';
import { InstagramIcon } from '@/components/20ui-domain/custom-sidebar-components';
import {
  ArrowRight,
  Download,
  FileText,
  Hash,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useVirtualizer } from '@tanstack/react-virtual';

type ProjectWithIg = WithId<Project> & { instagramProfile?: any };

function exportToCSV(data: ProjectWithIg[]) {
  const headers = ['Account name', 'IG user ID', 'Followers', 'Posts'];
  const csvContent = [
    headers.join(','),
    ...data.map((p) => {
      const ig = p.instagramProfile || {};
      return [
        `"${ig.username || p.name}"`,
        `"${ig.id || ''}"`,
        ig.followers_count || 0,
        ig.media_count || 0,
      ].join(',');
    }),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'instagram_connections.csv';
  link.click();
}

function exportToPDF(data: ProjectWithIg[]) {
  const doc = new jsPDF();
  doc.text('Instagram connections', 14, 15);

  const tableData = data.map((p) => {
    const ig = p.instagramProfile || {};
    return [
      ig.username || p.name,
      ig.id || 'N/A',
      (ig.followers_count || 0).toString(),
      (ig.media_count || 0).toString(),
    ];
  });

  autoTable(doc, {
    head: [['Account name', 'IG user ID', 'Followers', 'Posts']],
    body: tableData,
    startY: 20,
  });

  doc.save('instagram_connections.pdf');
}

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

export default function ConnectionsClient({ initialProjects }: { initialProjects: ProjectWithIg[] }) {
  const [projects, setProjects] = useState<ProjectWithIg[]>(initialProjects);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { toast } = useToast();

  const parentRef = useRef<HTMLDivElement>(null);

  // Live updates: a project's IG profile can change server-side; reflect it.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://echo.websocket.events';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'UPDATE_CONNECTION') {
          setProjects((prev) =>
            prev.map((p) =>
              p._id.toString() === data.projectId
                ? { ...p, instagramProfile: { ...p.instagramProfile, ...data.payload } }
                : p,
            ),
          );
        }
      } catch {
        // Ignore parse errors from the echo fallback server.
      }
    };

    return () => ws.close();
  }, []);

  const filteredProjects = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return projects.filter((p) =>
      (p.instagramProfile?.username || p.name).toLowerCase().includes(q),
    );
  }, [projects, searchTerm]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredProjects.length / 3),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 240,
    overscan: 5,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const totals = useMemo(() => {
    return projects.reduce(
      (acc, p) => {
        acc.followers += p.instagramProfile?.followers_count || 0;
        acc.posts += p.instagramProfile?.media_count || 0;
        return acc;
      },
      { followers: 0, posts: 0 },
    );
  }, [projects]);

  const fmt = (n: number) => (mounted ? n.toLocaleString() : String(n));

  const handleSelectProject = (project: ProjectWithIg) => {
    localStorage.setItem('activeProjectId', project._id.toString());
    localStorage.setItem(
      'activeProjectName',
      project.instagramProfile?.username || project.name,
    );
    router.push('/dashboard/instagram');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDisconnect = () => {
    if (selectedIds.size === 0) return;
    setProjects((prev) => prev.filter((p) => !selectedIds.has(p._id.toString())));
    setSelectedIds(new Set());
    toast.success({
      title: 'Accounts disconnected',
      description: 'The selected connections were removed.',
    });
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-90px)] w-full max-w-[1320px] flex-col gap-5 overflow-hidden px-6 pt-6 pb-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageDescription>Instagram</PageDescription>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <InstagramIcon className="h-6 w-6" aria-hidden="true" />
              Connections
            </span>
          </PageTitle>
          <PageDescription>
            Choose an Instagram Business account to manage, or disconnect ones you no longer use.
          </PageDescription>
        </PageHeaderHeading>

        {projects.length > 0 ? (
          <PageActions>
            <Button variant="outline" iconLeft={Download} onClick={() => exportToCSV(filteredProjects)}>
              CSV
            </Button>
            <Button variant="outline" iconLeft={FileText} onClick={() => exportToPDF(filteredProjects)}>
              PDF
            </Button>
          </PageActions>
        ) : null}
      </PageHeader>

      {projects.length > 0 ? (
        <>
          <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Connected accounts"
              value={<span style={tabular}>{fmt(projects.length)}</span>}
              icon={<InstagramIcon />}
              accent="#d6249f"
            />
            <StatCard
              label="Total followers"
              value={<span style={tabular}>{fmt(totals.followers)}</span>}
              icon={Users}
              accent="#7c3aed"
            />
            <StatCard
              label="Total posts"
              value={<span style={tabular}>{fmt(totals.posts)}</span>}
              icon={Hash}
              accent="#3b7af5"
            />
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:max-w-sm">
              <SearchInput
                value={searchTerm}
                onValueChange={setSearchTerm}
                placeholder="Search accounts by name"
                aria-label="Search accounts"
              />
            </div>
            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--st-text-secondary)]">
                  {selectedIds.size} selected
                </span>
                <Button variant="danger" onClick={handleBulkDisconnect}>
                  Disconnect selected
                </Button>
              </div>
            ) : null}
          </div>

          {filteredProjects.length === 0 ? (
            <Card variant="outlined">
              <EmptyState
                icon={<InstagramIcon />}
                title="No accounts match your search"
                description="Try a different name, or clear the search to see every connected account."
              />
            </Card>
          ) : (
            <div ref={parentRef} className="-mr-4 flex-1 overflow-auto pr-4">
              <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const startIndex = virtualRow.index * 3;
                  const rowItems = filteredProjects.slice(startIndex, startIndex + 3);

                  return (
                    <div
                      key={virtualRow.key}
                      className="absolute left-0 top-0 w-full"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="grid gap-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
                        {rowItems.map((p) => {
                          const ig = p.instagramProfile;
                          const isSelected = selectedIds.has(p._id.toString());
                          return (
                            <Card
                              key={p._id.toString()}
                              variant={isSelected ? 'elevated' : 'outlined'}
                              padding="none"
                              className={`flex flex-col transition-shadow ${
                                isSelected ? 'ring-2 ring-[var(--st-accent)]' : ''
                              }`}
                            >
                              <CardHeader className="flex flex-row items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => toggleSelect(p._id.toString())}
                                  aria-label={`Select ${ig?.username || p.name}`}
                                />
                                <Avatar
                                  name={ig?.username || p.name}
                                  src={ig?.profile_picture_url}
                                  shape="round"
                                  size="md"
                                />
                                <div className="min-w-0 flex-1">
                                  <CardTitle className="truncate text-sm">
                                    @{ig?.username || p.name}
                                  </CardTitle>
                                  <p className="truncate text-xs text-[var(--st-text-secondary)]">
                                    ID: {ig?.id || '—'}
                                  </p>
                                </div>
                                <Badge tone="success" dot>
                                  Connected
                                </Badge>
                              </CardHeader>
                              <CardBody className="flex-grow">
                                <dl className="grid grid-cols-2 gap-3">
                                  <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3">
                                    <dt className="text-xs text-[var(--st-text-secondary)]">Followers</dt>
                                    <dd className="mt-0.5 text-sm font-semibold text-[var(--st-text)]" style={tabular}>
                                      {ig?.followers_count != null ? fmt(ig.followers_count) : 'N/A'}
                                    </dd>
                                  </div>
                                  <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3">
                                    <dt className="text-xs text-[var(--st-text-secondary)]">Posts</dt>
                                    <dd className="mt-0.5 text-sm font-semibold text-[var(--st-text)]" style={tabular}>
                                      {ig?.media_count != null ? fmt(ig.media_count) : 'N/A'}
                                    </dd>
                                  </div>
                                </dl>
                              </CardBody>
                              <CardFooter>
                                <Button block iconRight={ArrowRight} onClick={() => handleSelectProject(p)}>
                                  Manage account
                                </Button>
                              </CardFooter>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card variant="outlined">
          <EmptyState
            icon={<InstagramIcon />}
            title="No Instagram accounts found"
            description="We couldn't find any Instagram Business accounts linked to your Facebook Pages. Link them in Meta Business Suite, then return here."
            action={
              <Button asChild variant="outline">
                <Link href="/dashboard/instagram/setup">
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                  Go to setup
                </Link>
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
