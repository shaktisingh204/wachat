'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PerformanceReview } from '@/lib/hrm-advanced-types';
import { savePerformanceReview, deletePerformanceReview, getPerformanceReviews } from '@/app/actions/hrm-advanced/performance-reviews';
import { Button } from '@/components/zoruui';
import { ReviewForm } from './review-form';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { Plus, Download, Trash, FileText, Search, RefreshCw, Edit, FileSpreadsheet } from 'lucide-react';

export function PerformanceReviewsClient({ initialData }: { initialData: PerformanceReview[] }) {
  const [data, setData] = useState<PerformanceReview[]>(initialData);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<PerformanceReview | null>(null);
  
  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [minScore, setMinScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('');

  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Polling for real-time updates (simulated WebSocket)
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(async () => {
      try {
        const newData = await getPerformanceReviews();
        // Simple heuristic: if length or a top-level property changed, we update. 
        // In a real app we'd reconcile properly or use true WebSockets
        setData(newData);
      } catch (err) {
        console.error('Failed to poll updates', err);
      }
    }, 10000); // 10 seconds polling
    return () => clearInterval(interval);
  }, [isPolling]);

  // Memoized filtering
  const filteredData = useMemo(() => {
    return data.filter(review => {
      const matchSearch = searchTerm === '' || 
        review.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.reviewerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.comments.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchMin = minScore === '' || review.score >= parseFloat(minScore);
      const matchMax = maxScore === '' || review.score <= parseFloat(maxScore);
      
      return matchSearch && matchMin && matchMax;
    });
  }, [data, searchTerm, minScore, maxScore]);

  // Optimistic save
  const handleSave = async (review: PerformanceReview) => {
    const isNew = !review._id;
    const tempId = review._id || `temp-${Date.now()}`;
    const optimisticReview = { ...review, _id: tempId };

    // Optimistic update
    setData(prev => isNew ? [optimisticReview, ...prev] : prev.map(r => r._id === review._id ? optimisticReview : r));
    setIsFormOpen(false);
    setEditingReview(null);

    try {
      const result = await savePerformanceReview(review);
      if (result.success && result.data) {
        // Replace temp id with real id
        setData(prev => prev.map(r => r._id === tempId ? result.data as PerformanceReview : r));
        toast.success(`Review ${isNew ? 'created' : 'updated'} successfully`);
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (err: any) {
      toast.error(`Error saving review: ${err.message}`);
      // Revert optimistic update
      setData(prev => isNew ? prev.filter(r => r._id !== tempId) : prev.map(r => r._id === tempId ? review : r));
    }
  };

  // Optimistic delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    const reviewToDelete = data.find(r => r._id === id);
    if (!reviewToDelete) return;

    // Optimistic update
    setData(prev => prev.filter(r => r._id !== id));
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    try {
      await deletePerformanceReview(id);
      toast.success('Review deleted successfully');
    } catch (err: any) {
      toast.error(`Error deleting review: ${err.message}`);
      // Revert
      setData(prev => [...prev, reviewToDelete]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} reviews?`)) return;

    const idsToDelete = Array.from(selectedIds);
    const reviewsToRestore = data.filter(r => r._id && idsToDelete.includes(r._id));

    // Optimistic
    setData(prev => prev.filter(r => !r._id || !idsToDelete.includes(r._id)));
    setSelectedIds(new Set());

    let hasError = false;
    for (const id of idsToDelete) {
      try {
        await deletePerformanceReview(id);
      } catch (err) {
        hasError = true;
      }
    }

    if (hasError) {
      toast.error('Some reviews could not be deleted');
      // Simple revert (could be improved to only revert failed ones)
      setData(prev => [...prev, ...reviewsToRestore]);
    } else {
      toast.success(`${idsToDelete.length} reviews deleted successfully`);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set<string>();
      filteredData.forEach(r => r._id && allIds.add(r._id));
      setSelectedIds(allIds);
    }
  };

  // Exports
  const exportCSV = () => {
    const csv = Papa.unparse(filteredData.map(r => ({
      ID: r._id,
      EmployeeID: r.employeeId,
      ReviewerID: r.reviewerId,
      Score: r.score,
      Date: r.reviewDate,
      Comments: r.comments
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'performance_reviews.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Performance Reviews", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Employee ID', 'Reviewer ID', 'Score', 'Date', 'Comments']],
      body: filteredData.map(r => [
        r.employeeId,
        r.reviewerId,
        r.score.toString(),
        r.reviewDate,
        r.comments.substring(0, 50) + (r.comments.length > 50 ? '...' : '')
      ]),
    });
    doc.save('performance_reviews.pdf');
  };

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // estimated row height
    overscan: 5,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] p-6 max-w-[1400px] mx-auto gap-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance 360 Reviews</h1>
          <p className="text-sm text-zoru-ink">Manage, evaluate, and track employee performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPolling(!isPolling)} title="Toggle Real-time Updates">
            <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
            {isPolling ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button onClick={() => { setEditingReview(null); setIsFormOpen(true); }} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Review
          </Button>
        </div>
      </div>

      <div className="flex gap-4 bg-white p-4 rounded-lg shadow-sm border items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-zoru-ink mb-1 block">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zoru-ink-muted" />
            <input 
              type="text" 
              placeholder="Search by ID or comments..." 
              className="w-full pl-9 pr-4 py-2 border rounded-md text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="w-32">
          <label className="text-xs font-medium text-zoru-ink mb-1 block">Min Score</label>
          <input 
            type="number" 
            min="0" max="5" step="0.1"
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={minScore}
            onChange={e => setMinScore(e.target.value)}
          />
        </div>
        <div className="w-32">
          <label className="text-xs font-medium text-zoru-ink mb-1 block">Max Score</label>
          <input 
            type="number" 
            min="0" max="5" step="0.1"
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={maxScore}
            onChange={e => setMaxScore(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="ml-auto">
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash className="w-4 h-4 mr-2" />
              Delete {selectedIds.size} Selected
            </Button>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">{editingReview ? 'Edit Review' : 'Create New Review'}</h2>
          <ReviewForm 
            initialData={editingReview || undefined}
            onSubmit={handleSave}
            onCancel={() => { setIsFormOpen(false); setEditingReview(null); }}
          />
        </div>
      )}

      <div className="flex-1 bg-white border rounded-lg shadow-sm overflow-hidden flex flex-col">
        <div className="grid grid-cols-[40px_1fr_1fr_80px_120px_1fr_100px] gap-4 p-4 border-b bg-zoru-surface-2 font-medium text-sm text-zoru-ink">
          <div className="flex items-center justify-center">
            <input 
              type="checkbox" 
              checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
              onChange={toggleAll}
              className="rounded border-zoru-line"
            />
          </div>
          <div>Employee ID</div>
          <div>Reviewer ID</div>
          <div>Score</div>
          <div>Date</div>
          <div>Comments</div>
          <div className="text-right">Actions</div>
        </div>
        
        <div 
          ref={parentRef} 
          className="flex-1 overflow-auto relative"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const review = filteredData[virtualRow.index];
              const isSelected = review._id ? selectedIds.has(review._id) : false;
              
              // Safe date parsing to prevent hydration mismatch
              let displayDate = review.reviewDate;
              try {
                displayDate = format(parseISO(review.reviewDate), 'MMM d, yyyy');
              } catch(e) {
                // fallback to raw if parse fails
              }

              return (
                <div
                  key={review._id || `temp-${virtualRow.index}`}
                  className={`absolute top-0 left-0 w-full grid grid-cols-[40px_1fr_1fr_80px_120px_1fr_100px] gap-4 p-4 items-center border-b hover:bg-zoru-surface-2 transition-colors text-sm ${isSelected ? 'bg-zoru-surface-2' : ''}`}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="flex items-center justify-center">
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => review._id && toggleSelection(review._id)}
                      className="rounded border-zoru-line"
                    />
                  </div>
                  <div className="font-medium text-zoru-ink truncate">{review.employeeId}</div>
                  <div className="text-zoru-ink truncate">{review.reviewerId}</div>
                  <div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      review.score >= 4 ? 'bg-zoru-surface-2 text-zoru-ink' : 
                      review.score >= 3 ? 'bg-zoru-surface-2 text-zoru-ink' : 
                      'bg-zoru-surface-2 text-zoru-ink'
                    }`}>
                      {review.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-zoru-ink whitespace-nowrap">{displayDate}</div>
                  <div className="text-zoru-ink truncate" title={review.comments}>{review.comments}</div>
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => { setEditingReview(review); setIsFormOpen(true); }}
                      className="p-1 text-zoru-ink-muted hover:text-zoru-ink transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => review._id && handleDelete(review._id)}
                      className="p-1 text-zoru-ink-muted hover:text-zoru-ink transition-colors"
                      title="Delete"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredData.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-zoru-ink">
              No performance reviews found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
