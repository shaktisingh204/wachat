'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ATSApplication } from '@/lib/hrm-advanced-types';
import { saveATSApplication, deleteATSApplication } from '@/app/actions/hrm-advanced/ats-recruitment';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import { FileDown, Plus, Trash2, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

import ApplicationFormModal from './ApplicationFormModal';
import VirtualizedApplicationsList from './VirtualizedApplicationsList';

export default function ClientPage({ initialData }: { initialData: ATSApplication[] }) {
  const [applications, setApplications] = useState<ATSApplication[]>(initialData);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  // Real-time updates mock (simulating websockets)
  useEffect(() => {
    const interval = setInterval(() => {
      setApplications(prev => {
        if (prev.length === 0) return prev;
        const randomIndex = Math.floor(Math.random() * prev.length);
        const randomApp = prev[randomIndex];
        // Simulate a status change from another user
        const statuses: ('New'|'Screening'|'Interview'|'Offer'|'Hired'|'Rejected')[] = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        if (randomApp.status !== randomStatus) {
          toast({
            title: "Real-time Update",
            description: `${randomApp.candidateName}'s status changed to ${randomStatus}.`,
          });
          return prev.map((app, i) => i === randomIndex ? { ...app, status: randomStatus } : app);
        }
        return prev;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [toast]);

  // Hydration mismatch fix: Ensure dates are handled properly
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch = app.candidateName.toLowerCase().includes(search.toLowerCase()) || 
                            app.role.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filteredApplications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplications.map(a => a._id!)));
    }
  }, [filteredApplications, selectedIds]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<ATSApplication | null>(null);

  const handleSave = async (payload: Partial<ATSApplication>) => {
    const isNew = !payload._id;
    const tempId = payload._id || `temp-${Date.now()}`;
    const optimisticApp = { ...payload, _id: tempId } as ATSApplication;
    
    // Optimistic Update
    const previousApps = [...applications];
    setApplications(prev => 
      isNew ? [optimisticApp, ...prev] : prev.map(a => a._id === payload._id ? optimisticApp : a)
    );
    setFormOpen(false);

    try {
      const result = await saveATSApplication(payload);
      if (result.error) throw new Error(result.error);
      
      toast({
        title: "Success",
        description: `Application ${isNew ? 'created' : 'updated'} successfully.`
      });
      
      // Update with actual ID if new
      if (isNew && result.data) {
        setApplications(prev => prev.map(a => a._id === tempId ? { ...a, _id: result.data } : a));
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save application.",
        variant: "destructive"
      });
      // Revert on error
      setApplications(previousApps); 
    }
  };

  const handleDelete = async (id: string) => {
    const previousApps = [...applications];
    setApplications(prev => prev.filter(a => a._id !== id));
    try {
      await deleteATSApplication(id);
      toast({ title: "Deleted", description: "Application removed." });
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
      setApplications(previousApps);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    const toDelete = Array.from(selectedIds);
    const previousApps = [...applications];
    setApplications(prev => prev.filter(a => !toDelete.includes(a._id!)));
    setSelectedIds(new Set());
    
    try {
      await Promise.all(toDelete.map(id => deleteATSApplication(id)));
      toast({ title: "Deleted", description: `${toDelete.length} applications removed.` });
    } catch(err) {
      toast({ title: "Error", description: "Bulk delete failed.", variant: "destructive" });
      setApplications(previousApps);
    }
  };

  const exportCSV = () => {
    const headers = ["Candidate Name", "Role", "Status", "Applied Date"];
    const rows = filteredApplications.map(a => [
      a.candidateName,
      a.role,
      a.status,
      a.appliedDate
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ats_applications.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("ATS Applications", 14, 15);
    const headers = [["Candidate Name", "Role", "Status", "Applied Date"]];
    const data = filteredApplications.map(a => [a.candidateName, a.role, a.status, isClient ? format(new Date(a.appliedDate), 'PPP') : a.appliedDate]);
    
    (doc as any).autoTable({
      head: headers,
      body: data,
      startY: 20,
    });
    doc.save("ats_applications.pdf");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-1 gap-2">
          <Input 
            placeholder="Search candidate or role..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Screening">Screening</SelectItem>
              <SelectItem value="Interview">Interview</SelectItem>
              <SelectItem value="Offer">Offer</SelectItem>
              <SelectItem value="Hired">Hired</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Bulk Delete ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={exportCSV}>
            <FileDown className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button onClick={() => { setEditingApp(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Candidates Directory
            {isClient && <span className="ml-auto text-sm font-normal text-[var(--st-text-secondary)]">{filteredApplications.length} found</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VirtualizedApplicationsList 
            applications={filteredApplications}
            selectedIds={selectedIds}
            toggleSelection={toggleSelection}
            selectAll={selectAll}
            onEdit={(app) => { setEditingApp(app); setFormOpen(true); }}
            onDelete={handleDelete}
            isClient={isClient}
          />
        </CardContent>
      </Card>

      <ApplicationFormModal 
        open={formOpen}
        onOpenChange={setFormOpen}
        application={editingApp}
        onSave={handleSave}
      />
    </div>
  );
}
