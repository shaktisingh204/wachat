/**
 * Forge entry point.
 *
 * Importing this file pulls every declarative block into the registry.  Do
 * this once in a module that is loaded on both the server and client (e.g. a
 * Next.js layout or the BlockSettingsPanel) before reading `getForgeBlocks()`.
 */

import './blocks/notion';
import './blocks/airtable';
import './blocks/slack';
import './blocks/discord';
import './blocks/github';
import './blocks/twilio';
import './blocks/sendgrid';
import './blocks/agent-run';
import './blocks/agent-tool';
import './blocks/agent-conditional';

export * from './types';
export * from './registry';
