'use client';

import { Button } from '@/components/zoruui';
import { Download } from 'lucide-react';
import type { PayrollSettings } from '@/app/actions/crm-payroll-settings.actions';
import { useMemo, useState } from 'react';
import { useZoruToast } from '@/components/zoruui';

export function ExportSettingsButton({ settings }: { settings: PayrollSettings }) {
  const { toast } = useZoruToast();
  const [isExporting, setIsExporting] = useState(false);

  // Memoize the settings to avoid unnecessary recalculations if there were heavy processing
  const exportData = useMemo(() => {
    return JSON.stringify(settings, null, 2);
  }, [settings]);

  const handleExport = () => {
    setIsExporting(true);
    try {
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: 'Export Successful', description: 'Your settings have been exported as JSON.' });
    } catch (e) {
      toast({ title: 'Export Failed', description: 'Could not export settings.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={isExporting} variant="outline">
      <Download className="mr-2 h-4 w-4" />
      Export Settings
    </Button>
  );
}
