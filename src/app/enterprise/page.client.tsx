'use client';

import * as React from 'react';
import { Sidebar } from './_components/Sidebar';
import { Docs } from './_components/Docs';
import { Simulator } from './_components/Simulator';
import { RequestsTable } from './_components/RequestsTable';
import { InquiryRecord } from './types';

export default function EnterprisePage() {
  const [requests, setRequests] = React.useState<InquiryRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate fetching initial requests
    const timer = setTimeout(() => {
      setRequests([
        {
          id: 'tx_ent_a1b2c3d4e',
          organization: 'Acme Corp',
          email: 'admin@acme.com',
          volume: '500k-2m',
          useCase: 'Global cluster',
          status: 'approved',
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        },
        {
          id: 'tx_ent_f5g6h7i8j',
          organization: 'TechFlow',
          email: 'cto@techflow.io',
          volume: '2m+',
          useCase: 'High throughput pipeline',
          status: 'pending',
          createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        }
      ]);
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleNewRequest = (req: InquiryRecord) => {
    setRequests(prev => [req, ...prev]);
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col selection:bg-white selection:text-black">
      <style jsx global>{`
        body {
          background-color: black !important;
          color: white !important;
        }
      `}</style>
      
      <div className="flex flex-col md:flex-row flex-1">
        <Sidebar />
        
        <main className="flex-1 p-8 lg:p-12 overflow-y-auto border-r border-white/20 bg-black flex flex-col gap-12">
          <Docs />
          
          <div className="border-t border-white/20 pt-12">
            <h2 className="text-xl font-bold mb-6">Recent Inquiries</h2>
            <RequestsTable requests={requests} isLoading={isLoading} />
          </div>
        </main>
        
        <Simulator onNewRequest={handleNewRequest} />
      </div>
    </div>
  );
}
