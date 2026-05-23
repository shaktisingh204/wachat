"use client";

import { useState } from "react";
import { toast } from "sonner";

export function ApplyForm({ jobId, jobTitle }: { jobId: string, jobTitle: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsOpen(false);
      toast.success("Application successfully submitted [200 OK]", {
        description: `Payload accepted for ${jobTitle}`
      });
    }, 1500);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto bg-white text-black hover:bg-black hover:text-white hover:border-white border border-transparent transition-colors px-6 py-2 text-sm font-bold uppercase tracking-wider"
      >
        Execute / Apply
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-white pt-6 mt-6 space-y-4 animate-in fade-in slide-in-from-top-2">
      <h4 className="text-sm font-bold uppercase tracking-widest border-b border-dashed border-white/50 pb-1">Application Payload</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase text-white/70">full_name *</label>
          <input required type="text" className="w-full bg-black border border-white/30 p-2 text-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all" placeholder="string" />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase text-white/70">email *</label>
          <input required type="email" className="w-full bg-black border border-white/30 p-2 text-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all" placeholder="string ($email)" />
        </div>
      </div>
      
      <div className="space-y-1">
        <label className="text-xs uppercase text-white/70">portfolio_url | github_url</label>
        <input type="url" className="w-full bg-black border border-white/30 p-2 text-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all" placeholder="https://" />
      </div>

      <div className="space-y-1">
        <label className="text-xs uppercase text-white/70">cover_letter (optional)</label>
        <textarea rows={4} className="w-full bg-black border border-white/30 p-2 text-sm focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-all" placeholder="Explain your node's capabilities..."></textarea>
      </div>

      <div className="flex gap-4 pt-2">
        <button 
          type="submit" 
          disabled={isLoading}
          className="bg-white text-black hover:bg-black hover:text-white hover:border-white border border-transparent transition-colors px-6 py-2 text-sm font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'POST /apply'}
        </button>
        <button 
          type="button" 
          onClick={() => setIsOpen(false)}
          className="border border-white/30 hover:bg-white/10 transition-colors px-6 py-2 text-sm font-bold uppercase tracking-wider"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
