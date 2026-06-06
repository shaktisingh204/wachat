'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { TrainingCourse } from '@/lib/hrm-advanced-types';
import { Button } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Checkbox } from '@/components/sabcrm/20ui';
import { toast } from 'sonner';
import { getTrainingCourses, deleteTrainingCourse } from '@/app/actions/hrm-advanced/lms-training';
import { Plus, Trash2, Download, FileText, Search, Edit2 } from 'lucide-react';
import { TrainingCourseFormDialog } from './TrainingCourseFormDialog';
import { VirtualizedCourseList } from './VirtualizedCourseList';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TrainingCoursesClient({ initialCourses }: { initialCourses: TrainingCourse[] }) {
  const [courses, setCourses] = useState<TrainingCourse[]>(initialCourses);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);

  // Simulated WebSockets for real-time collaborative editing
  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(async () => {
        try {
          const freshCourses = await getTrainingCourses();
          if (JSON.stringify(freshCourses) !== JSON.stringify(courses)) {
             setCourses(freshCourses);
          }
        } catch (error) {
          console.error("Real-time fetch error", error);
        }
      });
    }, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [courses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) || 
                          (c.description || '').toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [courses, search]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCourses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCourses.map(c => c._id!).filter(Boolean)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      const oldCourses = [...courses];
      // Optimistic UI update
      setCourses(courses.filter(c => c._id !== id));
      try {
        await deleteTrainingCourse(id);
        toast.success('Course deleted successfully');
      } catch (error) {
        setCourses(oldCourses);
        toast.error('Failed to delete course');
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} courses?`)) return;

    startTransition(async () => {
      const oldCourses = [...courses];
      setCourses(courses.filter(c => !selectedIds.has(c._id!)));
      try {
        for (const id of Array.from(selectedIds)) {
          await deleteTrainingCourse(id);
        }
        setSelectedIds(new Set());
        toast.success(`Successfully deleted ${selectedIds.size} courses`);
      } catch (error) {
        setCourses(oldCourses);
        toast.error('Failed to delete some courses');
      }
    });
  };

  const handleExportCSV = () => {
    if (filteredCourses.length === 0) return;
    const headers = ['Title', 'Description', 'Enrolled Count', 'Duration (hrs)'];
    const rows = filteredCourses.map(c => [
      `"${c.title.replace(/"/g, '""')}"`,
      `"${(c.description || '').replace(/"/g, '""')}"`,
      c.enrolledCount,
      c.durationHours
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'training_courses.csv';
    link.click();
  };

  const handleExportPDF = () => {
    if (filteredCourses.length === 0) return;
    const doc = new jsPDF();
    doc.text('LMS Training Courses', 14, 15);
    
    const tableData = filteredCourses.map(c => [
      c.title,
      c.description || '',
      c.enrolledCount.toString(),
      c.durationHours.toString()
    ]);

    autoTable(doc, {
      head: [['Title', 'Description', 'Enrolled', 'Duration (hrs)']],
      body: tableData,
      startY: 20,
    });
    
    doc.save('training_courses.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LMS & Training</h1>
          <p className="text-[var(--st-text-secondary)]">Manage corporate training courses, monitor enrollments, and track progress.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={() => { setEditingCourse(null); setIsFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Course
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[var(--st-bg-secondary)] p-4 rounded-lg border">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
          <Input 
            placeholder="Search courses..." 
            className="pl-8 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--st-text-secondary)]">{selectedIds.size} selected</span>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isPending}>
              <Trash2 className="w-4 h-4 mr-2" />
              Bulk Delete
            </Button>
          </div>
        )}
      </div>

      <div className="bg-[var(--st-bg-secondary)] border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 p-4 border-b bg-[var(--st-bg-muted)]/50 font-medium text-sm text-[var(--st-text-secondary)]">
          <div className="flex items-center">
            <Checkbox 
              checked={filteredCourses.length > 0 && selectedIds.size === filteredCourses.length}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all"
            />
          </div>
          <div>Title</div>
          <div>Description</div>
          <div className="text-right">Enrolled</div>
          <div className="text-right">Duration (hrs)</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Virtualized List */}
        <VirtualizedCourseList 
          courses={filteredCourses}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onEdit={(course) => { setEditingCourse(course); setIsFormOpen(true); }}
          onDelete={handleDelete}
          isPending={isPending}
        />
      </div>

      <TrainingCourseFormDialog 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen}
        course={editingCourse}
        onSaveOptimistic={(savedCourse, isNew) => {
          if (isNew) {
            setCourses(prev => [...prev, savedCourse]);
          } else {
            setCourses(prev => prev.map(c => c._id === savedCourse._id ? savedCourse : c));
          }
        }}
      />
    </div>
  );
}
