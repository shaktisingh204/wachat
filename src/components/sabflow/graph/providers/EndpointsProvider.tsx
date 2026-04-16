'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type Endpoint = { id: string; y: number };

interface EndpointsContextValue {
  sourceEndpointYOffsets: Map<string, Endpoint>;
  targetEndpointYOffsets: Map<string, Endpoint>;
  setSourceEndpointYOffset: (endpoint: Endpoint) => void;
  deleteSourceEndpointYOffset: (id: string) => void;
  setTargetEndpointYOffset: (endpoint: Endpoint) => void;
}

const EndpointsContext = createContext<EndpointsContextValue>({
  sourceEndpointYOffsets: new Map(),
  targetEndpointYOffsets: new Map(),
  setSourceEndpointYOffset: () => {},
  deleteSourceEndpointYOffset: () => {},
  setTargetEndpointYOffset: () => {},
});

export const EndpointsProvider = ({ children }: { children: ReactNode }) => {
  const [sourceEndpointYOffsets, setSourceEndpoints] = useState<Map<string, Endpoint>>(new Map());
  const [targetEndpointYOffsets, setTargetEndpoints] = useState<Map<string, Endpoint>>(new Map());

  const setSourceEndpointYOffset = useCallback((endpoint: Endpoint) => {
    setSourceEndpoints((prev) => new Map(prev).set(endpoint.id, endpoint));
  }, []);

  const deleteSourceEndpointYOffset = useCallback((id: string) => {
    setSourceEndpoints((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const setTargetEndpointYOffset = useCallback((endpoint: Endpoint) => {
    setTargetEndpoints((prev) => new Map(prev).set(endpoint.id, endpoint));
  }, []);

  return (
    <EndpointsContext.Provider value={{
      sourceEndpointYOffsets,
      targetEndpointYOffsets,
      setSourceEndpointYOffset,
      deleteSourceEndpointYOffset,
      setTargetEndpointYOffset,
    }}>
      {children}
    </EndpointsContext.Provider>
  );
};

export const useEndpoints = () => useContext(EndpointsContext);
