import 'server-only';

import { rustFetch } from './fetcher';

export interface SabopsHardwareDoc {
    _id?: string;
    userId: string;
    endpointId: string;
    cpu?: string;
    ramGb?: number;
    diskGb?: number;
    gpu?: string;
    batteryHealth?: number;
    lastInventoryAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface SabopsHardwareUpsertInput {
    endpointId: string;
    cpu?: string;
    ramGb?: number;
    diskGb?: number;
    gpu?: string;
    batteryHealth?: number;
}

export const hardwareApi = {
    list(endpointId?: string): Promise<{ items: SabopsHardwareDoc[] }> {
        const q = endpointId ? `?endpointId=${encodeURIComponent(endpointId)}` : '';
        return rustFetch(`/v1/sabops/hardware${q}`);
    },
    upsert(input: SabopsHardwareUpsertInput): Promise<{ id: string; entity: SabopsHardwareDoc }> {
        return rustFetch(`/v1/sabops/hardware`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
};
