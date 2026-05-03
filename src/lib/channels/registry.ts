/**
 * Process-wide registry of channel adapters.
 *
 * Adapters self-register at module load via `./index.ts`. Consumers look up
 * adapters by `Channel` (the discriminator from `./types.ts`).
 */

import type { Channel, ChannelAdapter } from './types';

const REGISTRY = new Map<Channel, ChannelAdapter>();

export function registerChannel(adapter: ChannelAdapter): void {
    if (!adapter || !adapter.channel) {
        throw new Error('registerChannel: adapter must provide a `channel` discriminator');
    }
    REGISTRY.set(adapter.channel, adapter);
}

export function getChannel(channel: Channel): ChannelAdapter | undefined {
    return REGISTRY.get(channel);
}

export function requireChannel(channel: Channel): ChannelAdapter {
    const a = REGISTRY.get(channel);
    if (!a) {
        throw new Error(`Channel adapter not registered: ${channel}`);
    }
    return a;
}

export function listChannels(): ChannelAdapter[] {
    return Array.from(REGISTRY.values());
}

export function clearRegistry(): void {
    // Test helper. Production code should not call this.
    REGISTRY.clear();
}
