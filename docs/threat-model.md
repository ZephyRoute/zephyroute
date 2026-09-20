---
inputDocuments:
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/prd.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/addendum.md
  - docs/architecture.md
  - docs/epics.md
project_name: 'zephyroute'
user_name: 'JafetCHVDev'
date: '2026-09-13'
purpose: 'Resolves PRD Open Question 10, the STRIDE threat model and monitoring plan the SCF Build panel requires as a tranche #2 condition.'
---

# Zephyroute Threat Model and Monitoring Plan

This document resolves PRD Open Question 10. It is built from the failure-mode evidence already gathered in `addendum.md` §B and §C, applied systematically against the actual system described in `architecture.md`, rather than a generic checklist. Every threat below is tied to a specific component already named in the architecture, not a hypothetical one.

## Scope and Assets

**What this system protects:**
- The user's ability to sign transactions correctly, meaning what they see matches what they sign (AC #4).
- The integrity of quote and deposit data between the user and 1Click/DeFindex/Horizon.
- The privacy of the correlation record (which addresses used the gateway, and when).
- The integrity of the traction data Zephyroute reports to the SCF panel.
- Availability of the core flow (quote, sign, settle, deposit).

**What this system explicitly does not protect, by design:** user private keys. They never enter any Zephyroute-controlled system at any point (AC #1), so key theft is out of scope for this threat model, not because it is unimportant, but because the architecture already eliminates it structurally rather than defending it.

## STRIDE Analysis

### Spoofing

| Attack scenario | Mitigation already in place | Residual risk / new requirement |
|---|---|---|
| An attacker signs a fake nonce claiming to be another user's address, to read that address's correlation status | The signed-nonce protocol (Authentication & Security, Story 1.12) verifies the signature recovers to the claimed address before returning data | None significant. This closes the enumeration gap found during Architecture validation. |
| A malicious third-party site frames `/embed` to impersonate a legitimate partner and phish users inside a fake "THORWallet" shell | CSP `frame-ancestors` configuration was already flagged (Story 4.2) | **New requirement:** the `frame-ancestors` directive must explicitly allowlist confirmed partner origins by name (for example `https://thorwallet.io`), never a wildcard or `*`. A generic "permit framing" policy would let any site frame the widget and dress it up as something else. |
| A compromised DNS or MITM returns fake data pretending to be 1Click, DeFindex, or Horizon | Standard TLS/HTTPS on all three integrations; `lib/validation.ts` checks response fields against what was requested (AC #3) | Residual, inherited risk: Zephyroute cannot independently verify the authenticity of 1Click's, DeFindex's, or Horizon's own infrastructure. This is accepted as an inherited trust boundary, consistent with the project depending on these as production APIs with no SLA of their own. |

### Tampering

| Attack scenario | Mitigation already in place | Residual risk / new requirement |
|---|---|---|
| A malicious script (XSS) alters what is rendered on screen before signing, even though the underlying XDR object is correctly validated and typed | `ValidatedTransactionXDR` guarantees the data is correct, but does not by itself prevent a compromised page from rendering something different from that data | **New requirement:** an explicit `script-src` CSP directive (not just the `frame-ancestors` one already scoped for the embed) restricting script execution to Zephyroute's own bundled code, no inline scripts, no third-party script origins beyond what is strictly needed. This closes a gap the existing CSP discussion never covered, since it only addressed framing, not script injection. |
| An attacker with access to the Redis correlation record alters a settlement or deposit status to mislead a user | The correlation record is explicitly a convenience cache, never the source of truth (Rule #9, AC #9); a tampered record would be caught the moment the app falls back to querying Horizon/DeFindex directly | Low residual risk, well-mitigated by the existing architecture, not something to add new controls for. |
| A tampered deposit XDR is submitted for signature | `ValidatedTransactionXDR` (Story 1.9) and the on-screen destination/amount review (Story 1.10) together enforce AC #4 | None significant beyond the script-src hardening above. |

### Repudiation

| Attack scenario | Mitigation already in place | Residual risk / new requirement |
|---|---|---|
| A user claims they never signed a transaction they actually signed | The transaction hash and Horizon explorer link shown starting at the `submitted` state (Story 1.11) is an independently verifiable, cryptographically signed record | None. Soroban signatures are themselves non-repudiable. |
| A dispute arises over what traction figures Zephyroute reported to the SCF panel | AC #9 already guarantees every figure is independently reconstructable from public data | None. This is already a structural strength of the architecture, not something this threat model needed to add. |

### Information Disclosure

| Attack scenario | Mitigation already in place | Residual risk / new requirement |
|---|---|---|
| Enumeration of user addresses and activity through the correlation API | Signed-nonce read authorization (Story 1.12) | None significant, already closed. |
| 1Click or DeFindex API keys leak into the repository or logs | Environment variables only, `.env.local` git-ignored (AC #2) | **New requirement:** the CI pipeline (`.github/workflows/ci.yml`, Story 1.3) adds an explicit secret-scanning step (for example, a GitHub-native secret scanning check or an equivalent tool), as a merge-blocking gate. "Never commit a secret" is a policy; a scanning gate is the actual enforcement, consistent with this project's existing enforcement-not-convention pattern. |
| A client-visible error message or log accidentally includes a full request payload, a raw XDR, or a wallet address in a way that leaks more than necessary | Not yet addressed anywhere in the existing documents | **New requirement:** the error envelope (`{ error: { code, message } }`, Implementation Patterns) must never include raw request payloads, full XDRs, or stack traces in what reaches the client; detailed diagnostic information stays server-side in the monitoring tool (see Monitoring Plan below), never in the response body itself. |

### Denial of Service

| Attack scenario | Mitigation already in place | Residual risk / new requirement |
|---|---|---|
| Abuse of the correlation-layer API routes | `@upstash/ratelimit`, sharing the same Redis instance (Authentication & Security) | **Residual risk to monitor, not solve architecturally:** if Upstash Redis itself is unavailable, the app correctly stays available by falling back to direct Horizon/DeFindex queries (AC #9), but the rate limiter is unavailable during that same window, since it depends on the same Redis instance. This is an accepted, honest tradeoff (availability over rate-limiting during a Redis outage), not a flaw to fix now, but it must be an explicit monitored condition (see Monitoring Plan). |
| Abuse of quote requests to run up API costs | Quote requests go directly from the client to 1Click (Architectural Boundaries), not proxied through a Zephyroute-owned endpoint | This is a deliberate architectural boundary: abuse protection for quote requests is delegated to 1Click's own infrastructure, not duplicated by Zephyroute. Documented here explicitly rather than left as a silent assumption. |
| 1Click, DeFindex, or Horizon become unavailable | Upstream availability transparency NFR, the interim monitoring commitment (Infrastructure & Deployment) | Already covered; the Monitoring Plan below makes this concrete. |

### Elevation of Privilege

| Attack scenario | Mitigation already in place | Residual risk / new requirement |
|---|---|---|
| An anonymous visitor accesses the project-team-facing traction metrics view (Story 3.2, FR11) | **None.** Story 3.2 describes the view as "project-team-facing" but never specifies how team identity is verified, a genuine gap found while writing this threat model | **New requirement:** Story 3.2 gains an access-control mechanism appropriate to this project's minimal-infrastructure philosophy (Rule #9), not a full admin auth system. The lightest sufficient option is Vercel's own deployment protection (password or team-member-only access) on that specific route, avoiding new proprietary authentication code. |

## Monitoring Plan

Extends the interim monitoring commitment already made in Architecture (Infrastructure & Deployment) into a concrete plan, rather than leaving it as a placeholder.

**Tool:** a lightweight error and uptime tracking tool (for example Sentry, or Vercel's own built-in observability), wired in as part of Epic 1's foundation work, before any other feature story.

**What is monitored:**
- 1Click, DeFindex, and Horizon response failures and latency, directly operationalizing the Upstream availability transparency NFR, not just showing degradation to the user but recording it for the team.
- Upstash Redis availability, specifically to know when the app is running in its fallback-to-direct-query mode (AC #9) and, per the Denial of Service finding above, when rate limiting is consequently unavailable.
- The rate of expired signature windows, since a rising rate is itself a UX or upstream-timing signal, not just an individual user's bad luck.
- The rate of on-chain deposit reverts.
- **SM-C1 (abandonment rate between quote and settled deposit)**, the PRD's own counter-metric, was never previously connected to an actual monitored signal anywhere in the architecture or epics documents. This plan makes that connection explicit: SM-C1 is not just a metric shown in a report, it is a monitored, alertable value.

**Alerting thresholds (initial, to be tuned after real traffic):**
- More than 5% of quote or settlement requests failing within a 10-minute window.
- Upstash Redis unreachable for more than 2 minutes.
- Signature-window expiry rate exceeding a set baseline, signaling the countdown or UX itself may need adjustment, not just individual bad luck.
- Any spike in deposit reverts, since this is the failure mode closest to a user's actual funds being affected, even though the funds themselves are never at risk (§B).

**What this plan deliberately does not include:** a full incident-response runbook or a formal on-call rotation. Given the project's aggressive weeks-scale timeline and small team, this plan commits to detection and visibility, the SCF tranche #2 requirement, not a mature SRE practice that would be disproportionate at this stage.

## Resolution of PRD Open Question 10

This document, together with the STRIDE-driven fixes below, resolves PRD Open Question 10. Five concrete, previously-undocumented requirements were found while writing it, not merely a restatement that "the architecture is secure":

1. `frame-ancestors` must explicitly allowlist confirmed partner origins by name.
2. An explicit `script-src` CSP directive is required, not only the framing policy.
3. CI gains a secret-scanning step as a merge-blocking gate.
4. Client-visible errors must never include raw payloads, XDRs, or stack traces.
5. The traction-metrics view (Story 3.2) needs an explicit access-control mechanism, previously unspecified.

All five are reflected as concrete story or architecture amendments alongside this document, not left as free-floating findings.
