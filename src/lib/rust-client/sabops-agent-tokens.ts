import 'server-only';

import { rustFetch } from './fetcher';
import type { SabopsOs } from './sabops-endpoints';

export interface SabopsAgentTokenDoc {
    _id?: string;
    userId: string;
    token: string;
    expiresAt: string;
    used: boolean;
    usedAt?: string;
    redeemedEndpointId?: string;
    intendedOs?: SabopsOs;
    createdAt: string;
}

export interface SabopsAgentTokenIssueInput {
    ttlSeconds?: number;
    intendedOs?: SabopsOs;
}

export interface SabopsAgentTokenIssueResult {
    id: string;
    token: string;
    expiresAt: string;
    entity: SabopsAgentTokenDoc;
}

export interface SabopsAgentTokenRedeemInput {
    token: string;
    hostname: string;
    os: SabopsOs;
    osVersion?: string;
    agentVersion?: string;
    macAddress?: string;
    serialNumber?: string;
    model?: string;
}

export const agentTokensApi = {
    list(includeUsed = false): Promise<{ items: SabopsAgentTokenDoc[] }> {
        return rustFetch(`/v1/sabops/agent-tokens?includeUsed=${includeUsed}`);
    },
    issue(input: SabopsAgentTokenIssueInput): Promise<SabopsAgentTokenIssueResult> {
        return rustFetch(`/v1/sabops/agent-tokens`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    revoke(id: string): Promise<{ revoked: boolean }> {
        return rustFetch(`/v1/sabops/agent-tokens/${id}`, { method: 'DELETE' });
    },
    redeem(input: SabopsAgentTokenRedeemInput): Promise<{ endpointId: string }> {
        return rustFetch(`/v1/sabops/agent-tokens/redeem`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
};
