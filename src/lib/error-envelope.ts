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
