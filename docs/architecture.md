---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/prd.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/addendum.md
  - docs/prds/prd-stellar-intents-gateway-2026-08-25/.decision-log.md
workflowType: 'architecture'
project_name: 'stellar-intents-gateway'
user_name: 'JafetCHVDev'
date: '2026-08-25'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
13 FRs across 5 features: Cross-Chain Acquisition (FR-1–4, via NEAR Intents' 1Click API), Wallet & Signing Layer (FR-5–6, existing-wallet connect + unconfirmed embedded-wallet onboarding), Yield Deposit (FR-7–9, via DeFindex SDK, gated by Soroban's short authorization window), Traction Instrumentation (FR-10–11, the mechanism that evidences SCF Integration Track tranche #3), and Distribution Surface (FR-12–13, embeddable widget + standalone web app). Architecturally, this is an orchestration layer over two independent production APIs rather than a system with its own domain model.

**Non-Functional Requirements:**
- Non-custodial by construction (no private key or unilateral transfer capability at any layer) — the defining architectural invariant.
- Upstream availability transparency for both 1Click and DeFindex, given confirmed intermittent failures (Base/Solana routes).
- Signature-window UX: the ~1–5 minute Soroban authorization window must never surface as an opaque error; requires countdown + graceful rebuild.
- Independent auditability: every flow must be reconstructable from public on-chain/API data alone, not from the gateway's own database — qualified below, this holds only with a correlation step (see Integration Coupling Map).

**Scale & Complexity:**
- Primary domain: full-stack web with client-side blockchain SDK integration (Stellar/Soroban, EVM/Bitcoin wallet connectors via NEAR Intents' quote flow).
- Complexity level: Medium — two independent third-party blockchain integrations with strict timing constraints, a resumable multi-step user flow, and dual distribution surfaces (standalone app + embeddable widget).
- Estimated architectural components: cross-chain quote/settlement client, wallet connection/signing layer, Soroban transaction builder + signer flow, a correlation/attribution layer joining the two integrations by Stellar address (newly identified — see below), and a widget packaging layer for third-party embedding.

### Technical Constraints & Dependencies

- NEAR Intents / 1Click API (external, production, no SLA) — Base and Solana origins currently down upstream (Open Question 3). Confirmed to validate destination trustline against Horizon *before* accepting a quote — this makes trustline state a precondition of FR-1, not a downstream consequence of it.
- DeFindex API/SDK (external, production, auth-gated) — deposit() requires a `SorobanAuthorizationEntry` expiring in 12–60 ledgers; no ERC-20-style indefinite allowance exists. Carries no integrator ID concept of its own — attribution here depends entirely on the correlation layer, not on DeFindex's API.
- Wallet layer: Stellar Wallets Kit / Freighter confirmed viable; Privy/DFNS embedded-wallet onboarding capability unconfirmed (Open Question 1) — a hard fork point for the onboarding architecture.
- Distribution: THORWallet embed partnership unconfirmed (Open Question 7) — the widget must ship independent of partner confirmation, but which integrator ID a widget-originated flow reports to 1Click (Zephyroute's, the host partner's, or a sub-attributed value) is an open architectural question, not just a product one.
- No proprietary database of funds or custody ledger by design (Rule #9) — any persistence layer is a convenience cache, not a source of truth, except for the correlation record joining a user's Stellar address across the two integrations, which may be the one piece of state genuinely irreplaceable by public data alone.

### Cross-Cutting Concerns Identified

- Non-custodial invariant must hold across every component (wallet layer, any serverless function, the embeddable widget).
- Upstream dependency degradation (1Click, DeFindex) must be surfaced consistently across both distribution surfaces, not silently swallowed.
- The Soroban authorization time window affects state management, UX, and retry/resume logic across the entire deposit flow — and interacts with solver settlement time (60s on Ethereum/Arbitrum vs. ~14 min on Bitcoin): the deposit XDR (N6) must be built on-demand, triggered by confirmed settlement detection, never speculatively ahead of it, or it risks expiring before the user can act.
- Attribution/instrumentation (integrator ID, traction metrics) must be wired identically whether the user arrives via the standalone app or the embedded widget — this is the mechanism the SCF tranche #3 metric depends on, and it is more fragile than previously assessed (see Integration Coupling Map).
- The inherited KYC/AML ToS tension (Open Question 5) is a legal cross-cutting concern touching onboarding copy and any public marketing/SCF claims, even though it drives no new infrastructure.

### Integration Coupling Map

*Surfaced via Graph of Thoughts analysis — the system is not two integrations in series, as the PRD's Vision implies; it's a graph joined by one implicit correlation node.*

- **Trustline is a precondition, not a consequence.** 1Click validates the destination Stellar account's trustline against Horizon before it will even issue a quote. The trustline-check (FR-3) must architecturally sit before the quote request (FR-1), not after — this reorders the FR-1→FR-3 sequence implied by the PRD's feature ordering.
- **The deposit XDR must be built reactively, not speculatively.** Settlement time varies from 60s (Ethereum/Arbitrum) to ~14 minutes (Bitcoin), while the Soroban authorization window is a fixed ~1–5 minutes measured from XDR construction. Building the deposit XDR ahead of confirmed settlement risks it expiring before the user can sign; this requires an active settlement-detection component (Horizon polling or equivalent) as a first-class piece of the architecture, not an implementation detail.
- **The user's Stellar address is the hidden correlation key.** DeFindex's API has no integrator-ID concept, so net-new TVL (SM-2) can't be attributed from DeFindex's own records alone — it requires correlating the address that received funds via 1Click (which does carry the integrator ID) with that same address's later DeFindex deposits. This correlation step is likely the one piece of state that genuinely needs to persist somewhere, which tempers the "zero backend" framing from Rule #9 — the exception is narrow and specific, not a reopening of the custody question.
- **Widget-context attribution is unresolved.** When the flow runs inside a partner's embed (e.g. THORWallet), which integrator ID gets sent to 1Click — Zephyroute's, the partner's, or a sub-attributed value — is not yet decided. This is a partnership/architecture decision, not just a product one, and it directly affects whether SM-1/SM-2 can be correctly attributed by traffic source.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web with client-side blockchain SDK integration, per Scale & Complexity in Project Context Analysis, needing two distribution surfaces (standalone app, embeddable widget) and one minimal serverless correlation layer.

### Starter Options Considered

| Option | Trade-off | Decision |
|---|---|---|
| **Next.js (App Router)** | Full-stack, first-class Vercel deployment, API routes double as the correlation layer. | **Selected** |
| **Vite plus a separate lightweight backend** | More manual wiring, two deploy targets instead of one, no clear benefit given how thin the actual backend need is (Rule #9). | Rejected |
| **Remix** | A solid full-stack alternative, but the Next.js/Vercel pairing is more battle-tested for this exact app-plus-API-routes shape and has a larger ecosystem overlap with the wallet-kit and Soroban tooling this project depends on. | Rejected |

### Selected Starter: Next.js 16 (App Router)

**Rationale for Selection:**
One framework serves all three needs at once (standalone app, embeddable widget route, correlation-layer API routes), consistent with the PRD's "thinnest possible layer" framing. Deployment on Vercel is zero-config and auto-scaling for exactly this shape, verified live rather than assumed.

**Initialization Command:**

```bash
npx create-next-app@latest zephyroute --typescript --app --no-tailwind --src-dir --import-alias "@/*"
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript, matching CLAUDE.md's AC #6 (strict mode) exactly, no gap to reconcile.

**Styling Solution:**
None imposed (Tailwind explicitly skipped), so the token-first CSS custom-properties system from Design System Foundation becomes the actual styling foundation from day one, not something to retrofit later.

**Build Tooling:**
Next.js's own build and dev toolchain (Turbopack in dev), zero extra configuration needed.

**Testing Framework:**
Not included by default, chosen in a later step, driven by AC #7's specific requirement for tests on transaction-building code.

**Code Organization:**
`src/` directory, App Router file-based routing. The embeddable widget lives as its own dedicated route (for example, `/embed`), rendered inside a partner's iframe, the standard and safest pattern for third-party embedding, which also gives the widget performance isolation from the partner's own app.

**Development Experience:**
Hot reload, zero-config TypeScript, App Router's file-based routing and layouts.

**Consequences of the iframe-embedded widget pattern:** wallet-extension injection (Freighter) and WalletConnect's origin allowlist do not automatically work inside a third-party iframe without explicit configuration. Two technical prerequisites must be verified during partner integration, not assumed: (1) THORWallet's own CSP (`frame-ancestors`) must permit framing the Zephyroute embed origin, and (2) the exact serving origin of `/embed` must be added to the WalletConnect project's allowed-origins list, or wallet connection fails with an origin-not-allowed error. This is now a technical dependency of PRD Open Question 7 (THORWallet partnership), not just a business one, and should be verified before the widget route is built, not discovered during integration.

**Note:** The correlation layer, the one piece of persisted state Rule #9 allows, is built as Next.js API routes, deployed automatically as isolated serverless functions on Vercel rather than a separate service. Its actual persistence choice is a Step 4 decision, not a starter decision.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):** persistence choice for the correlation layer, the wallet-based session model, the error-handling contract (operationalizes AC #5).

**Important Decisions (Shape Architecture):** state management approach, rate limiting, CI/CD gate enforcement (already promised in the UX spec), an interim monitoring foundation.

**Deferred Decisions (Post-MVP, with rationale):** the full threat model and monitoring plan PRD Open Question 10 requires for SCF tranche #2. It deserves its own dedicated pass, not a rushed subsection here; this step only commits to an interim monitoring baseline, not the full deliverable.

### Data Architecture

Persistence for the correlation layer: Upstash Redis, via Vercel's native Marketplace integration. Verified live: Vercel's own KV product was sunset in December 2024, every existing and new setup now routes through Upstash Redis directly, not the deprecated `@vercel/kv` package. A key-value store fits the actual shape of this data exactly (Stellar address to 1Click settlement reference, DeFindex deposit reference, status, timestamps), and reusing the same instance for rate limiting avoids standing up a second piece of infrastructure.

Data modeling: one record type, keyed by Stellar address, holding just enough to answer "is this address's swap settled, and has it deposited yet," the exact question UJ-3 resumability depends on. This stays a convenience cache per Rule #9: if the record were lost entirely, the correct state remains reconstructable from Horizon and DeFindex directly, just slower.

Data validation: every field written here must already be validated against AC #3 before it's persisted.

Migration approach: minimal, a schema-version field from day one covers record-shape changes later.

Caching strategy: no durable caching of quote data, quotes are time-sensitive and always fetched live. Caching stays limited to short-lived client-side UI state for the active session, never a source of truth.

Fallback requirement, not an assumption: if Upstash Redis is unavailable, correlation-layer routes fall back to querying Horizon and DeFindex directly rather than failing. This is an explicit architectural commitment, not an implied consequence of Rule #9, since a convenience-cache principle that isn't actually wired into the failure path is exactly the kind of gap that surfaces silently in production under the No silent failure criterion.

### Authentication & Security

No traditional authentication system exists. Identity is the connected wallet address itself, consistent with the non-custodial invariant and the UX spec's Form Patterns rule.

Session model: reconnecting a wallet is the "login." No server-issued session token is needed beyond basic request correlation, since Horizon and DeFindex remain the actual source of truth for a given address's state.

Security middleware: rate limiting on the correlation-layer API routes via `@upstash/ratelimit`, reusing the same Redis instance chosen above.

Secrets: 1Click and DeFindex API keys live in Vercel environment variables only, scoped separately per environment, never committed to the repo.

API security for the iframe embed: the `/embed` route's CSP and frame-related headers need explicit configuration, not the framework default.

Read authorization for the correlation layer: reading another address's status is not an open lookup. A correlation-layer GET endpoint only returns data for an address that has proven ownership via a signed nonce in that request, closing an enumeration and privacy gap that would otherwise exist even though individual addresses are already public via Horizon.

### API & Communication Patterns

Internal API design: plain REST-style JSON endpoints over Next.js route handlers, no GraphQL.

Error handling standard: every API route returns a consistent error envelope (`{ error: { code, message } }`), and the frontend treats a failed response as something to surface, never something to catch and discard silently.

Communication with 1Click and DeFindex: their own official SDKs, wrapped in a thin validation layer per AC #3.

Rate limiting applies specifically to the correlation-layer routes, not to server-to-server calls toward 1Click/DeFindex.

### Frontend Architecture

State management: TanStack Query v5, not a global client-state library. Its polling/refetch model is a natural fit for the Timestamped Step Tracker and the settlement-detection component.

Component architecture: `components/ui/` for thin skins over headless primitives, `components/features/` for the 4 bespoke components already specified in Component Strategy.

Routing: App Router file-based routing; the standalone app and the `/embed` widget route share the same component layer.

Performance and bundle optimization: `/embed` gets its own tighter bundle-size budget than the standalone app.

### Infrastructure & Deployment

Hosting: Vercel, git-integrated deploys, automatic preview deployments per pull request.

CI/CD: GitHub Actions enforcing the hard gates already promised in the UX spec: contrast and ARIA linting as a merge-blocking check, TypeScript strict-mode compilation, and the transaction-building test suite required by AC #7, all required to pass before merge, not advisory.

Environment configuration: separate environment variable sets for preview and production in Vercel, holding the 1Click/DeFindex keys per AC #2; no `.env` file ever committed.

Monitoring and logging: PRD Open Question 10 remains genuinely unresolved and is not resolved here. What this step commits to: a lightweight uptime/error-tracking tool wired in from day one so upstream degradation is detected proactively, satisfying the Upstream availability transparency NFR even before the full threat model exists.

Scaling: automatic via Vercel's serverless function model.

### Decision Impact Analysis

**Implementation Sequence:** starter init then environment/secrets setup then the correlation-layer Upstash Redis instance and its API routes then the settlement-detection/polling component then the four bespoke UI components then the `/embed` route and its CSP/WalletConnect configuration last.

**Cross-Component Dependencies:** the correlation layer's Redis instance is shared infrastructure for two purposes; the `/embed` route's viability is gated on the Step 3 CSP/WalletConnect finding being verified with THORWallet, itself gated on PRD Open Question 7; the monitoring decision here is interim, not a substitute for the full threat model PRD Open Question 10 still requires.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** naming for the shared Redis instance's two uses, component/file naming drift against the UX spec's exact component names, status-string naming for the deposit/settlement flow, error-response shape consistency across every API route, and the exact location and enforcement mechanism of the shared types module.

### Naming Patterns

**Redis (Data) Naming Conventions:**
`correlation:{stellarAddress}` for a correlation record, `ratelimit:{address}` for a rate-limit bucket.

**API Naming Conventions:**
Kebab-case route segments, camelCase parameters, upstream fields normalized at the AC #3 validation layer. API request/response types follow one naming convention: `{Verb}{Resource}Request` and `{Verb}{Resource}Response` (for example, `GetCorrelationResponse`), always defined in `lib/types.ts`, never redefined inline at the call site or the route handler.

**Code Naming Conventions:**
Components use the exact names already locked in Component Strategy, verbatim (`TrustBadge.tsx`, `CustodyFundFlowDiagram.tsx`, `StepTracker.tsx`, `SignatureCountdown.tsx`). Hooks, functions, and variables use camelCase throughout.

### Structure Patterns

Tests are co-located as `*.test.ts` next to the file they test. Components live under the `components/ui/` versus `components/features/` split from Step 4. Shared utilities, the validation layer, the correlation-layer client, and TanStack Query hooks all live under `lib/`. API routes follow App Router's `app/api/` convention, one route handler per concern.

The shared canonical types module lives at exactly `lib/types.ts` (a single file, not a folder, given how small this surface is), inside the `lib/` directory already established as the one shared home for cross-cutting code. No agent creates a second types location.

Pagination conventions are explicitly out of scope: the correlation-layer surface is a handful of single-resource endpoints, never a list/collection endpoint, so this is a deliberate non-issue, not an oversight.

Config files stay at the repo root; `.env.example` is committed, `.env.local` stays git-ignored. `docs/` stays reserved for product documentation only.

### Format Patterns

API failures use `{ error: { code, message } }`. Success responses return data directly, no `{ data: ... }` wrapper. JSON fields are camelCase, dates are ISO 8601, booleans are real `true`/`false`, and a single item is never array-wrapped.

### Communication Patterns

There is no pub/sub event bus, settlement detection is a TanStack Query polling model. Deposit/settlement state names (submitted, confirming, completed, failed, expired, reverted) form one shared TypeScript union type, used verbatim everywhere. State management stays TanStack Query only, no global client-state store. Query keys follow a consistent array-tuple convention.

### Process Patterns

Every user-facing error maps to exactly one Feedback Pattern already defined in the UX spec (Error/Critical, Warning, Info). No scattered boolean `isLoading` flags; TanStack Query's `status`/`fetchStatus` is the single source of loading state, mapped onto the Step Tracker's already-defined states.

### Enforcement Guidelines

**All AI Agents MUST:**
- Use the exact component names and status literals from the UX spec verbatim, never invent parallel naming.
- Route every error through the shared envelope and the UX spec's Feedback Patterns, never construct an ad-hoc error UI.

**Pattern Enforcement:**
A shared `lib/types.ts` module exports the canonical status unions and the error envelope type, imported everywhere rather than redefined locally. The "TypeScript compile error" guarantee only holds in practice if every API route handler explicitly annotates its return type as the shared response type from `lib/types.ts`, rather than leaving it inferred, since TypeScript's structural typing will not catch two independently-shaped objects that happen to match today. Pattern violations surface as PR review comments referencing this section.

### Pattern Examples

**Good Example:**
```ts
// lib/api/correlation.ts
export async function getCorrelation(address: string, signedNonce: string): Promise<GetCorrelationResponse> {
  const res = await fetch(`/api/correlation/${address}`, {
    headers: { 'x-nonce-signature': signedNonce },
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new CorrelationError(error.code, error.message);
  }
  return res.json();
}
```

**Anti-Pattern:**
```ts
// Ad-hoc shape, no shared envelope, silent catch: forbidden.
fetch(`/api/correlation/${address}`).then(r => r.json()).catch(() => null);
```
