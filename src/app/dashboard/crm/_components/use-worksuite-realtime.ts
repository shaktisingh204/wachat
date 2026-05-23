import { useEffect } from 'react';

type RealtimeCallback = (event: any) => void;

export function useWorksuiteRealtime(callback: RealtimeCallback) {
  useEffect(() => {
    let evtSource: EventSource | null = null;
    let retryCount = 0;

    function connect() {
      evtSource = new EventSource('/api/worksuite/stream');

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callback(data);
        } catch (e) {
          // heartbeat or unparseable
        }
      };

      evtSource.onerror = () => {
        evtSource?.close();
        if (retryCount < 5) {
          retryCount++;
          setTimeout(connect, Math.min(1000 * Math.pow(2, retryCount), 10000));
        }
      };
    }

    connect();

    return () => {
      evtSource?.close();
    };
  }, [callback]);
}
