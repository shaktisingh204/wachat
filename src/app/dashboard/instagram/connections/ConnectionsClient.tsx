'use client';

import {
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Input,
  Checkbox,
} from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { WithId, Project } from '@/lib/definitions';
import { InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { ArrowRight, Wrench, Download, Search, Settings } from 'lucide-react';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

type ProjectWithIg = WithId<Project> & { instagramProfile?: any };

function exportToCSV(data: ProjectWithIg[]) {
  const headers = ['Account Name', 'IG User ID', 'Followers', 'Media Count'];
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
  doc.text('Instagram Connections', 14, 15);

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
    head: [['Account Name', 'IG User ID', 'Followers', 'Media Count']],
    body: tableData,
    startY: 20,
  });

  doc.save('instagram_connections.pdf');
}

import { useRef } from 'react';

export default function ConnectionsClient({ initialProjects }: { initialProjects: ProjectWithIg[] }) {
  const [projects, setProjects] = useState<ProjectWithIg[]>(initialProjects);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { toast: zoruToast } = useZoruToast();
  
  const parentRef = useRef<HTMLDivElement>(null);

  // Mock WebSocket for real-time updates
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://echo.websocket.events';
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'UPDATE_CONNECTION') {
          setProjects((prev) => 
            prev.map((p) => (p._id.toString() === data.projectId ? { ...p, instagramProfile: { ...p.instagramProfile, ...data.payload } } : p))
          );
        }
      } catch (e) {
        // Ignore JSON parse errors from mock echo server
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const name = p.instagramProfile?.username || p.name;
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [projects, searchTerm]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredProjects.length / 3), // 3 columns for lg, roughly
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220, // estimated height of the card
    overscan: 5,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectProject = (project: ProjectWithIg) => {
    localStorage.setItem('activeProjectId', project._id.toString());
    localStorage.setItem(
      'activeProjectName',
      project.instagramProfile?.username || project.name,
    );
    router.push('/dashboard/instagram');
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDisconnect = () => {
    if (selectedIds.size === 0) return;
    
    // Optimistic UI Update
    const newProjects = projects.filter(p => !selectedIds.has(p._id.toString()));
    setProjects(newProjects);
    setSelectedIds(new Set());
    
    zoruToast({
      title: 'Accounts Disconnected',
      description: 'Successfully removed selected connections.',
    });
  };

  return (
    <div className="flex flex-col gap-8 h-[calc(100vh-100px)] overflow-hidden">
      <PageHeader>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <ZoruPageHeading>
            <ZoruPageTitle>
              <span className="inline-flex items-center gap-3">
                <InstagramIcon className="h-7 w-7" />
                Instagram Connections
              </span>
            </ZoruPageTitle>
            <ZoruPageDescription>
              Select an Instagram Business Account to manage or disconnect.
            </ZoruPageDescription>
          </ZoruPageHeading>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => exportToCSV(filteredProjects)} title="Export to CSV">
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={() => exportToPDF(filteredProjects)} title="Export to PDF">
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </PageHeader>

      {projects.length > 0 ? (
        <>
          <div className="flex flex-col md:flex-row items-center gap-4 justify-between bg-card p-4 rounded-lg border shadow-sm shrink-0">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                className="pl-9 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {selectedIds.size} selected
                </span>
                <Button variant="destructive" onClick={handleBulkDisconnect}>
                  Disconnect Selected
                </Button>
              </div>
            )}
          </div>

          <div 
            ref={parentRef}
            className="flex-1 overflow-auto pr-4"
          >
            <div
              className="relative w-full"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * 3;
                const rowItems = filteredProjects.slice(startIndex, startIndex + 3);

                return (
                  <div
                    key={virtualRow.key}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                      {rowItems.map((p) => {
                        const { instagramProfile } = p;
                        const isSelected = selectedIds.has(p._id.toString());
                        
                        return (
                          <Card key={p._id.toString()} className={`flex flex-col p-0 transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                            <ZoruCardHeader className="flex-row items-center gap-4 pb-2">
                              <div className="flex items-center gap-4 flex-1">
                                <Checkbox 
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(p._id.toString())}
                                  aria-label="Select account"
                                />
                                <Avatar className="h-12 w-12">
                                  <ZoruAvatarImage
                                    src={instagramProfile?.profile_picture_url}
                                    alt={instagramProfile?.username}
                                  />
                                  <ZoruAvatarFallback>
                                    <InstagramIcon className="h-6 w-6" />
                                  </ZoruAvatarFallback>
                                </Avatar>
                                <div className="overflow-hidden">
                                  <ZoruCardTitle className="truncate">{instagramProfile?.username || p.name}</ZoruCardTitle>
                                  <ZoruCardDescription className="truncate">IG User ID: {instagramProfile?.id}</ZoruCardDescription>
                                </div>
                              </div>
                            </ZoruCardHeader>
                            <ZoruCardContent className="flex-grow pt-2">
                              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-md">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Followers</p>
                                  <p className="font-semibold text-sm">
                                    {mounted ? (instagramProfile?.followers_count?.toLocaleString() || 'N/A') : (instagramProfile?.followers_count || 'N/A')}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Media Count</p>
                                  <p className="font-semibold text-sm">
                                    {mounted ? (instagramProfile?.media_count?.toLocaleString() || 'N/A') : (instagramProfile?.media_count || 'N/A')}
                                  </p>
                                </div>
                              </div>
                            </ZoruCardContent>
                            <ZoruCardFooter>
                              <Button onClick={() => handleSelectProject(p)} block className="w-full">
                                Manage Account <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            </ZoruCardFooter>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {filteredProjects.length === 0 && (
             <div className="text-center py-12 text-muted-foreground">
               No accounts match your search.
             </div>
          )}
        </>
      ) : (
        <Card className="text-center py-12 p-6">
          <ZoruCardContent className="space-y-4">
            <p className="text-lg text-zoru-ink">No Instagram Accounts Found</p>
            <p className="text-zoru-ink-muted max-w-md mx-auto">
              We couldn&apos;t find any Instagram Business Accounts linked to your connected
              Facebook Pages. Please ensure they are properly connected in your Meta Business
              Suite.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/instagram/setup">
                <Wrench className="mr-2 h-4 w-4" />
                Go to Setup
              </Link>
            </Button>
          </ZoruCardContent>
        </Card>
      )}
    </div>
  );
}
