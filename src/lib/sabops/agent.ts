/**
 * SabOps endpoint-agent transport.
 *
 * This is the abstract contract every "real" SabOps agent has to honor —
 * Windows MSI service, macOS launchd daemon, Linux systemd unit, iOS MDM
 * profile callbacks, and Android device-admin app. None of those binaries
 * are shipped yet; the only concrete implementation here is
 * {@link MockAgent}, which simulates a fleet of fake endpoints so the
 * dashboard + Server Actions can be exercised end-to-end.
 *
 * The wire path the real agents will hit lives at
 * `src/app/api/sabops/agent/*` (Next.js Route Handlers), authenticated by
 * the agent-token bearer header — *not* the admin session cookie.
 */

import type { SabopsOs } from '@/lib/rust-client/sabops-endpoints';
import type { SabopsMdmCommandDoc } from '@/lib/rust-client/sabops-mdm-commands';
import type { SabopsSoftwareCreateInput } from '@/lib/rust-client/sabops-software-inventory';
import type { SabopsHardwareUpsertInput } from '@/lib/rust-client/sabops-hardware-inventory';

export interface HeartbeatArgs {
    endpointId: string;
    osVersion?: string;
    agentVersion?: string;
    ipAddress?: string;
    healthScore?: number;
}

export interface HeartbeatResult {
    accepted: boolean;
    /** Next heartbeat interval (seconds). */
    nextIntervalSeconds: number;
    /** Number of commands waiting in the queue. */
    pendingCommands: number;
}

export interface ReportInventoryArgs {
    endpointId: string;
    hardware?: Omit<SabopsHardwareUpsertInput, 'endpointId'>;
    software?: Omit<SabopsSoftwareCreateInput, 'endpointId'>[];
}

export interface ReportInventoryResult {
    hardwareUpserted: boolean;
    softwareInserted: number;
}

/**
 * Abstract endpoint-agent contract. Implementations:
 *  - {@link MockAgent}             — in-memory simulator (this file)
 *  - WindowsAgent                  — DEFERRED. Pinvokes WMI, ships MSI service.
 *  - MacOsAgent                    — DEFERRED. launchd daemon + SystemConfig.
 *  - LinuxAgent                    — DEFERRED. systemd unit + /proc inspector.
 *  - IosMdmAgent                   — DEFERRED. SCEP-signed MDM payload.
 *  - AndroidDeviceAdmin            — DEFERRED. DevicePolicyManager bridge.
 */
export interface IOpsAgentTransport {
    /** Mark the endpoint as alive and pull liveness/health back from the server. */
    heartbeat(args: HeartbeatArgs): Promise<HeartbeatResult>;
    /** Push a fresh hardware+software inventory snapshot. */
    reportInventory(args: ReportInventoryArgs): Promise<ReportInventoryResult>;
    /** Pull queued MDM commands for the endpoint (FIFO). */
    pollCommands(endpointId: string): Promise<SabopsMdmCommandDoc[]>;
    /** Acknowledge that the agent has executed a queued command. */
    acknowledgeCommand(commandId: string): Promise<{ acknowledged: boolean }>;
}

/* ─── In-memory mock implementation ────────────────────────────────── */

interface MockFleetEntry {
    endpointId: string;
    hostname: string;
    os: SabopsOs;
    lastSeen: number;
    pending: SabopsMdmCommandDoc[];
}

/**
 * Lightweight in-process simulator. Backs the demo seed UI and the
 * `/api/sabops/agent/*` Route Handler in development. Not used in
 * production — there the real Server Actions write directly to Rust /
 * Mongo via the rust-clients.
 */
export class MockAgent implements IOpsAgentTransport {
    private fleet = new Map<string, MockFleetEntry>();

    seed(endpointId: string, hostname: string, os: SabopsOs): void {
        this.fleet.set(endpointId, {
            endpointId,
            hostname,
            os,
            lastSeen: Date.now(),
            pending: [],
        });
    }

    enqueueCommand(endpointId: string, command: SabopsMdmCommandDoc): void {
        const entry = this.fleet.get(endpointId);
        if (entry) entry.pending.push(command);
    }

    async heartbeat(args: HeartbeatArgs): Promise<HeartbeatResult> {
        const entry = this.fleet.get(args.endpointId);
        if (!entry) {
            return { accepted: false, nextIntervalSeconds: 300, pendingCommands: 0 };
        }
        entry.lastSeen = Date.now();
        return {
            accepted: true,
            nextIntervalSeconds: 60,
            pendingCommands: entry.pending.length,
        };
    }

    async reportInventory(args: ReportInventoryArgs): Promise<ReportInventoryResult> {
        return {
            hardwareUpserted: Boolean(args.hardware),
            softwareInserted: args.software?.length ?? 0,
        };
    }

    async pollCommands(endpointId: string): Promise<SabopsMdmCommandDoc[]> {
        const entry = this.fleet.get(endpointId);
        if (!entry) return [];
        const out = entry.pending;
        entry.pending = [];
        return out;
    }

    async acknowledgeCommand(_commandId: string): Promise<{ acknowledged: boolean }> {
        return { acknowledged: true };
    }
}

/** Process-wide singleton — fine because Mock state is in-memory dev only. */
export const mockAgent = new MockAgent();
