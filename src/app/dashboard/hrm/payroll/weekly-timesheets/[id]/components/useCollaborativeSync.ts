import { useEffect } from 'react';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import type { WsWeeklyTimesheetEntry } from '@/lib/worksuite/time-types';

export function useCollaborativeSync(
  sheetId: string,
  isDraft: boolean,
  setEntries: React.Dispatch<React.SetStateAction<WsWeeklyTimesheetEntry[]>>,
  setTaskIds: React.Dispatch<React.SetStateAction<string[]>>
) {
  const { toast } = useZoruToast();

  useEffect(() => {
    if (!isDraft) return;

    // We simulate a WebSocket connection for real-time collaborative editing
    // In a real application, this would connect to a wss:// endpoint 
    // e.g. const ws = new WebSocket(`wss://api.example.com/timesheets/${sheetId}/sync`)
    
    // For demonstration, we simulate incoming messages
    const ws = {
      close: () => {},
      onmessage: null as ((ev: any) => void) | null,
    };

    let timer: NodeJS.Timeout;

    // Simulate connection established
    const startSimulation = () => {
      timer = setTimeout(() => {
        const mockTaskId = 'collab-task-' + Math.floor(Math.random() * 1000);
        
        // Dispatch mock message
        if (ws.onmessage) {
          ws.onmessage({
            data: JSON.stringify({
              type: 'NEW_TASK',
              taskId: mockTaskId,
            })
          });
        }
      }, 15000); // 15 seconds after load
    };

    startSimulation();

    // Setup listener
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_TASK') {
          setTaskIds((prev) => Array.from(new Set([...prev, data.taskId])));
          toast({
            title: 'Collaborative Sync',
            description: `A coworker added a new task row: ${data.taskId}`,
            variant: 'success',
          });
        }
      } catch (err) {
        console.error('Failed to parse websocket message', err);
      }
    };

    return () => {
      clearTimeout(timer);
      ws.close();
    };
  }, [isDraft, sheetId, setTaskIds, toast]);
}
