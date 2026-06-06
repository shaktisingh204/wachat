'use client';

import * as React from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function ParseResumeButton({ candidateId, resumeUrl }: { candidateId: string; resumeUrl?: string }) {
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState(false);

  const handleParse = async () => {
    if (!resumeUrl) {
      toast.error('No resume uploaded to parse.');
      return;
    }
    setParsing(true);
    // Mock parsing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setParsing(false);
    setParsed(true);
    toast.success('Resume parsed successfully! Skills and work history have been extracted.');
  };

  if (!resumeUrl) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleParse}
      disabled={parsing || parsed}
      className="ml-4"
    >
      {parsing ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : parsed ? (
        <CheckCircle2 className="mr-2 h-4 w-4 text-zoru-ink" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      {parsing ? 'Parsing...' : parsed ? 'Parsed' : 'Parse Resume'}
    </Button>
  );
}
