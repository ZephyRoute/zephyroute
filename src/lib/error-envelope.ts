/**
 * Threat Model, Info.3: a client-visible error must never carry a raw
 * request payload, a full transaction XDR, or a server-side stack trace.
 * This is the one shape allowed to reach a client; detailed diagnostics
 * stay server-side in the monitoring tool.
 */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

export function toErrorEnvelope(code: string, message: string): ErrorEnvelope {
  return { error: { code, message } };
}

/**
 * Issue #61: before this, a caught server-side error vanished with no
 * record anywhere, nothing for the team to see a spike, a pattern, or a
 * new failure mode in production. Vercel captures `console.error`
 * automatically with zero additional setup, the cheapest possible
 * baseline for the formal monitoring plan tranche #2 will eventually
 * require. `cause` is logged as-is, not reformatted, the same
 * server-side-only diagnostic detail this file's own `ErrorEnvelope`
 * comment already draws the line around, this never reaches the
 * client; a real error-tracking service is a separate, larger decision
 * left for that later monitoring-plan work.
 */
export function logServerError(route: string, code: string, cause: unknown): void {
  console.error(`[${route}] ${code}`, cause);
}
