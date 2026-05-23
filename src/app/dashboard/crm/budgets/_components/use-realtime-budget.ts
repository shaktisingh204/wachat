'use client';

import { useEffect, useState } from 'react';
import { useZoruToast } from '@/components/zoruui';

export function useRealtimeBudget(budgetId: string, initialActual: number, planAmount: number, alertAt: number) {
  const [actual, setActual] = useState(initialActual);
  const { toast } = useZoruToast();

  useEffect(() => {
    // In a real app, this would connect to wss://api.sabnode.com/budgets/${budgetId}/live
    // or use new EventSource(`/api/crm/budgets/${budgetId}/sse`)
    const interval = setInterval(() => {
      // Simulate real-time expense flowing in randomly
      if (Math.random() > 0.7) {
        const expense = Math.floor(Math.random() * 500) + 50;
        setActual((prev) => {
          const newActual = prev + expense;
          
          // Check for threshold alerts
          if (planAmount > 0 && alertAt > 0) {
            const prevPct = (prev / planAmount) * 100;
            const newPct = (newActual / planAmount) * 100;
            
            if (prevPct < alertAt && newPct >= alertAt) {
              toast({
                title: 'Budget Alert',
                description: `Spending has crossed the ${alertAt}% threshold.`,
                variant: 'destructive',
              });
            } else if (prevPct < 100 && newPct >= 100) {
              toast({
                title: 'Budget Depleted',
                description: 'Warning: This budget is now completely exhausted.',
                variant: 'destructive',
              });
            }
          }
          return newActual;
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [budgetId, planAmount, alertAt, toast]);

  return actual;
}
