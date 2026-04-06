import type { Source } from "../types";

/**
 * State configuration for creating, reconnecting, or restoring the current cloud sandbox provider.
 * Used with the unified `connectSandbox()` API.
 */
export interface VercelState {
  /** Where to clone from (omit for empty sandbox or when reconnecting/restoring) */
  source?: Source;
  /** Stable persistent sandbox name used across sessions */
  sandboxName?: string;
  /**
   * Legacy sandbox identifier from the pre-persistent implementation.
   * Existing sandboxes may still be addressable via this value while migrating.
   */
  sandboxId?: string;
  /** Legacy snapshot ID used only for one-time migration into a named sandbox */
  snapshotId?: string;
  /** Timestamp (ms) when the current sandbox session expires */
  expiresAt?: number;
}
