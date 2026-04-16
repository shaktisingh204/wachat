/**
 * SabFlow Embed SDK — TypeScript definitions
 *
 * Types for the `window.SabFlow` API injected by `/embed.js`.
 *
 * Usage:
 *   /// <reference path="./embed.d.ts" />
 *   window.SabFlow?.open();
 *   window.SabFlow?.setVariable('email', 'foo@example.com');
 */

export {};

declare global {
  interface Window {
    /** SabFlow embed SDK — available after /embed.js loads. */
    SabFlow?: SabFlowSDK;
  }
}

/** Possible embed modes. */
export type SabFlowMode = 'standard' | 'popup' | 'bubble';

/** Bubble button / popup trigger position (bubble + popup modes). */
export type SabFlowPosition = 'bottom-right' | 'bottom-left';

/** Parsed config read from the `<script data-*>` attributes. */
export interface SabFlowConfig {
  flowId: string;
  mode: SabFlowMode;
  apiHost: string;
  buttonText: string;
  buttonLabel: string;
  buttonColor: string;
  buttonPosition: SabFlowPosition;
  container: string;
  height: string;
  borderRadius: string;
  variables: string;
}

/** Event names emitted by the SDK. */
export type SabFlowEvent =
  | 'ready'
  | 'open'
  | 'close'
  | 'message'
  | 'completed';

/** Payload for the 'message' event — fired when the flow sends/receives a message. */
export interface SabFlowMessagePayload {
  role: 'bot' | 'user';
  text?: string;
  kind?: string;
}

/** Payload for the 'completed' event — fired when the flow finishes. */
export interface SabFlowCompletedPayload {
  sessionId?: string;
  variables?: Record<string, unknown>;
}

/** Payload for 'open' / 'close' events. */
export interface SabFlowOpenClosePayload {
  mode: SabFlowMode;
}

/** Variable values that can be pre-filled into a flow. */
export type SabFlowVariableValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<string | number | boolean | null>;

/** Generic event handler. `unknown` keeps it callable without `any`. */
export type SabFlowEventHandler = (payload: unknown) => void;

/** Public API shape of `window.SabFlow`. */
export interface SabFlowSDK {
  /** Marker set by the SDK when boot completes. */
  readonly __initialised: true;

  /** Parsed config from the loading script tag. */
  readonly config: Readonly<SabFlowConfig>;

  /** Open the chat (popup / bubble modes). No-op for standard mode. */
  open: () => void;

  /** Close the chat (popup / bubble modes). No-op for standard mode. */
  close: () => void;

  /** Toggle open/close (popup / bubble modes). */
  toggle: () => void;

  /**
   * Pre-fill a single variable. Queued if the iframe hasn't loaded yet and
   * flushed once the iframe reports 'ready'.
   */
  setVariable: (name: string, value: SabFlowVariableValue) => void;

  /** Pre-fill multiple variables at once. */
  setVariables: (vars: Readonly<Record<string, SabFlowVariableValue>>) => void;

  /** Register an event listener. */
  on: (event: SabFlowEvent, handler: SabFlowEventHandler) => void;

  /**
   * Remove an event listener.
   * - Pass a handler to remove just that handler.
   * - Omit the handler to clear all handlers for the event.
   */
  off: (event: SabFlowEvent, handler?: SabFlowEventHandler) => void;

  /** Unmount the SDK — removes all injected DOM nodes and clears listeners. */
  destroy: () => void;
}
