'use client';

import React from 'react';
import GoogleMapReact from 'google-map-react';
import type { CrmAccount } from '@/lib/definitions';
import type { WithId } from 'mongodb';

function Marker({ text }: { text: string }) {
  return (
    <div className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text)] text-xs px-2 py-1 rounded shadow-sm flex items-center justify-center translate-x-[-50%] translate-y-[-100%] whitespace-nowrap">
      {text}
    </div>
  );
}

export function ClientsMapView({ accounts }: { accounts: WithId<CrmAccount>[] }) {
  const defaultProps = {
    center: {
      lat: 20.5937,
      lng: 78.9629
    },
    zoom: 4
  };

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <GoogleMapReact
        bootstrapURLKeys={{ key: "" }}
        defaultCenter={defaultProps.center}
        defaultZoom={defaultProps.zoom}
      >
        {accounts.map((acc, i) => {
          // Generate a pseudo-random position near India based on ID
          const seed = String(acc._id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const lat = 10 + (seed % 20) + (seed % 100) / 100;
          const lng = 70 + (seed % 20) + (seed % 50) / 100;
          
          return (
            <Marker 
              key={String(acc._id)}
              lat={lat}
              lng={lng}
              text={acc.name || 'Account'}
            />
          );
        })}
      </GoogleMapReact>
    </div>
  );
}
